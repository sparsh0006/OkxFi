import axios from 'axios';
import { OKX_BASE_URL, getOkxApiHeaders, parseCommandArgs } from './okxUtils';

const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

interface CommandHandlerParams {
    args: Record<string, string>;
    rawArgs: string;
}
type CommandHandler = (params: CommandHandlerParams) => Promise<any>;

interface CommandDefinition {
    handler: CommandHandler;
    requiredParams?: string[];
    ui_description: string; // For detailed UI display
    llm_tool_description: string; // Concise for LLM context
    example: string;
}

// YOU MUST GO THROUGH ALL COMMANDS AND:
// 1. Rename 'description' to 'ui_description'.
// 2. Add 'llm_tool_description' with a VERY concise description.
const tradeApiCommands: Record<string, CommandDefinition> = {
    okx_get_tokens: {
        handler: async ({ args }) => {
            const requestPath = '/api/v5/dex/aggregator/all-tokens';
            const params = new URLSearchParams({ chainIndex: args.chainIndex });
            const headers = getOkxApiHeaders('GET', requestPath, params.toString());
            const response = await axios.get(`${OKX_BASE_URL}${requestPath}?${params.toString()}`, { headers });
            return response.data;
        },
        requiredParams: ['chainIndex'],
        ui_description: 'Fetches a list of tokens for a specific chain from OKX DEX Aggregator.',
        llm_tool_description: 'Gets list of tokens for a chainIndex.', // CONCISE
        example: 'okx_get_tokens chainIndex=501'
    },
    okx_get_liquidity_sources: {
        handler: async ({ args }) => {
            const requestPath = '/api/v5/dex/aggregator/get-liquidity';
            const params = new URLSearchParams({ chainIndex: args.chainIndex });
            const headers = getOkxApiHeaders('GET', requestPath, params.toString());
            const response = await axios.get(`${OKX_BASE_URL}${requestPath}?${params.toString()}`, { headers });
            return response.data;
        },
        requiredParams: ['chainIndex'],
        ui_description: 'Get a list of liquidity sources available for swap from OKX DEX Aggregator.',
        llm_tool_description: 'Gets liquidity sources for a chainIndex.', // CONCISE
        example: 'okx_get_liquidity_sources chainIndex=1'
    },
    okx_get_quote: {
        handler: async ({ args }) => {
            const requestPath = '/api/v5/dex/aggregator/quote';
            const params = new URLSearchParams({
                chainIndex: args.chainIndex,
                amount: args.amount,
                fromTokenAddress: args.fromTokenAddress,
                toTokenAddress: args.toTokenAddress,
                ...(args.slippage && { slippage: args.slippage }),
                // ... other optional params
            });
            const headers = getOkxApiHeaders('GET', requestPath, params.toString());
            const response = await axios.get(`${OKX_BASE_URL}${requestPath}?${params.toString()}`, { headers });
            return response.data;
        },
        requiredParams: ['chainIndex', 'amount', 'fromTokenAddress', 'toTokenAddress'],
        ui_description: 'Get the best quote for a swap from OKX DEX Aggregator.',
        llm_tool_description: 'Gets swap quote for specified tokens and amount.', // CONCISE
        example: 'okx_get_quote chainIndex=501 amount=100000000 fromTokenAddress=So11... toTokenAddress=EPjF... slippage=0.5'
    },
    // ... PASTE ALL YOUR OTHER tradeApiCommands HERE ...
    // ... AND FOR EACH ONE:
    // ... 1. RENAME 'description' to 'ui_description'.
    // ... 2. ADD a VERY CONCISE 'llm_tool_description'.
    // Example for another one:
    okx_get_txn_status: {
        handler: async ({ args }) => {
            const requestPath = '/api/v5/dex/aggregator/history';
            const params = new URLSearchParams({
                chainIndex: args.chainIndex,
                txHash: args.txHash,
                ...(args.isFromMyProject && { isFromMyProject: args.isFromMyProject }),
            });
            const headers = getOkxApiHeaders('GET', requestPath, params.toString());
            const response = await axios.get(`${OKX_BASE_URL}${requestPath}?${params.toString()}`, { headers });
            return response.data;
        },
        requiredParams: ['chainIndex', 'txHash'],
        ui_description: 'Get the final transaction status of a single-chain swap using txhash from OKX DEX Aggregator.',
        llm_tool_description: 'Gets transaction status by txHash and chainIndex.', // CONCISE
        example: 'okx_get_txn_status chainIndex=501 txHash=yourTxHash'
    },
    // --- Onchain Gateway API Example ---
    okx_get_onchain_supported_chains: {
        handler: async () => {
            const requestPath = '/api/v5/dex/pre-transaction/supported/chain';
            const headers = getOkxApiHeaders('GET', requestPath);
            const response = await axios.get(`${OKX_BASE_URL}${requestPath}`, { headers });
            return response.data;
        },
        ui_description: 'Retrieve information on chains supported by Onchain gateway API.',
        llm_tool_description: 'Gets chains supported by Onchain Gateway API.', // CONCISE
        example: 'okx_get_onchain_supported_chains'
    },
    // MAKE SURE TO UPDATE ALL YOUR COMMANDS
};

export async function handleOkxTradeApiCommand(command: string, argsString: string): Promise<any> {
    const commandAction = tradeApiCommands[command];
    if (!commandAction) {
        throw new Error(`Unknown OKX Trade API command: ${command}. Available commands: ${Object.keys(tradeApiCommands).join(', ')}`);
    }

    const args = parseCommandArgs(argsString);
    const missingParams = (commandAction.requiredParams || []).filter(param => !args[param] && !(param === 'userWalletAddress' && WALLET_ADDRESS));

    if (missingParams.length > 0) {
        throw new Error(`Missing required parameters for ${command}: ${missingParams.join(', ')}. Example: ${commandAction.example}`);
    }
    return commandAction.handler({ args, rawArgs: argsString });
}

export function getTradeApiCommands() {
    return Object.entries(tradeApiCommands).map(([name, details]) => ({
        name,
        ui_description: details.ui_description, // Use this for UI
        llm_tool_description: details.llm_tool_description, // For LLM
        example: details.example,
        requiredParams: details.requiredParams || []
    }));
}