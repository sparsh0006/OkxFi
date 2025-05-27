import crypto from 'crypto'; // Node.js crypto module
import dotenv from 'dotenv';

dotenv.config();

export const OKX_BASE_URL = 'https://web3.okx.com';

const OKX_API_KEY = process.env.OKX_API_KEY;
const OKX_SECRET_KEY = process.env.OKX_SECRET_KEY;
const OKX_API_PASSPHRASE = process.env.OKX_API_PASSPHRASE;
const OKX_PROJECT_ID = process.env.OKX_PROJECT_ID;

export function getOkxApiHeaders(method: string, requestPath: string, queryString = "", body = "") {
    if (!OKX_API_KEY || !OKX_SECRET_KEY || !OKX_API_PASSPHRASE) {
        console.warn("OKX API Key, Secret, or Passphrase is not set. API calls may fail.");
        // Potentially throw an error or return empty headers if critical
    }
    // OKX_PROJECT_ID is optional for some endpoints but good to include if available
    if (!OKX_PROJECT_ID) {
        console.warn("OKX_PROJECT_ID is not set. Some API calls might require it.");
    }

    const timestamp = new Date().toISOString();
    const stringToSign = timestamp + method.toUpperCase() + requestPath + (queryString ? `?${queryString}` : "") + (typeof body === 'string' ? body : JSON.stringify(body));

    const signature = crypto
        .createHmac('sha256', OKX_SECRET_KEY!)
        .update(stringToSign)
        .digest('base64');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': OKX_API_KEY!,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': OKX_API_PASSPHRASE!,
    };
    if (OKX_PROJECT_ID) {
        headers['OK-ACCESS-PROJECT'] = OKX_PROJECT_ID;
    }
    return headers;
}

// Helper to parse command arguments like key=value key2="value with spaces"
export function parseCommandArgs(argsString: string): Record<string, string> {
    const args: Record<string, string> = {};
    // Regex to match key=value pairs, allowing for quoted values
    const regex = /(\w+)=("([^"]*)"|'([^']*)'|([^'"\s]+))/g;
    let match;
    while ((match = regex.exec(argsString)) !== null) {
        const key = match[1];
        const value = match[3] || match[4] || match[5]; // Prioritize double quotes, then single, then unquoted
        args[key] = value;
    }
    return args;
}