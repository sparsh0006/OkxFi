document.addEventListener('DOMContentLoaded', () => {
    const chatLog = document.getElementById('chat-log');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const apiCommandsListDiv = document.getElementById('api-commands-list');
    const commandsUl = document.getElementById('commands-ul');

    const modeButtons = {
        sak: document.getElementById('mode-sak'),
        okxTrade: document.getElementById('mode-okx-trade'),
        okxMarket: document.getElementById('mode-okx-market'),
        okxApiAgent: document.getElementById('mode-okx-api-agent'), // New
    };

    let currentMode = 'SAK_AGENT'; // SAK_AGENT, OKX_TRADE_API, OKX_MARKET_API, OKX_API_AGENT

    if (!chatLog || !chatInput || !sendButton || !apiCommandsListDiv || !commandsUl ||
        !modeButtons.sak || !modeButtons.okxTrade || !modeButtons.okxMarket || !modeButtons.okxApiAgent) { // New check
        console.error('One or more UI elements were not found. Check HTML IDs.');
        return;
    }

    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem('sessionId', sessionId);
    }

    const API_BASE_URL = 'http://localhost:3001';

    function setActiveButton(selectedMode) {
        Object.values(modeButtons).forEach(button => {
            if (button) button.classList.remove('active'); // Check if button exists
        });

        if (selectedMode === 'SAK_AGENT' && modeButtons.sak) modeButtons.sak.classList.add('active');
        else if (selectedMode === 'OKX_TRADE_API' && modeButtons.okxTrade) modeButtons.okxTrade.classList.add('active');
        else if (selectedMode === 'OKX_MARKET_API' && modeButtons.okxMarket) modeButtons.okxMarket.classList.add('active');
        else if (selectedMode === 'OKX_API_AGENT' && modeButtons.okxApiAgent) modeButtons.okxApiAgent.classList.add('active'); // New
    }

    async function fetchAndDisplayApiCommands(mode) {
        if (mode === 'SAK_AGENT' || mode === 'OKX_API_AGENT') { // Modified to include new agent mode
            apiCommandsListDiv.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/commands?mode=${mode}`);
            if (!response.ok) {
                const errorData = await response.text();
                appendMessage(`Error fetching commands for ${mode}: ${response.status} - ${errorData}`, 'system');
                apiCommandsListDiv.style.display = 'none';
                return;
            }
            const commands = await response.json();
            commandsUl.innerHTML = ''; // Clear previous commands
            if (commands && commands.length > 0) {
                commands.forEach(cmd => {
                    const li = document.createElement('li');
                    // Use cmd.ui_description here
                    li.innerHTML = `<span class="command-name">${cmd.name}</span>: ${cmd.ui_description} <br><span class="command-example">Params: ${cmd.requiredParams.join(', ') || 'None'}. Example: ${cmd.example}</span>`;
                    li.title = `Click to copy command structure: ${cmd.name} ${cmd.requiredParams.map(p => `${p}=value`).join(' ')}`;
                    li.onclick = () => {
                        chatInput.value = `${cmd.name} ${cmd.requiredParams.map(p => `${p}=`).join(' ')}`;
                        chatInput.focus();
                    };
                    commandsUl.appendChild(li);
                });
                apiCommandsListDiv.style.display = 'block';
            } else {
                 apiCommandsListDiv.style.display = 'none';
            }
        } catch (error) {
            console.error(`Failed to fetch commands for ${mode}:`, error);
            appendMessage(`Could not load commands for ${mode}. Check console.`, 'system');
            apiCommandsListDiv.style.display = 'none';
        }
    }


    modeButtons.sak.addEventListener('click', () => {
        currentMode = 'SAK_AGENT';
        setActiveButton(currentMode);
        appendMessage('Switched to Solana Agent Kit mode.', 'system');
        fetchAndDisplayApiCommands(currentMode);
        chatInput.placeholder = "Ask the SAK Agent...";
    });

    modeButtons.okxTrade.addEventListener('click', () => {
        currentMode = 'OKX_TRADE_API';
        setActiveButton(currentMode);
        appendMessage('Switched to OKX Trade API mode. Enter commands like "command_name param1=value1 ..."', 'system');
        fetchAndDisplayApiCommands(currentMode);
        chatInput.placeholder = "Enter OKX Trade API command...";
    });

    modeButtons.okxMarket.addEventListener('click', () => {
        currentMode = 'OKX_MARKET_API';
        setActiveButton(currentMode);
        appendMessage('Switched to OKX Market API mode. Enter commands like "command_name param1=value1 ..."', 'system');
        fetchAndDisplayApiCommands(currentMode);
        chatInput.placeholder = "Enter OKX Market API command...";
    });

    modeButtons.okxApiAgent.addEventListener('click', () => { // New event listener
        currentMode = 'OKX_API_AGENT';
        setActiveButton(currentMode);
        appendMessage('Switched to OKX API Agent (NLP) mode. Ask me to use OKX APIs naturally!', 'system');
        fetchAndDisplayApiCommands(currentMode); // This will hide the commands list
        chatInput.placeholder = "Ask about OKX APIs (e.g., 'price of ETH on Ethereum')...";
    });


    function appendMessage(text, sender, isSystemMessage = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);

        if (isSystemMessage || sender === 'system') {
             messageElement.classList.add('system-message');
        } else if (sender === 'tool') {
            messageElement.classList.add('tool');
        }

        let contentToDisplay = text;
        if (typeof text === 'string') {
            try {
                const parsedJson = JSON.parse(text);
                // Pretty print if it's an object or array, and not just a simple string/number that happens to be valid JSON
                if (typeof parsedJson === 'object' && parsedJson !== null) {
                    contentToDisplay = JSON.stringify(parsedJson, null, 2);
                    if (sender === 'assistant' || sender === 'tool') { // Add tool styling for JSON responses from assistant/tool
                        messageElement.classList.add('tool');
                    }
                }
            } catch (e) {
                // Not a JSON string, or simple JSON type, display as is
            }
        } else if (typeof text === 'object' && text !== null) {
             contentToDisplay = JSON.stringify(text, null, 2);
             if (sender === 'assistant' || sender === 'tool') { // Add tool styling for JSON
                messageElement.classList.add('tool');
            }
        }

        messageElement.textContent = contentToDisplay;
        chatLog.appendChild(messageElement);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    async function sendMessage() {
        const messageText = chatInput.value.trim();
        if (!messageText) return;

        appendMessage(messageText, 'user');
        const userInput = chatInput.value; // Store before clearing for SAK/NLP agent
        chatInput.value = '';
        sendButton.disabled = true;

        const thinkingMessageElement = document.createElement('div');
        thinkingMessageElement.classList.add('message', 'assistant', 'thinking');
        thinkingMessageElement.textContent = "Processing...";
        chatLog.appendChild(thinkingMessageElement);
        chatLog.scrollTop = chatLog.scrollHeight;

        let requestBody = {
            sessionId: sessionId,
            mode: currentMode,
            // message, command, argsString will be added based on mode
        };

        if (currentMode === 'SAK_AGENT' || currentMode === 'OKX_API_AGENT') { // Modified
            requestBody.message = userInput;
        } else { // OKX_TRADE_API or OKX_MARKET_API (direct commands)
            const parts = userInput.match(/^(\S+)\s*(.*)$/); // command and the rest as argsString
            if (parts && parts[1]) {
                requestBody.command = parts[1];
                requestBody.argsString = parts[2] || "";
            } else {
                appendMessage(`Invalid command format. Use 'command_name param1=value1 ...'`, 'assistant', true);
                if (chatLog.contains(thinkingMessageElement)) {
                    chatLog.removeChild(thinkingMessageElement);
                }
                sendButton.disabled = false;
                chatInput.focus();
                return;
            }
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (chatLog.contains(thinkingMessageElement)) {
                chatLog.removeChild(thinkingMessageElement);
            }

            if (!response.ok) {
                let errorText = `Error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorText = `Error: ${errorData.error || JSON.stringify(errorData.details || errorData)}`; // Include details if present
                } catch (e) { /* ignore if error response is not json */ }
                appendMessage(errorText, 'assistant', true); // Mark as system/error message
                return;
            }

            const data = await response.json();
            if (data.responses && Array.isArray(data.responses)) {
                data.responses.forEach(res => {
                    // For SAK agent, 'tool' role has specific styling.
                    // For OKX API agent, tool responses are embedded in assistant's flow,
                    // but the final content might be JSON.
                    const isSystemLike = res.role !== 'user' && res.role !== 'assistant' && res.role !== 'tool';
                    appendMessage(res.content, res.role, isSystemLike);
                });
            } else {
                appendMessage('Received an empty or malformed successful response.', 'assistant', true);
            }

        } catch (error) {
            console.error('Failed to send message (network or other client-side error):', error);
            if (chatLog.contains(thinkingMessageElement)) {
                chatLog.removeChild(thinkingMessageElement);
            }
            appendMessage('Error: Could not connect to the server or an unexpected error occurred. Check console.', 'assistant', true);
        } finally {
            sendButton.disabled = false;
            chatInput.focus();
        }
    }

    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // Initial setup
    setActiveButton(currentMode);
    fetchAndDisplayApiCommands(currentMode);
});