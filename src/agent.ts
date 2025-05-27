import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { SolanaAgentKit, KeypairWallet, createLangchainTools, Action } from 'solana-agent-kit';
import DefiPlugin from '@solana-agent-kit/plugin-defi';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
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

import dotenv from 'dotenv';
dotenv.config();

// --- Environment Variable Validation ---
if (!process.env.SOLANA_PRIVATE_KEY) throw new Error('SOLANA_PRIVATE_KEY is not set');
if (!process.env.RPC_URL) throw new Error('RPC_URL is not set');
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
if (!process.env.OKX_API_KEY || !process.env.OKX_SECRET_KEY || !process.env.OKX_API_PASSPHRASE) {
    console.warn("OKX API credentials are not fully set. Some OKX DEX features might not work.");
}
// --- End Environment Variable Validation ---

const secretKey = bs58.decode(process.env.SOLANA_PRIVATE_KEY);
const keypair = Keypair.fromSecretKey(secretKey);
const wallet = new KeypairWallet(keypair, process.env.RPC_URL as string);

const sak = new SolanaAgentKit(wallet, process.env.RPC_URL as string, {
  OKX_API_KEY: process.env.OKX_API_KEY,
  OKX_SECRET_KEY: process.env.OKX_SECRET_KEY,
  OKX_API_PASSPHRASE: process.env.OKX_API_PASSPHRASE,
  OKX_PROJECT_ID: process.env.OKX_PROJECT_ID,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
}).use(DefiPlugin);

// Filter to only OKX actions
const okxActionNames = [
    "OKX_GET_CHAIN_DATA",
    "OKX_GET_LIQUIDITY",
    "OKX_GET_TOKEN",
    "OKX_GET_QUOTE",
    "OKX_GET_SWAP_DATA",
    "OKX_EXECUTE_SWAP"
];
const okxActions = sak.actions.filter(action => okxActionNames.includes(action.name));
if(okxActions.length !== okxActionNames.length) {
    console.warn("Warning: Not all expected OKX actions were found in SAK. Check plugin and action names.");
    console.log("Found SAK Actions that were loaded:", sak.actions.map(a => a.name));
    console.log("Specifically found OKX Actions:", okxActions.map(a => a.name));
} else if (okxActions.length === 0 && sak.actions.length > 0) {
    console.warn("Warning: No OKX actions were filtered, but SAK has other actions. Check action names or filtering logic.");
} else if (sak.actions.length === 0) {
    console.warn("Warning: No actions loaded into SAK at all. Check DefiPlugin initialization.");
}


// Create Langchain tools using the filtered OKX actions
const tools = createLangchainTools(sak, okxActions);

// ***** LOGGING THE DETAILS OF THE TOOLS PASSED TO LANGCHAIN *****
console.log("\n--- LANGCHAIN TOOLS INITIALIZED ---");
if (tools.length > 0) {
    tools.forEach(t => {
        console.log(`Tool Name: ${t.name}`);
        // Log the full description to see exactly what the LLM gets
        console.log(`Tool Description (Full):\n"${t.description}"`);
        console.log(`Tool Schema: ${JSON.stringify((t.schema as any)?.properties || t.schema, null, 2)}`); // Attempt to log properties for ZodObject
        console.log("---------------------------------");
    });
} else {
    console.log("No tools were created for Langchain. Check 'okxActions' array.");
}
console.log("--- END LANGCHAIN TOOLS INITIALIZED ---\n");


const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-4o-mini',
  temperature: 0.2,
});

const SOL_MINT_ADDRESS = "So11111111111111111111111111111111111111112";
const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_DECIMALS = 9;
const USDC_DECIMALS = 6;

const agentPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessage(
    `You are "OKX DEX Copilot," an AI assistant for OKX DEX on Solana.
    Your Wallet Address (for 'userWalletAddress' in OKX_EXECUTE_SWAP): ${sak.wallet.publicKey.toBase58()}.
    Default Solana Chain ID for OKX DEX operations: "501".

    Available Tools:
    ${tools.map(t => `- ${t.name}: ${t.description.split('.')[0]}. Parameters: ${JSON.stringify(Object.keys((t.schema as any)?.properties || (t.schema as any)?.shape || {}))}`).join('\n    ')}

    Interaction Guidelines:
    - If asked "what can you do?" or "help", list your "Available Tools" and their main purpose. Do not call a tool for this general query.
    - Always state operations are performed via "OKX DEX".

    **CRITICAL SWAP PROTOCOL (Follow PRECISELY for any swap request):**
    When a user asks to swap tokens (e.g., "swap 0.01 SOL for USDC"):
    1.  **Identify Tokens & Human Amount:** From Token Symbol (e.g., SOL), To Token Symbol (e.g., USDC), Human-readable Amount (e.g., 0.01).
    2.  **Resolve Token Mint Addresses and Decimals:**
        *   For "SOL": Use mint address "${SOL_MINT_ADDRESS}" and decimals ${SOL_DECIMALS}.
        *   For "USDC": Use mint address "${USDC_MINT_ADDRESS}" and decimals ${USDC_DECIMALS}.
        *   For ANY OTHER token symbol: YOU MUST FIRST use "OKX_GET_TOKEN" tool to find its mint 'address' and 'decimals'. Params: { chainId: "501", tokenSymbol: "USER_TOKEN_SYMBOL" }.
    3.  **Calculate 'amount' in Smallest Units:** Convert human-readable amount to smallest units as a STRING (e.g., 0.01 SOL (9 decimals) -> "10000000"; 10 USDC (6 decimals) -> "10000000").
    4.  **Get Quote:** Call "OKX_GET_QUOTE" with: 'fromTokenAddress' (mint), 'toTokenAddress' (mint), 'amount' (smallest units string), 'slippage' (e.g., "0.5"; default to "0.5" if user doesn't specify), 'chainId' ("501").
    5.  **Present Full Quote:** Show ALL details from OKX_GET_QUOTE.
    6.  **Ask for Explicit Confirmation:** "OKX DEX quotes [full details]. Do you want to execute this swap?"
    7.  **Execute (ONLY IF USER CONFIRMS "yes"):** Call "OKX_EXECUTE_SWAP" with parameters from quote (fromTokenAddress, toTokenAddress, amount in smallest units, slippage) plus 'userWalletAddress': "${sak.wallet.publicKey.toBase58()}", 'chainId': "501".
    8.  If user does not confirm, DO NOT execute.

    General Note: Use chainId "501" for Solana operations. Be concise.
    `
  ),
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

let agentExecutorInstance: AgentExecutor | null = null;

async function getAgentExecutor(): Promise<AgentExecutor> {
  if (agentExecutorInstance) {
    return agentExecutorInstance;
  }
  const openAIToolsAgent = await createOpenAIToolsAgent({
    llm,
    tools,
    prompt: agentPrompt,
  });
  agentExecutorInstance = new AgentExecutor({
    agent: openAIToolsAgent,
    tools,
    verbose: false,
  });
  console.log("Agent Executor Initialized.");
  return agentExecutorInstance;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export async function handleChatMessage(
  userInput: string,
  chatHistory: ChatMessage[],
): Promise<ChatMessage[]> {
  console.log("\n--- New User Turn ---");
  console.log(`User Input: ${userInput}`);

  const executor = await getAgentExecutor();

  const langchainChatHistory = chatHistory.map((msg) => {
    if (msg.role === 'user') return new HumanMessage({ content: msg.content });
    if (msg.role === 'assistant') return new AIMessage({ content: msg.content });
    if (msg.role === 'tool' && msg.tool_call_id && msg.name) {
      return new ToolMessage({
        content: msg.content,
        tool_call_id: msg.tool_call_id,
        name: msg.name,
      });
    }
    return new HumanMessage({ content: JSON.stringify(msg.content) });
  });

  console.log("Invoking AgentExecutor with input and history...");
  const result = await executor.invoke({
    input: userInput,
    chat_history: langchainChatHistory,
  });
  console.log("AgentExecutor Invocation Result (Raw):", JSON.stringify(result, null, 2));

  const responseMessages: ChatMessage[] = [];

  if (result.intermediateSteps && result.intermediateSteps.length > 0) {
    console.log("\n--- Agent Intermediate Steps ---");


    for (const step of result.intermediateSteps) {
      const toolCallId = step.action.toolCallId || `tool_call_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const toolLog = `Tool Call: ${step.action.tool}
Input: ${JSON.stringify(step.action.toolInput, null, 2)}
Observation: ${JSON.stringify(step.observation, null, 2)}`;
      console.log(toolLog);

      responseMessages.push({
        role: 'assistant',
        content: `Okay, I need to use the ${step.action.tool} tool. Input: ${JSON.stringify(step.action.toolInput, null, 2)}.`,
      });
      responseMessages.push({
        role: 'tool',
        tool_call_id: toolCallId,
        name: step.action.tool,
        content: JSON.stringify(step.observation),
      });
    }
    console.log("--- End Agent Intermediate Steps ---");
  }

  responseMessages.push({
    role: 'assistant',
    content: result.output as string,
  });
  console.log(`Final Assistant Response to User: ${result.output}`);
  console.log("--- End User Turn ---");

  return responseMessages;
}