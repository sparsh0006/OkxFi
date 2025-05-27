import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type AgentMode = 'SAK_AGENT_NLP' | 'OKX_API_AGENT_NLP';

interface NavigationProps {
  currentMode: AgentMode;
  onModeChange: (newMode: AgentMode) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentMode, onModeChange }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleModeButtonClick = (mode: AgentMode) => {
    onModeChange(mode);
    setIsDropdownOpen(false); // Close dropdown if open
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-violet-500/30 shadow-sm">
      <div className="flex justify-center items-center h-16 px-4">
        <div className="flex items-center space-x-8">
          <button
            onClick={() => handleModeButtonClick('SAK_AGENT_NLP')}
            className={`px-6 py-2.5 border rounded-lg font-inter font-medium transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-2 ${
              currentMode === 'SAK_AGENT_NLP'
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white border-violet-300/50 ring-violet-500/30'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600 ring-gray-500/30'
            }`}
          >
            Solana Agent Kit
          </button>
          <button
            onClick={() => handleModeButtonClick('OKX_API_AGENT_NLP')}
            className={`px-6 py-2.5 border rounded-lg font-inter font-medium transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-2 ${
              currentMode === 'OKX_API_AGENT_NLP'
                ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white border-purple-300/50 ring-purple-500/30'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600 ring-gray-500/30'
            }`}
          >
            OKX API Agent (NLP)
          </button>
          {/* Removed direct API mode buttons as per your focus on NLP */}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;