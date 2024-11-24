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

import ToolInvocation from './components/ToolInvocation';
import { motion, AnimatePresence } from "framer-motion";
import MoreMenu from './components/MoreMenu';

export interface Chat {
  id: number;
  title: string;
  messages: Array<{ id: string; role: "function" | "system" | "user" | "assistant" | "data" | "tool"; content: string; toolInvocations?: any[] }>;
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center w-full h-full">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

const handleResize = (isExpanded: boolean) => {
  if (window.electron) {
    const width = isExpanded ? window.innerWidth : 600;
    const height = isExpanded ? window.innerHeight : 400;
    window.electron.resizeWindow(width, height);
  }
};

const ExpandButton = ({ onClick, isExpanded }: { onClick: () => void; isExpanded: boolean }) => (
  <motion.button
    onClick={onClick}
    className="absolute bottom-6 right-6 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 text-base font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8 8 3.582 8 8zm-2 0c0 3.314-2.686 6-6 6s-6-2.686-6-6 2.686-6 6-6 6 2.686 6 6z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M10 12a1 1 0 01-1-1V7a1 1 0 112 0v4a1 1 0 01-1 1z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M7 10a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
    {isExpanded ? 'Minimize' : 'Expand Chat'}
  </motion.button>
);

function ChatContent({ chats, setChats, selectedChatId, setSelectedChatId, isExpanded, setIsExpanded, initialQuery }: {
  chats: Chat[],
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  selectedChatId: number,
  setSelectedChatId: React.Dispatch<React.SetStateAction<number>>,
  isExpanded: boolean,
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>,
  initialQuery?: string
}) {
  const chat = chats.find((c: Chat) => c.id === selectedChatId);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [isFinished, setIsFinished] = React.useState(false);
  const [hasInitialQueryBeenSent, setHasInitialQueryBeenSent] = React.useState(false);

  const { messages, input, handleInputChange, handleSubmit, append, stop } = useChat({
    api: getApiUrl("/reply"),
    initialMessages: chat?.messages || [],
    onFinish: () => {
      setIsFinished(true);
    },
    onResponse: (response) => {
      // Update the chat messages immediately when we get a response
      const updatedMessages = [...messages, response];
      const updatedChats = chats.map(c => 
        c.id === selectedChatId ? { ...c, messages: updatedMessages } : c
      );
      setChats(updatedChats);
    },
  });

  // Handle initial query when component mounts
  useEffect(() => {
    const sendInitialQuery = async () => {
      if (initialQuery && !hasInitialQueryBeenSent) {
        setHasInitialQueryBeenSent(true);
        const message = {
          content: initialQuery,
          role: "user",
        };
        await append(message);
      }
    };
    sendInitialQuery();
  }, [initialQuery, append, hasInitialQueryBeenSent]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Update chat messages when they change
  useEffect(() => {
    const updatedChats = chats.map(c => 
      c.id === selectedChatId ? { ...c, messages } : c
    );
    setChats(updatedChats);
  }, [messages, selectedChatId]);

  const lastToolInvocation = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.toolInvocations?.length) {
        return message.toolInvocations[message.toolInvocations.length - 1];
      }
    }
    return null;
  }, [messages]);

  const expandedContent = (
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
            <div className="block h-10" />
          </ScrollArea>
        )}

        <Input
          handleSubmit={handleSubmit}
          handleInputChange={handleInputChange}
          input={input}
        />
      </Card>
    </div>
  );

  const compactContent = (
    <Card className="w-full h-full flex flex-col items-center justify-center bg-card-gradient border-none shadow-xl rounded-2xl relative">
      {isInitialLoading ? (
        <LoadingSpinner />
      ) : lastToolInvocation && !isFinished ? (
        <div className="w-full h-full relative">
          <ToolInvocation
            key={lastToolInvocation.toolCallId}
            toolInvocation={lastToolInvocation}
          />
        </div>
      ) : isFinished ? (
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="text-lg font-medium text-gray-700">Goose has landed</div>
          </div>
        </div>
      ) : (
        <div className="text-gray-600 text-lg">Goose is getting a running start...</div>
      )}
    </Card>
  );

  return (
    <div className={`relative ${isExpanded ? 'w-screen h-screen' : 'w-[600px] h-[400px]'} overflow-hidden bg-transparent flex flex-col transition-all duration-300`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={isExpanded ? 'expanded' : 'compact'}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full"
        >
          {isExpanded ? expandedContent : compactContent}
        </motion.div>
      </AnimatePresence>
      <ExpandButton 
        onClick={() => {
          const newExpanded = !isExpanded;
          setIsExpanded(newExpanded);
          handleResize(newExpanded);
        }} 
        isExpanded={isExpanded} 
      />
    </div>
  );
}

export default function ChatWindow() {
  // Get initial query and history from URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get('initialQuery');
  const historyParam = searchParams.get('history');
  const initialHistory = historyParam ? JSON.parse(decodeURIComponent(historyParam)) : [];
  const [isExpanded, setIsExpanded] = useState(false);

  const [chats, setChats] = useState<Chat[]>(() => {
    const firstChat = {
      id: 1,
      title: initialQuery || 'Chat 1',
      messages: initialHistory.length > 0 ? initialHistory : []
    };
    return [firstChat];
  });

  const [selectedChatId, setSelectedChatId] = useState(1);

  window.electron.logInfo("ChatWindow loaded");

  return (
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
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            initialQuery={initialQuery}
          />
        }
      />
      <Route path="*" element={<Navigate to="/chat/1" replace />} />
    </Routes>
  );
}