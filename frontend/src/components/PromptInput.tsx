import React, { useState } from 'react';

interface PromptInputProps {
  onSubmit: (promptText: string) => void;
  isLoading: boolean;
}

const PromptInput: React.FC<PromptInputProps> = ({ onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt);
      setPrompt(''); // Clear input after submission
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask OKXFi..."
            className="w-full h-16 p-3 pr-24 bg-gray-900 border border-violet-500/30 rounded-lg font-inter text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-400 transition-all duration-200"
            rows={2}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white font-inter font-medium rounded text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PromptInput;