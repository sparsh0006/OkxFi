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
const marketApiCommands: Record<string, CommandDefinition> = {
    okx_market_supported_chains: {
        handler: async ({ args }) => {
            const requestPath = '/api/v5/dex/market/supported/chain';
            const params = new URLSearchParams(args.chainIndex ? { chainIndex: args.chainIndex } : {});
            const headers = getOkxApiHeaders('GET', requestPath, params.toString());
            const response = await axios.get(`${OKX_BASE_URL}${requestPath}?${params.toString()}`, { headers });
            return response.data;
        },
        ui_description: 'Retrieve information on chains supported by OKX Market API.',
        llm_tool_description: 'Gets chains supported by Market API.', // CONCISE
        example: 'okx_market_supported_chains chainIndex=1'
    },
    okx_market_get_price: {
        handler: async ({ args }) => {
            const requestPath = '/api/v5/dex/market/price';
            const body = [{ chainIndex: args.chainIndex, tokenContractAddress: args.tokenContractAddress }];
            const headers = getOkxApiHeaders('POST', requestPath, "", JSON.stringify(body));
            const response = await axios.post(`${OKX_BASE_URL}${requestPath}`, body, { headers });
            return response.data;
        },
        requiredParams: ['chainIndex', 'tokenContractAddress'],
        ui_description: 'Retrieve the latest price of a token using OKX Market API.',
        llm_tool_description: 'Gets latest token price by chain and address.', // CONCISE
        example: 'okx_market_get_price chainIndex=66 tokenContractAddress=0xTokenAddr'
    },
    // ... PASTE ALL YOUR OTHER marketApiCommands HERE ...
    // ... AND FOR EACH ONE:
    // ... 1. RENAME 'description' to 'ui_description'.
    // ... 2. ADD a VERY CONCISE 'llm_tool_description'.
    // Example for another one:
    okx_balance_get_total_value: {
        handler: async ({ args }) => {
            const requestPath = '/api/v5/dex/balance/total-value';
            const addressToUse = args.address || WALLET_ADDRESS;
            if (!addressToUse) throw new Error("Address is required (either as param or WALLET_ADDRESS env var).")
            const params = new URLSearchParams({
                address: addressToUse,
                ...(args.chains && { chains: args.chains }),
                // ... other optional params
            });
            const headers = getOkxApiHeaders('GET', requestPath, params.toString());
            const response = await axios.get(`${OKX_BASE_URL}${requestPath}?${params.toString()}`, { headers });
            return response.data;
        },
        requiredParams: [],
        ui_description: 'Retrieve total balance of all tokens and DeFi assets for an address.',
        llm_tool_description: 'Gets total asset value for an address.', // CONCISE
        example: 'okx_balance_get_total_value address=yourAddress chains=1,501'
    },
    // MAKE SURE TO UPDATE ALL YOUR COMMANDS
};

export async function handleOkxMarketApiCommand(command: string, argsString: string): Promise<any> {
    const commandAction = marketApiCommands[command];
    if (!commandAction) {
        throw new Error(`Unknown OKX Market API command: ${command}. Available commands: ${Object.keys(marketApiCommands).join(', ')}`);
    }

    const args = parseCommandArgs(argsString);
    const missingParams = (commandAction.requiredParams || []).filter(param => !args[param] && !((param === 'address') && WALLET_ADDRESS));

    if (missingParams.length > 0) {
        throw new Error(`Missing required parameters for ${command}: ${missingParams.join(', ')}. Example: ${commandAction.example}`);
    }
    return commandAction.handler({ args, rawArgs: argsString });
}

export function getMarketApiCommands() {
    return Object.entries(marketApiCommands).map(([name, details]) => ({
        name,
        ui_description: details.ui_description, // Use this for UI
        llm_tool_description: details.llm_tool_description, // For LLM
        example: details.example,
        requiredParams: details.requiredParams || []
    }));
}