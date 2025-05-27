document.addEventListener('DOMContentLoaded', () => {
    const chatLog = document.getElementById('chat-log');
    const chatInput = document.getElementById('chat-input'); // Now just HTMLElement | null
    const sendButton = document.getElementById('send-button'); // Now just HTMLElement | null

    // Ensure elements exist before proceeding
    if (!chatLog || !chatInput || !sendButton) {
        console.error('One or more chat UI elements were not found in the DOM. Check HTML IDs.');
        return; // Stop execution if essential elements are missing
    }

    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem('sessionId', sessionId);
    }

    const API_BASE_URL = 'http://localhost:3001';
    console.log("Frontend attempting to communicate with API at:", API_BASE_URL);


    function appendMessage(text, sender, isTool = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);
        if (isTool) {
            messageElement.classList.add('tool');
        }
        messageElement.textContent = typeof text === 'object' ? JSON.stringify(text, null, 2) : text;
        chatLog.appendChild(messageElement);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    async function sendMessage() {
        // No type assertion needed here for JavaScript.
        // We rely on the fact that if chatInput is not null, it's an input element.
        const messageText = chatInput.value.trim(); // Access .value directly
        if (!messageText) return;

        appendMessage(messageText, 'user');
        chatInput.value = ''; // Access .value directly
        sendButton.disabled = true; // Access .disabled directly

        const thinkingMessageElement = document.createElement('div');
        thinkingMessageElement.classList.add('message', 'assistant', 'thinking');
        thinkingMessageElement.textContent = "Thinking...";
        chatLog.appendChild(thinkingMessageElement);
        chatLog.scrollTop = chatLog.scrollHeight;

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: messageText, sessionId: sessionId }),
            });

            const thinkingMsg = chatLog.querySelector('.message.assistant.thinking');
            if (thinkingMsg) {
                chatLog.removeChild(thinkingMsg);
            }

            if (!response.ok) {
                let errorText = `Error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorText = `Error: ${errorData.error || JSON.stringify(errorData)}`;
                } catch (e) {
                    try {
                        const plainErrorText = await response.text();
                        if (plainErrorText) {
                            errorText = `Error: ${response.status} - ${plainErrorText.substring(0, 200)}`;
                        }
                    } catch (e2) {
                        console.error("Could not parse error response body:", e2);
                    }
                }
                appendMessage(errorText, 'assistant');
                return;
            }

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await response.json();
                if (data.responses && Array.isArray(data.responses)) {
                    data.responses.forEach(res => {
                        const displayContent = typeof res.content === 'object' ? JSON.stringify(res.content, null, 2) : res.content;
                        appendMessage(displayContent, res.role, res.role === 'tool');
                    });
                } else if (data.response) {
                     appendMessage(data.response, 'assistant');
                } else {
                    appendMessage('Received an empty or malformed successful response.', 'assistant');
                }
            } else {
                 const textResponse = await response.text();
                 console.error("Received non-JSON success response:", textResponse);
                 appendMessage('Error: Received an unexpected response format from the server.', 'assistant');
            }

        } catch (error) {
            console.error('Failed to send message (network or other client-side error):', error);
            const thinkingMsg = chatLog.querySelector('.message.assistant.thinking');
            if (thinkingMsg) {
                chatLog.removeChild(thinkingMsg);
            }
            appendMessage('Error: Could not connect to the server or an unexpected error occurred.', 'assistant');
        } finally {
            sendButton.disabled = false; // Access .disabled directly
            chatInput.focus(); // Access .focus() directly
        }
    }

    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });
});