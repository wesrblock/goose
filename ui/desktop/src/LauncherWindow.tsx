import React, { useState, useRef } from 'react';

declare global {
  interface Window {
    goosedPort: number;
    directory?: string;
    electron: {
      hideWindow: () => void;
      listRecent: () => Promise<string[]>;
      createChatWindow: (query?: string, dir?: string) => void;
      startGoosed: (dir?: string) => number;
      logInfo: (info: string) => void;
    };
  }
}

export default function SpotlightWindow() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const dir = window.appConfig.get("GOOSE_DIR");
      window.electron.logInfo('launcher dir ' + dir);
      // Create a new chat window with the query
      window.electron.createChatWindow(query, dir);
      setQuery('');
      inputRef.current.blur()
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-transparent overflow-hidden">
      <form
        onSubmit={handleSubmit}
        className="w-[600px] bg-white/80 backdrop-blur-lg rounded-lg shadow-lg p-4"
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-black text-xl px-4 py-2 outline-none placeholder-gray-400"
          placeholder="Type a command..."
          autoFocus
        />
      </form>
    </div>
  );
}