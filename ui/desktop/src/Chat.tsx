import React, { useEffect } from 'react'
import { useChat } from 'ai/react'
import { useNavigate } from 'react-router-dom'
import { getApiUrl } from './config'
import { X, Plus } from 'lucide-react'
import { Card } from './components/ui/card'
import { ScrollArea } from './components/ui/scroll-area'
import GooseSplashLogo from './components/GooseSplashLogo'
import GooseMessage from './components/GooseMessage'
import UserMessage from './components/UserMessage'
import Input from './components/Input'

export interface Chat {
  id: number;
  title: string;
  messages: Array<{ id: string; role: any; content: string }>;
}

export default function Chat({ chats, setChats, selectedChatId, setSelectedChatId } : { chats: Chat[], setChats: any, selectedChatId: number, setSelectedChatId: any }) {
  const navigate = useNavigate()
  const chat = chats.find((c: Chat) => c.id === selectedChatId);

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: getApiUrl("/reply"),
    initialMessages: chat.messages
  })

  const useChatData = { messages, input, handleInputChange, handleSubmit };

  useEffect(() => {
    const updatedChats = [...chats]
    updatedChats.find((c) => c.id === selectedChatId).messages = messages
    setChats(updatedChats)
  }, [messages, selectedChatId])

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
    <div className="flex flex-col w-screen h-screen bg-window-gradient items-center justify-center p-[10px]">
      <div className="flex flex-0 items-center justify-start relative pb-0 w-full">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`flex bg-tab items-center min-w-[140px] max-w-[240px] h-8 px-3 mr-1 rounded-t-lg cursor-pointer transition-all`}
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
        <button
          className="flex items-center justify-center w-8 h-8 rounded-full bg-transparent hover:bg-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
          onClick={addChat}
          aria-label="New chat"
        >
          <Plus className="w-5 h-5 text-sky-600" />
        </button>
      </div>

      <Card className="flex flex-col flex-1 h-[calc(100vh-95px)] w-full bg-card-gradient mt-0 border-none shadow-xl rounded-2xl rounded-tl-none">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex items-center">
              <GooseSplashLogo />
              <span className="ask-goose-type ml-[8px]">ask<br />goose</span>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-[10px]">
            <div className="block h-10" />
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === 'user' ? (
                  <UserMessage message={message} />
                ) : (
                  <GooseMessage message={message} useChatData={useChatData} />
                )}
              </div>
            ))}
            <div className="block h-10" />
          </ScrollArea>
        )}

        <Input handleSubmit={handleSubmit} handleInputChange={handleInputChange} input={input} />
      </Card>
    </div>
  )
}