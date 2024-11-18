import React, { useState, useEffect } from 'react';

export default function SpotlightInput() {
  const [query, setQuery] = useState('');

  useEffect(() => {
    // Focus the input when the component mounts
    const input = document.getElementById('spotlight-input');
    if (input) {
      input.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle the query submission here
    console.log('Submitted query:', query);
    setQuery('');
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-transparent">
      <form 
        onSubmit={handleSubmit}
        className="w-[600px] bg-black/80 backdrop-blur-lg rounded-lg shadow-lg p-4"
      >
        <input
          id="spotlight-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-white text-xl px-4 py-2 outline-none placeholder-gray-400"
          placeholder="Type a command..."
          autoFocus
        />
      </form>
    </div>
  );
}