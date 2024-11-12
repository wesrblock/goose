import React, { useState } from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import Home from './Home'
import Chat from './Chat'

export default function App() {
  const initialChats = [
    { id: 1, title: 'Web app', messages: [] },
    { id: 2, title: 'Python notebook', messages: [] },
    { id: 3, title: 'GraphQL server', messages: [] },
  ]

  const [chats, setChats] = useState(initialChats)
  const [selectedChatId, setSelectedChatId] = useState(null)

  const onSelectChat = (chatId: string) => {
    setSelectedChatId(chatId)
    if (chatId === 'new') {
      const newChatId = chats.length + 1
      setChats([...chats, { id: newChatId, title: `Chat ${newChatId}`, messages: [] }])
      setSelectedChatId(newChatId)
    }
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-pink-300 via-purple-300 to-indigo-400">
      <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1IiBoZWlnaHQ9IjUiPgo8cmVjdCB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPC9zdmc+')]"></div>
      <Router>
        <Routes>
          <Route path="/" element={<Home chats={chats} setChats={setChats} onSelectChat={onSelectChat} />} />
          <Route path="/chat/:id" element={<Chat chats={chats} setChats={setChats} selectedChatId={selectedChatId} setSelectedChatId={setSelectedChatId} />} />
        </Routes>
      </Router>
    </div>
  )
}