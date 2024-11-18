import React from 'react';
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Plus from './ui/Plus';

export default function Tabs({ chats, selectedChatId, setSelectedChatId, setChats }) {
  const navigate = useNavigate()
  const navigateChat = (chatId: number) => {
    setSelectedChatId(chatId)
    navigate(`/chat/${chatId}`)
  }

  const addChat = () => {
    const newChatId = chats[chats.length-1].id + 1;
    const newChat = {
      id: newChatId,
      title: `Chat ${newChatId}`,
      messages: [],
    };
    setChats([...chats, newChat]);
    navigateChat(newChatId);
  };

  const removeChat = (chatId: number) => {
    const updatedChats = chats.filter((chat: any) => chat.id !== chatId);
    setChats(updatedChats);
    navigateChat(updatedChats[0].id);
  };

  return (
    <div className="flex flex-0 items-center justify-start relative pb-0 w-full ml-[145px]">
      {chats.map((chat) => (
        <div
          key={chat.id}
          className={`flex bg-tab items-center min-w-[140px] max-w-[240px] h-[32px] px-3 mr-1 rounded-t-lg cursor-pointer transition-all`}
          onClick={() => navigateChat(chat.id)}
          onKeyDown={(e) => e.key === "Enter" && navigateChat(chat.id)}
          tabIndex={0}
          role="tab"
          aria-selected={selectedChatId === chat.id}
        >
          <span className="flex-grow truncate text-sm font-medium">{chat.title}</span>
          {chats.length > 1 && (
            <button
              className="ml-2 p-1 rounded-full hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              onClick={(e) => {
                e.stopPropagation();
                removeChat(chat.id);
              }}
              aria-label={`Close chat ${chat.id}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      <button onClick={addChat} aria-label="New chat">
        <Plus size={18} />
      </button>
    </div>
  );
}
