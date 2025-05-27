import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent, RunnableAgent } from 'langchain/agents';
import {
    SystemMessage,
    HumanMessage,
    AIMessage,
    ToolMessage,
} from '@langchain/core/messages';
import {
    ChatPromptTemplate,
    MessagesPlaceholder,
} from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z, ZodObject, ZodAny, ZodTypeAny, ZodString, ZodRawShape } from 'zod';
import dotenv from 'dotenv';

import { handleOkxTradeApiCommand, getTradeApiCommands } from './okxTradeApiHandler';
import { handleOkxMarketApiCommand, getMarketApiCommands } from './okxMarketApiHandler';
import { ChatMessage } from './agent';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in the environment variables.');
}

const llm = new ChatOpenAI({
    apiKey: OPENAI_API_KEY,
    modelName: 'gpt-4o-mini',
    temperature: 0.0,
});

function buildArgsString(args: Record<string, any>): string {
    return Object.entries(args)
        .map(([key, value]) => {
            if (value === undefined || value === null) return null;
            return `${key}=${typeof value === 'string' && value.includes(' ') ? `"${value}"` : value}`
        })
        .filter(Boolean)
        .join(' ');
}

const tradeApiRawCommands = getTradeApiCommands();
const marketApiRawCommands = getMarketApiCommands();

const okxApiTools = [
    // ... (Tool definitions remain the same as your last correct version)
    // Ensure cmd.llm_tool_description is very concise from your handler files
    ...tradeApiRawCommands.map(cmd => {
        const shape: ZodRawShape = {};
        cmd.requiredParams.forEach(param => {
            if (param.toLowerCase().includes('index') || param.toLowerCase().includes('id') && !param.toLowerCase().includes('address')) {
                shape[param] = z.string().regex(/^\d*$/).describe(`Numeric string value for ${param}.`);
            } else if (param.toLowerCase().includes('amount')) {
                shape[param] = z.string().regex(/^\d+(\.\d+)?$/).describe(`Numeric string for amount.`);
            } else {
                shape[param] = z.string().describe(`Value for ${param}.`);
            }
        });
        const currentSchema = z.object(shape).catchall(z.string().optional().describe("Other optional string parameters."));
        type InferredSchemaType = z.infer<typeof currentSchema>;

        return new DynamicStructuredTool({
            name: cmd.name,
            description: `OKX Action: ${cmd.llm_tool_description}. Call this to ${cmd.llm_tool_description.toLowerCase().replace(/^gets/,'get').replace(/^retrieves/,'retrieve')}. Required: ${cmd.requiredParams.join(', ') || 'None'}. Input to this tool MUST be a JSON string representing an object with these parameters.`,
            schema: currentSchema,
            func: async (input: string) => {
                let parsedArgs: InferredSchemaType;
                try {
                    const rawInput = typeof input === 'string' ? JSON.parse(input) : input;
                    parsedArgs = currentSchema.parse(rawInput);
                } catch (e: any) {
                    console.error(`[OkxApiAgentTool] Error parsing/validating input for ${cmd.name}: Received input: ${input}`, e.stack);
                    return `Invalid input format for ${cmd.name}. Expected a JSON string matching the schema. Error: ${e.message}`;
                }
                console.log(`[OkxApiAgentTool] Calling Trade API command: ${cmd.name} with parsed args:`, parsedArgs);
                const argsString = buildArgsString(parsedArgs);
                try {
                    const result = await handleOkxTradeApiCommand(cmd.name, argsString);
                    return JSON.stringify(result, null, 2);
                } catch (error: any) {
                    console.error(`[OkxApiAgentTool] Error calling ${cmd.name}: ${error.message}`, error.stack ? `\nStack: ${error.stack.substring(0,300)}` : '');
                    return `Error executing ${cmd.name}: ${error.message}. Example: ${cmd.example}`;
                }
            },
        });
    }),
    ...marketApiRawCommands.map(cmd => {
        const shape: ZodRawShape = {};
        cmd.requiredParams.forEach(param => {
             if (param.toLowerCase().includes('index') || param.toLowerCase().includes('id') && !param.toLowerCase().includes('address')) {
                shape[param] = z.string().regex(/^\d*$/).describe(`Numeric string value for ${param}.`);
            } else {
                shape[param] = z.string().describe(`Value for ${param}.`);
            }
        });
        const currentSchema = z.object(shape).catchall(z.string().optional().describe("Other optional string parameters."));
        type InferredSchemaType = z.infer<typeof currentSchema>;

        return new DynamicStructuredTool({
            name: cmd.name,
            description: `Use for OKX Market/Balance/History API: ${cmd.llm_tool_description}. Answers questions like '${cmd.ui_description.split('.')[0].replace(/^Get |^Retrieve |^Query |^Fetches /,'What is my...').replace(/ for .*/, '')}?' Required: ${cmd.requiredParams.join(', ') || 'None'}. Input to this tool MUST be a JSON string representing an object with these parameters.`,
            schema: currentSchema,
            func: async (input: string) => {
                let parsedArgs: InferredSchemaType;
                try {
                    const rawInput = typeof input === 'string' ? JSON.parse(input) : input;
                    parsedArgs = currentSchema.parse(rawInput);
                } catch (e: any) {
                    console.error(`[OkxApiAgentTool] Error parsing/validating input for ${cmd.name}: Received input: ${input}`, e.stack);
                    return `Invalid input format for ${cmd.name}. Expected a JSON string matching the schema. Error: ${e.message}`;
                }
                console.log(`[OkxApiAgentTool] Calling Market API command: ${cmd.name} with parsed args:`, parsedArgs);
                const argsString = buildArgsString(parsedArgs);
                try {
                    const result = await handleOkxMarketApiCommand(cmd.name, argsString);
                    return JSON.stringify(result, null, 2);
                } catch (error: any) {
                    console.error(`[OkxApiAgentTool] Error calling ${cmd.name}: ${error.message}`, error.stack ? `\nStack: ${error.stack.substring(0,300)}` : '');
                    return `Error executing ${cmd.name}: ${error.message}. Example: ${cmd.example}`;
                }
            },
        });
    }),
    (() => {
        const resolveChainInfoSchema = z.object({
            chainName: z.string().describe("Common blockchain name (e.g., Solana, Ethereum, BSC).")
        });
        type InferredChainSchema = z.infer<typeof resolveChainInfoSchema>;
        return new DynamicStructuredTool({
            name: "resolve_chain_info",
            description: "Helper: Converts common chain name (e.g. 'Solana', 'Ethereum') to its OKX numeric chainIndex. Input MUST be a JSON string like: '{\"chainName\": \"Solana\"}'.",
            schema: resolveChainInfoSchema,
            func: async (input: string) => {
                let args: InferredChainSchema;
                try {
                    const rawInput = typeof input === 'string' ? JSON.parse(input) : input;
                    args = resolveChainInfoSchema.parse(rawInput);
                } catch (e: any) {
                    return `Invalid input format for resolve_chain_info. Expected JSON string like '{"chainName": "value"}'. Error: ${e.message}`;
                }
                const name = args.chainName.toLowerCase();
                const mapping: Record<string, string> = {
                    "solana": "501", "ethereum": "1", "eth": "1", "arbitrum": "42161", "arb": "42161",
                    "oktc": "66", "okx chain": "66", "bsc": "56", "binance smart chain": "56"
                };
                if (mapping[name]) {
                    return JSON.stringify({ chainIndex: mapping[name], resolvedFor: args.chainName, status: "success" });
                }
                return JSON.stringify({ error: `Could not resolve chainIndex for ${args.chainName}. Ask user for numeric chainIndex or supported name.`, status: "not_found" });
            }
        });
    })()
];

const agentPrompt = ChatPromptTemplate.fromMessages([
    new SystemMessage(
        `You are "OKX API Copilot," an AI assistant that MUST use the provided tools to answer user questions about OKX functionalities.
        **Your primary goal is to accurately select and use tools. Do NOT state you "don't have the capability" if a relevant tool exists. If a tool fails, inform the user of the error and ask for clarification or different parameters.**

        Tool Usage Protocol:
        1.  **Understand Intent & Select Tool.**
        2.  **Chain Identification (CRITICAL):** If a chain name is given, ALWAYS use 'resolve_chain_info' tool FIRST to get its numeric 'chainIndex'. Use this 'chainIndex' in subsequent tool calls. If 'resolve_chain_info' fails (e.g., returns a 'not_found' status in its JSON output), inform the user and ask them for the numeric chainIndex or a supported chain name. Do not proceed with other tools requiring a chainIndex without a valid one.
        3.  **Parameter Extraction & Formatting:** Extract all parameters required by the chosen tool's schema. You MUST format these parameters as a single JSON string. For example, if a tool needs 'chainIndex' and 'amount', the input string for the tool would be '{"chainIndex": "501", "amount": "10000"}'.
        4.  **'tokenContractAddress':** For native tokens (ETH, SOL), use "NATIVE" as the value in the JSON string. If a user gives a symbol (USDC) but no address, YOU MUST ASK them for the specific token contract address on the relevant chain.
        5.  **'address' or 'userWalletAddress':** If not given by user, and WALLET_ADDRESS is set (current: ${WALLET_ADDRESS || "Not Set"}), confirm with user: "I can use the pre-configured wallet address [${WALLET_ADDRESS ? WALLET_ADDRESS.substring(0,4)+'...'+WALLET_ADDRESS.substring(WALLET_ADDRESS.length-4) : 'Not Set'}]. Is that okay?". If not set or user says no, YOU MUST ASK for the address.
        6.  **Comma-Separated Lists (e.g., 'tokens' param):** Format as a single string value within the JSON: e.g., '{"tokens": "501:NATIVE,1:NATIVE" }'.
        7.  **Missing Information:** If required parameters are missing, YOU MUST ASK THE USER.
        8.  **Sequential Operations:** Perform sequentially. Call first tool, get result (which will be a JSON string, so parse it), then use information from that result if needed for the second tool.
        9.  **Tool Output Handling & Formatting (VERY IMPORTANT):**
            *   Tool outputs are JSON strings. Parse them to understand the API's response (e.g., checking 'code', 'msg', 'data' fields from OKX).
            *   If 'code' is "0" and 'data' is present and non-empty:
                *   If 'data' is an array (e.g., a list of tokens, liquidity sources, trades):
                    *   **Format your response to the user using bullet points (e.g., '*' or '-').**
                    *   **Display a maximum of 10 items in the bulleted list.**
                    *   For each item, present key information concisely (e.g., "Token: [Symbol] ([Name]) - Address: [Address]", or "Source: [Name]").
                    *   If there are more than 10 items, state this (e.g., "Showing the first 10 of X items. Would you like to see more?").
                *   If 'data' is an object (e.g., price info, single balance): Present the key information clearly.
            *   If 'data' is empty, null, or 'code' is not "0", inform the user clearly (e.g., "The API returned no data for your query," or "API Error (code [THE_CODE_VALUE]): [THE_MSG_VALUE]").
            *   Do not just dump raw JSON as your final answer to the user unless specifically asked or if it's a very short, simple JSON object. Always try to make it readable.
        10. **Self-Correction:** If a tool fails, analyze error, inform user, consider different parameters or tool.

        Think step-by-step. Your purpose is to successfully use OKX APIs via tools. Input to tools is ALWAYS a JSON string.
        Your final response to the user MUST be formatted clearly, using bullet points for lists up to 10 items.
        `
    ),
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
]);

// ... (getOkxApiAgentExecutor and handleOkxApiAgentMessage remain the same as your last correct version)
let agentExecutorInstance: AgentExecutor | null = null;

async function getOkxApiAgentExecutor(): Promise<AgentExecutor> {
    if (agentExecutorInstance) {
        return agentExecutorInstance;
    }
    const agent = await createOpenAIToolsAgent({
        llm,
        tools: okxApiTools,
        prompt: agentPrompt,
    });

    agentExecutorInstance = new AgentExecutor({
        agent: agent,
        tools: okxApiTools,
        verbose: true,
    });
    console.log("[OkxApiAgent] Agent Executor Initialized with OKX API tools.");
    return agentExecutorInstance;
}

export async function handleOkxApiAgentMessage(
    userInput: string,
    chatHistory: ChatMessage[],
): Promise<ChatMessage[]> {
    console.log("\n--- [OkxApiAgent] New User Turn ---");
    console.log(`[OkxApiAgent] User Input: ${userInput}`);

    const executor = await getOkxApiAgentExecutor();

    const langchainChatHistory = chatHistory.map((msg) => {
        if (msg.role === 'user') return new HumanMessage({ content: msg.content });
        if (msg.role === 'assistant') {
            return new AIMessage({ content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) });
        }
        if (msg.role === 'tool' && msg.tool_call_id && msg.name) {
            return new ToolMessage({
                content: msg.content,
                tool_call_id: msg.tool_call_id,
                name: msg.name,
            });
        }
        return new HumanMessage({ content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) });
    });

    console.log("[OkxApiAgent] Invoking AgentExecutor with input and history...");
    let result;
    try {
        result = await executor.invoke({
            input: userInput,
            chat_history: langchainChatHistory,
        });
    } catch (e: any) {
        console.error("[OkxApiAgent] Error during AgentExecutor.invoke:", e);
        return [{ role: 'assistant', content: `An unexpected error occurred while processing your request: ${e.message}. Please try again.` }];
    }

    const responseMessagesForFrontend: ChatMessage[] = [];

    if (result.intermediateSteps && Array.isArray(result.intermediateSteps) && result.intermediateSteps.length > 0) {
        console.log("\n--- [OkxApiAgent] Agent Intermediate Steps ---");
        for (const step of result.intermediateSteps) {
            const action = step.action;
            const observation = step.observation;
            const toolCallId = action.toolCallId || `tool_call_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            const observationSample = typeof observation === 'string' ? observation.substring(0, 300) + (observation.length > 300 ? '...' : '') : JSON.stringify(observation).substring(0,300) + '...';
            const toolLog = `[OkxApiAgent] Tool Call: ${action.tool}\nInput (JSON String): ${action.toolInput}\nObservation (Sample): ${observationSample}`;
            console.log(toolLog);

            responseMessagesForFrontend.push({
                role: 'assistant',
                content: `Okay, I will use the ${action.tool} tool. Input: ${action.toolInput}.`,
            });
            responseMessagesForFrontend.push({
                role: 'tool',
                tool_call_id: toolCallId,
                name: action.tool,
                content: observation,
            });
        }
        console.log("--- [OkxApiAgent] End Agent Intermediate Steps ---");
    }

    responseMessagesForFrontend.push({
        role: 'assistant',
        content: result.output as string,
    });
    console.log(`[OkxApiAgent] Final Assistant Response to User: ${result.output}`);
    console.log("--- [OkxApiAgent] End User Turn ---");

    return responseMessagesForFrontend;
}