import React, { useState } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import Chat from './Chat';

export interface Chat {
  id: number;
  title: string;
  messages: Array<{ id: number; role: string; content: string }>;
}

export default function App() {
  const initialChats: Chat[] = [
    { id: 1, title: 'Chat #1', messages: [] },
  ]

  const [chats, setChats] = useState(initialChats)
  const [selectedChatId, setSelectedChatId] = useState(1)

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-b from-white to-gray-50 p-4 flex flex-col">
      <Routes>
        <Route
          path="/chat/:id"
          element={<Chat chats={chats} setChats={setChats} selectedChatId={selectedChatId} setSelectedChatId={setSelectedChatId} />}
        />
        <Route path="*" element={<Navigate to="/chat/1" replace />} />
      </Routes>
    </div>
  );
}