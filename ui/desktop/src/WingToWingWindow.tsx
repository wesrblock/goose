import React from 'react';
import { getApiUrl } from './config';
import { useChat } from 'ai/react';
import { Card } from "./components/ui/card"
import type { Chat } from './ChatWindow';
import ToolInvocation from './components/ToolInvocation';
import { motion } from "framer-motion";

interface FinishMessagePart {
  finishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center w-full h-full">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

const ChatButton = ({ onClick }: { onClick: () => void }) => (
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
    Open in Chat
  </motion.button>
);

export default function WingToWingWindow() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get('initialQuery');
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [isFinished, setIsFinished] = React.useState(false);

  const chat: Chat = {
    id: 1,
    title: initialQuery,
    messages: [],
  };

  const { messages, append } = useChat({
    api: getApiUrl("/reply"),
    initialMessages: chat.messages,
    onFinish: (message) => {
      setIsFinished(true);
    },
  });

  React.useEffect(() => {
    if (initialQuery) {
      append({
        id: '0',
        content: initialQuery,
        role: 'user',
      });
    }
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [initialQuery]);

  const lastToolInvocation = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.toolInvocations?.length) {
        return message.toolInvocations[message.toolInvocations.length - 1];
      }
    }
    return null;
  }, [messages]);

  const handleOpenChat = () => {
    window.electron.transitionToChat(messages);
  };

  return (
    <div className="fixed inset-0 p-[10px] overflow-auto bg-window-gradient">
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
        
        <ChatButton onClick={handleOpenChat} />
      </Card>
    </div>
  );
}