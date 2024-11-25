import React, { useEffect, useState } from 'react';
import { useChat } from 'ai/react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { getApiUrl } from './config';
import { Card } from './components/ui/card';
import { ScrollArea } from './components/ui/scroll-area';
import Splash from './components/Splash';
import GooseMessage from './components/GooseMessage';
import UserMessage from './components/UserMessage';
import Input from './components/Input';
import Tabs from './components/Tabs';
import MoreMenu from './components/MoreMenu';

export interface Chat {
  id: number;
  title: string;
  messages: Array<{ id: string; role: "function" | "system" | "user" | "assistant" | "data" | "tool"; content: string }>;
}

function ChatContent({ chats, setChats, selectedChatId, setSelectedChatId }: {
  chats: Chat[],
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  selectedChatId: number,
  setSelectedChatId: React.Dispatch<React.SetStateAction<number>>
}) {
  const chat = chats.find((c: Chat) => c.id === selectedChatId);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    stop,
    isLoading,
    error
  } = useChat({
    api: getApiUrl("/reply"),
    initialMessages: chat?.messages || []
  });

  // Update chat messages when they change
  useEffect(() => {
    const updatedChats = chats.map(c => 
      c.id === selectedChatId ? { ...c, messages } : c
    );
    setChats(updatedChats);
  }, [messages, selectedChatId]);

  return (
    <div className="flex flex-col w-screen h-screen bg-window-gradient items-center justify-center p-[10px]">
      <div className="flex w-screen">
        <div className="flex-1">
          <Tabs
            chats={chats}
            selectedChatId={selectedChatId}
            setSelectedChatId={setSelectedChatId}
            setChats={setChats}
          />
        </div>
        <div className="flex">
          <MoreMenu className="absolute top-2 right-2"
            onStopGoose={() => {
              stop()
            }}
            onClearContext={() => {
              // TODO - Implement real behavior
              append({
                id: Date.now().toString(),
                role: 'system',
                content: 'Context cleared'
              });
            }}
            onRestartGoose={() => {
              // TODO - Implement real behavior
              append({
                id: Date.now().toString(),
                role: 'system',
                content: 'Goose restarted'
              });
            }}
          />
        </div>
      </div>
      <Card className="flex flex-col flex-1 h-[calc(100vh-95px)] w-full bg-card-gradient mt-0 border-none shadow-xl rounded-2xl relative">
        {messages.length === 0 ? (
          <Splash append={append} />
        ) : (
          <ScrollArea className="flex-1 px-[10px]">
            <div className="block h-10" />
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === 'user' ? (
                  <UserMessage message={message} />
                ) : (
                  <GooseMessage message={message} />
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center p-4">
                <div className="text-red-500 bg-red-100 p-3 rounded-lg">
                  {error.message || 'An error occurred while processing your request'}
                </div>
              </div>
            )}
            <div className="block h-10" />
          </ScrollArea>
        )}

        <Input
          handleSubmit={handleSubmit}
          handleInputChange={handleInputChange}
          input={input}
          disabled={isLoading}
        />
      </Card>
    </div>
  );
}

export default function ChatWindow() {
  // Get initial query and history from URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get('initialQuery');
  const historyParam = searchParams.get('history');
  const initialHistory = historyParam ? JSON.parse(decodeURIComponent(historyParam)) : [];

  const [chats, setChats] = useState<Chat[]>(() => {
    const firstChat = {
      id: 1,
      title: initialQuery || 'Chat 1',
      messages: initialHistory.length > 0 ? initialHistory : 
        (initialQuery ? [{
          id: '0',
          role: 'user' as const,
          content: initialQuery
        }] : [])
    };
    return [firstChat];
  });

  const [selectedChatId, setSelectedChatId] = useState(1);

  window.electron.logInfo("ChatWindow loaded");

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-transparent flex flex-col">
      <Routes>
        <Route
          path="/chat/:id"
          element={
            <ChatContent
              key={selectedChatId}
              chats={chats}
              setChats={setChats}
              selectedChatId={selectedChatId}
              setSelectedChatId={setSelectedChatId}
            />
          }
        />
        <Route path="*" element={<Navigate to="/chat/1" replace />} />
      </Routes>
    </div>
  );
}