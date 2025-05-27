# 🔮 OKXFi: AI-Powered OKX & Solana Interface

OKXFi provides an intelligent, conversational interface to interact with the OKX financial ecosystem and Solana DeFi. Leveraging advanced AI agents, it simplifies complex financial operations and data retrieval into natural language queries.


*   **📊 [Pitch Deck](https://gamma.app/docs/OKxFi-9ohgt2wi0ku95jx?mode=doc)**
*   **🎬 [Demo Video](https://drive.google.com/drive/u/2/folders/1MYzNp-Hx8hCfvyBQ1tmfRazE4Vij5ePZ)**


**✨ Core Features:**

*   **🧠 Dual NLP Agents:**
    *   **Solana Agent Kit Mode:** Converse with an AI agent to perform on-chain actions on the Solana network (e.g., guided token swaps, data fetching) using the Solana Agent Kit and its OKX DeFi plugin.
    *   **OKX API Agent (NLP) Mode:** Interact with a wide range of OKX HTTP APIs (Trade, Market, Balance, Transaction History) through natural language. The AI agent understands your requests, selects the appropriate API tool, and fetches the data.
*   **🖥️ Intuitive Chat Interface:** A clean, modern web interface built with Next.js (or Vite + React, as per your frontend) and Tailwind CSS for seamless user interaction.
*   **🗣️ Context-Aware Conversations:** Agents maintain context from previous interactions for follow-up questions and more natural dialogue.
*   **🔑 Simplified Financial Operations:** Lowers the technical barrier for accessing and utilizing DeFi protocols and financial data APIs.
*   **⚙️ Backend Power:** Robust backend built with Node.js (Express or Next.js API Routes) and TypeScript, handling agent logic, API authentication, and communication.

## 🛠️ Tech Stack

**Frontend:**

*   **Framework:** Next.js (or Vite + React)
*   **UI Components:** Shadcn UI 
*   **Styling:** Tailwind CSS
*   **Language:** TypeScript

**Backend:**

*   **Framework:** Node.js with Express.js (or Next.js API Routes)
*   **Language:** TypeScript
*   **AI/Agent Logic:** Langchain.js
*   **LLM:** OpenAI GPT-4o-mini (or your configured model)
*   **Solana Interaction:** Solana Agent Kit, @solana/web3.js
*   **OKX API Interaction:** Axios (for direct HTTP calls)
*   **Configuration:** Dotenv

**Database/Storage (Current):**

*   In-memory store for chat session history (for simplicity in this version).

## 📁 Project Structure

The project is structured into two main parts (assuming a separate frontend and backend):

1.  **`okxfi-frontend/`**: Contains all frontend code (Next.js or Vite/React), UI components, pages, and API call logic to the backend.
2.  **`okxfi-backend/`**: Houses the Node.js/Express server, all AI agent logic (SAK Agent, OKX API Agent), OKX API handlers, and utility functions.


## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   `pnpm` (or `npm`/`yarn`/`bun` as per your project setup)
*   An OpenAI API Key
*   OKX API Credentials (API Key, Secret Key, Passphrase, Project ID)
*   A Solana wallet private key (in base58) for the SAK agent and an RPC URL.

### Backend Setup (`okxfi-backend/`)

1.  **Clone the repository (if applicable) or navigate to the backend directory.**
2.  **Install dependencies:**
    ```bash
    cd okxfi-backend
    pnpm install # or npm install / yarn install / bun install
    ```
3.  **Set up environment variables:**
    *   Copy `.env.example` (if provided) or create a new `.env` file.
    *   Fill in your credentials:
        ```env
        PORT=3001 # Or your desired backend port
        OPENAI_API_KEY=sk-your-openai-api-key
        SOLANA_PRIVATE_KEY=your-wallet-private-key-in-base58
        RPC_URL=https://api.devnet.solana.com
        WALLET_ADDRESS=your-solana-public-wallet-address # Optional for some OKX API defaults
        OKX_API_KEY=your-okx-api-key
        OKX_SECRET_KEY=your-okx-secret-key
        OKX_API_PASSPHRASE=your-okx-api-passphrase
        OKX_PROJECT_ID=your-okx-project-id
        ```
4.  **Build the TypeScript code (for production):**
    ```bash
    pnpm build # or npm run build / yarn build / bun run build
    ```
5.  **Run the backend server:**
    *   For development (with auto-reloading):
        ```bash
        pnpm dev # or npm run dev / yarn dev / bun run dev
        ```
    *   For production (after building):
        ```bash
        pnpm start # or npm start / yarn start / bun start
        ```
    The backend should now be running, typically on `http://localhost:3001`.

### Frontend Setup (`okxfi-frontend/`)

(Based on your Vite + React + Shadcn UI setup)

1.  **Navigate to the frontend directory:**
    ```bash
    cd okxfi-frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install # or bun install / yarn install
    ```
3.  **Ensure API Endpoint Configuration:**
    *   In your frontend code (e.g., `src/pages/Index.tsx` or a constants file), verify the `backendUrl` correctly points to your running backend API (e.g., `http://localhost:3001/api/chat`).
4.  **Run the frontend development server:**
    ```bash
    npm run dev # or bun dev / yarn dev
    ```
    The frontend should now be accessible, typically on `http://localhost:8080`.

## 💬 Usage

1.  Open the frontend application in your browser.
2.  Select your desired interaction mode using the buttons at the top:
    *   **Solana Agent Kit:** For AI-driven interactions with Solana DeFi.
    *   **OKX API Agent (NLP):** For natural language queries to various OKX HTTP APIs.
3.  Type your requests or questions into the chat input and press Enter or click Send.

## 💡 How it Works (NLP Modes)

1.  The **Frontend** sends the user's natural language query and selected mode to the **Backend API**.
2.  The **Backend Server** routes the request to the appropriate AI agent (SAK Agent or OKX API Agent).
3.  The selected **Langchain Agent** processes the query:
    *   It uses an **LLM** (e.g., GPT-4o-mini) to understand intent and identify necessary parameters.
    *   It selects the most appropriate **Tool** (mapping to an SAK action or a direct OKX API call).
    *   If parameters are missing, it may ask the user for clarification.
    *   The tool is executed (performing a Solana transaction or an HTTP request to OKX).
4.  The agent formats the tool's output (or its own textual response) and sends it back to the frontend.
5.  The **Frontend** displays the conversation, including assistant responses and tool outputs (formatted for readability).
6.  **Chat history** is maintained per session, with tool outputs summarized for the LLM to manage context length effectively.

## 📈 Future Enhancements

*   💾 Persistent chat history (e.g., using a database like Redis or PostgreSQL).
*   ✍️ More sophisticated tool output summarization for the LLM.
*   ➕ Support for more OKX API endpoints and SAK actions.
*   📚 Advanced context management for very long conversations (e.g., sliding window, embedding-based retrieval).
*   🔐 User authentication for personalized experiences.
*   💨 Streaming responses for a more interactive feel.
*   ☁️ Deployment to a cloud platform.

## 🙌 Contributing

(Add guidelines here if you plan for others to contribute: e.g., fork the repo, create a branch, make changes, submit a pull request. Mention coding standards or testing procedures if any.)

*We welcome contributions! Please follow these steps:*
1.  *Fork the repository.*
2.  *Create a new branch (`git checkout -b feature/your-feature-name`).*
3.  *Make your changes and commit them (`git commit -m 'Add some feature'`).*
4.  *Push to the branch (`git push origin feature/your-feature-name`).*
5.  *Open a Pull Request.*

## 📄 License

This project is licensed under the [MIT License](LICENSE).
