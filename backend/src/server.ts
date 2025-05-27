import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; // Import CORS
import { ChatMessage, handleChatMessage as handleSakAgentMessage } from './agent';
import { handleOkxApiAgentMessage } from './okxApiAgent';
// We don't need getTradeApiCommands or getMarketApiCommands if there's no direct command UI mode

dotenv.config();

const app = express();
const port = process.env.PORT || 3001; // Ensure this is different from your frontend port

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// --- In-memory Chat History Store ---
const chatHistories: { [sessionId: string]: ChatMessage[] } = {};

// --- API Routes ---
app.post('/api/chat', async (req, res) => {
  const { message, sessionId, mode } = req.body; // Removed command, argsString as we focus on NLP

  if (!sessionId) {
    return res.status(400).json({ error: 'SessionId is required' });
  }
  if (!message) {
    return res.status(400).json({ error: 'Message is required for NLP modes' });
  }
  if (!mode || (mode !== 'SAK_AGENT_NLP' && mode !== 'OKX_API_AGENT_NLP')) {
    return res.status(400).json({ error: 'Valid mode (SAK_AGENT_NLP or OKX_API_AGENT_NLP) is required' });
  }

  if (!chatHistories[sessionId]) {
    chatHistories[sessionId] = [];
  }
  const currentLlmHistory = [...chatHistories[sessionId]]; // History for LLM this turn

  console.log(`[Server] Received request: Mode=${mode}, Session=${sessionId}, Message="${message}"`);
  console.log(`[Server] Current history length for LLM: ${currentLlmHistory.length} messages`);


  try {
    let responsesForFrontend: ChatMessage[] = [];

    // Add current user message to persistent history
    chatHistories[sessionId].push({ role: 'user', content: message });

    if (mode === 'SAK_AGENT_NLP') {
      console.log(`[Server] Handling SAK_AGENT_NLP`);
      responsesForFrontend = await handleSakAgentMessage(message, currentLlmHistory);
    } else if (mode === 'OKX_API_AGENT_NLP') {
      console.log(`[Server] Handling OKX_API_AGENT_NLP`);
      responsesForFrontend = await handleOkxApiAgentMessage(message, currentLlmHistory);
    }

    // Process agent/tool responses for persistent history (summarize tool outputs)
    responsesForFrontend.forEach(response => {
      if (response.role === 'tool' && response.name && response.tool_call_id) {
        let observationSummary = `Tool ${response.name} executed. `;
        try {
            const jsonData = JSON.parse(response.content); // Full content from agent handler
            if (jsonData.code === "0" && jsonData.data) {
                if (Array.isArray(jsonData.data)) {
                    observationSummary += `Successfully returned ${jsonData.data.length} items.`;
                    if (jsonData.data.length > 0) {
                      observationSummary += ` (Sample: ${JSON.stringify(jsonData.data[0]).substring(0,100)}...)`;
                    }
                } else if (typeof jsonData.data === 'object' && jsonData.data !== null) {
                    observationSummary += `Successfully returned data object. (Keys: ${Object.keys(jsonData.data).slice(0,3).join(', ')}...)`;
                } else {
                    observationSummary += `Execution successful, data present.`;
                }
            } else if (jsonData.code && jsonData.code !== "0") {
                 observationSummary += `Execution failed with code ${jsonData.code}: ${jsonData.msg || 'No details.'}`;
            } else if (response.content.toLowerCase().startsWith("error executing")) { // If tool func returned an error string
                observationSummary = response.content.substring(0, 250) + (response.content.length > 250 ? "..." : "");
            }
             else {
                observationSummary += `Output (brief): ${response.content.substring(0, 150)}...`;
            }
        } catch (e) {
            // If response.content was not JSON (e.g. an error string from the tool func)
            observationSummary = `Tool ${response.name} output (brief): ${response.content.substring(0, 200)}...`;
        }
        console.log(`[Server] Storing summarized tool observation for ${response.name} in history: ${observationSummary}`);
        chatHistories[sessionId].push({
          role: 'tool',
          content: observationSummary, // Store SUMMARY in history
          name: response.name,
          tool_call_id: response.tool_call_id
        });
      } else { // For 'assistant' messages
        chatHistories[sessionId].push(response);
      }
    });

    res.json({ responses: responsesForFrontend }); // Send full responses to frontend

  } catch (error: any) {
    console.error(`[Server] Error processing ${mode} request for session ${sessionId}:`, error);
    let errorMessage = 'Failed to process message';
     if (error.response && error.response.data && error.response.data.msg) { // Axios error from OKX
        errorMessage = `OKX API Error: ${error.response.data.msg} (Code: ${error.response.data.code || 'N/A'})`;
    } else if ((error as any).code === 'context_length_exceeded' || (error as any).error?.code === 'context_length_exceeded') { // OpenAI error
        errorMessage = `Model context length exceeded. The conversation history or tool descriptions are too long. Please try a shorter query or start a new session. Internal Details: ${error.message}`;
    } else if (error.message) {
        errorMessage = error.message;
    }
    res.status(500).json({ error: errorMessage, details: error.stack });
  }
});

app.listen(port, () => {
  console.log(`[Server] OKXFi Backend listening on http://localhost:${port}`);
  console.log(`[Server] Ensure your frontend is configured to call this backend.`);
});