// okxfi-frontend/src/pages/Index.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navigation from '../components/Navigation';
import PromptInput from '../components/PromptInput';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  name?: string;
  tool_call_id?: string;
}

type AgentMode = 'SAK_AGENT_NLP' | 'OKX_API_AGENT_NLP';

const Index = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'Welcome to OKXFi! Select a mode and ask your question.' }
  ]);
  const [currentMode, setCurrentMode] = useState<AgentMode>('SAK_AGENT_NLP');
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let storedSessionId = localStorage.getItem('okxfiSessionId');
    if (!storedSessionId) {
      storedSessionId = crypto.randomUUID();
      localStorage.setItem('okxfiSessionId', storedSessionId);
    }
    setSessionId(storedSessionId);
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleModeChange = useCallback((newMode: AgentMode) => {
    setCurrentMode(newMode);
    const modeName = newMode === 'SAK_AGENT_NLP' ? 'Solana Agent Kit' : 'OKX API Agent (NLP)';
    setMessages(prev => [...prev, { role: 'system', content: `Switched to ${modeName} mode.` }]);
    console.log(`Mode changed to: ${newMode}`);
  }, []);

  const appendMessage = (message: ChatMessage) => {
    setMessages(prevMessages => [...prevMessages, message]);
  };

  const handlePromptSubmit = async (promptText: string) => {
    if (!promptText.trim() || !sessionId || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: promptText };
    setMessages(prev => [...prev, userMessage]);

    setIsLoading(true);
    const thinkingMessageId = crypto.randomUUID();
    const thinkingMessage: ChatMessage = { role: 'assistant', content: 'Processing...', tool_call_id: thinkingMessageId };
    setMessages(prev => [...prev, thinkingMessage]);

    try {
      const backendUrl = 'http://localhost:3001/api/chat';
      console.log('Sending to backend:', {
          message: promptText,
          sessionId: sessionId,
          mode: currentMode,
      });
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: promptText,
          sessionId: sessionId,
          mode: currentMode,
        }),
      });

      setMessages(prev => prev.filter(msg => msg.tool_call_id !== thinkingMessageId));

      if (!response.ok) {
        let errorContent = `Error: ${response.status} ${response.statusText || 'Failed to get response from server.'}`;
        try {
            const errorData = await response.json();
            console.error('Backend Error Data:', errorData);
            errorContent = `Error: ${errorData.error || JSON.stringify(errorData.details) || response.statusText || 'Unknown server error.'}`;
        } catch (e) {
            console.error('Failed to parse error JSON:', e);
        }
        appendMessage({
          role: 'system',
          content: errorContent,
        });
        return;
      }

      const data = await response.json();
      console.log('Received from backend:', data);
      if (data.responses && Array.isArray(data.responses)) {
        data.responses.forEach((res: ChatMessage) => {
          appendMessage(res);
        });
      } else {
        appendMessage({ role: 'system', content: 'Received an unexpected response format.' });
      }
    } catch (error) {
      console.error('API Call Error:', error);
      setMessages(prev => prev.filter(msg => msg.tool_call_id !== thinkingMessageId));
      appendMessage({
        role: 'system',
        content: `Network or client-side error: ${(error as Error).message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (msg: ChatMessage): JSX.Element => {
    if (msg.role === 'tool' || (msg.role === 'assistant' && (msg.content.trim().startsWith('{') || msg.content.trim().startsWith('[')))) {
      try {
        const data = JSON.parse(msg.content);
        if ((msg.name === 'okx_get_liquidity_sources' || msg.name === 'OKX_GET_LIQUIDITY') ||
            (data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0]?.logo && data.data[0]?.name)) {
          return (
            <>
              <p className="mb-1 font-medium text-violet-300">Liquidity Sources:</p> {/* Added color */}
              <ul className="list-disc list-inside pl-4 text-left text-sm space-y-1 text-gray-300"> {/* Adjusted text color */}
                {data.data.map((source: { id: string; name: string; logo: string }, index: number) => (
                  <li key={source.id || index}>
                    {source.name}
                  </li>
                ))}
              </ul>
            </>
          );
        }
        if (msg.role === 'assistant' && msg.content.includes("### Quote Details:")) {
          const lines = msg.content.split('\n');
          const cleanLines: JSX.Element[] = [];
          let currentList: string[] | null = null;
          let sectionTitle: string | null = null;

          lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith("### ")) {
              if (currentList) {
                cleanLines.push(
                  <ul key={`list-${sectionTitle}-${index}`} className="list-disc list-inside pl-5 space-y-0.5 text-sm text-gray-300">
                    {currentList.map((item, i) => <li key={i}>{item.replace(/!\[.*?\]\(.*?\)/g, '').trim()}</li>)}
                  </ul>
                );
                currentList = null;
              }
              sectionTitle = trimmedLine.substring(4);
              cleanLines.push(<h4 key={`title-${sectionTitle}-${index}`} className="font-semibold mt-3 mb-1 text-violet-300">{sectionTitle}</h4>);
            } else if (trimmedLine.startsWith("- **")) {
              if (!currentList) currentList = [];
              currentList.push(trimmedLine.substring(2).replace(/\*\*(.*?)\*\*:/, '$1:'));
            } else if (trimmedLine.startsWith("- ") && sectionTitle === "Available DEX Options:") {
                if (!currentList) currentList = [];
                currentList.push(trimmedLine.substring(2));
            } else if (trimmedLine) {
              if (currentList) {
                cleanLines.push(
                  <ul key={`list-end-${sectionTitle}-${index}`} className="list-disc list-inside pl-5 space-y-0.5 text-sm text-gray-300">
                    {currentList.map((item, i) => <li key={i}>{item.replace(/!\[.*?\]\(.*?\)/g, '').trim()}</li>)}
                  </ul>
                );
                currentList = null;
              }
              cleanLines.push(<p key={`line-${index}`} className="text-sm my-0.5 text-gray-300">{trimmedLine.replace(/!\[.*?\]\(.*?\)/g, '').trim()}</p>);
            }
          });
          if (currentList) {
             cleanLines.push(
                <ul key={`list-final-${sectionTitle}`} className="list-disc list-inside pl-5 space-y-0.5 text-sm text-gray-300">
                  {currentList.map((item, i) => <li key={i}>{item.replace(/!\[.*?\]\(.*?\)/g, '').trim()}</li>)}
                </ul>
              );
          }
          return <div className="text-left space-y-1">{cleanLines}</div>;
        }
        return <pre className="whitespace-pre-wrap text-xs bg-gray-800 p-2 rounded-md">{JSON.stringify(data, null, 2)}</pre>;
      } catch (e) {
        return <span className="whitespace-pre-wrap">{msg.content}</span>;
      }
    }
    return <span className="whitespace-pre-wrap">{msg.content}</span>;
  };

  return (
    <div className="min-h-screen bg-black text-white font-inter flex flex-col">
      <Navigation currentMode={currentMode} onModeChange={handleModeChange} />
      
      <main className="flex-grow flex flex-col pt-16 overflow-hidden"> {/* pt-16 to offset fixed nav */}
        <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
          <div className="space-y-3 pb-4 max-w-4xl mx-auto w-full"> {/* Max width and center chat content */}
            {messages.map((msg, index) => (
              <div key={msg.tool_call_id || index} className={`flex w-full ${
                msg.role === 'system' ? 'justify-center' : // Center system messages
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}>
                <div className={`message py-2 px-4 rounded-xl shadow-lg break-words ${
                  msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-none max-w-[80%] md:max-w-[70%]' :
                  msg.role === 'assistant' ? 'bg-violet-700 text-white rounded-bl-none max-w-[80%] md:max-w-[70%]' :
                  msg.role === 'tool' ? 'bg-gray-700 border border-gray-600 text-gray-200 text-xs font-mono rounded-bl-none max-w-[80%] md:max-w-[70%]' :
                  // System messages styling MODIFIED HERE
                  'bg-transparent text-gray-400 text-center w-full max-w-full text-xs italic py-1 px-0' 
                }`}>
                  {(msg.role !== 'system') && ( // Don't show role for system messages
                    <strong className={`capitalize block mb-1 text-xs ${
                      msg.role === 'user' ? 'text-purple-200' :
                      msg.role === 'tool' ? 'text-gray-400' :
                      'text-violet-200'
                    }`}>
                      {msg.role === 'tool' ? msg.name || 'Tool Result' : msg.role}
                    </strong>
                  )}
                  {renderMessageContent(msg)}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="shrink-0 px-4 pb-4 pt-2 bg-black border-t border-gray-800/50 shadow-md">
          <div className="max-w-3xl mx-auto"> {/* Center prompt input */}
            <PromptInput onSubmit={handlePromptSubmit} isLoading={isLoading} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;