import React, { useState } from 'react';
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Chat from './Chat';
import SpotlightInput from './SpotlightInput';

export default function App() {
  const initialChats = [
    { id: 1, title: 'Chat 1', messages: [] },
  ]

  const [chats, setChats] = useState(initialChats)
  const [selectedChatId, setSelectedChatId] = useState(1)
  
  // Check if this is the spotlight window
  const searchParams = new URLSearchParams(window.location.search);
  const isSpotlight = searchParams.get('window') === 'spotlight';

  // If this is the spotlight window, only render the SpotlightInput
  if (isSpotlight) {
    return <SpotlightInput />;
  }

  // Otherwise render the main app with all routes
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-b from-white to-gray-50 flex flex-col">
      <Routes>
        <Route
          path="/chat/:id"
          element={<Chat key={selectedChatId} chats={chats} setChats={setChats} selectedChatId={selectedChatId} setSelectedChatId={setSelectedChatId} />}
        />
        <Route path="*" element={<Navigate to="/chat/1" replace />} />
      </Routes>
    </div>
  );
}