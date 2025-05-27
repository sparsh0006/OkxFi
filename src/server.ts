import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { ChatMessage, handleChatMessage } from './agent';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});


const chatHistories: { [sessionId: string]: ChatMessage[] } = {};

app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: 'Message and sessionId are required' });
  }

  if (!chatHistories[sessionId]) {
    chatHistories[sessionId] = [];
  }

  try {
    const currentHistory = [...chatHistories[sessionId]];
    
    const aiResponses = await handleChatMessage(message, currentHistory);

    chatHistories[sessionId].push({ role: 'user', content: message });
    aiResponses.forEach(response => {
      chatHistories[sessionId].push(response);
    });

    res.json({ responses: aiResponses });
  } catch (error: any) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ error: error.message || 'Failed to process message' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`Frontend available at http://localhost:${port}/`); // Changed this log
});