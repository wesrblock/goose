import React from 'react';
import { getApiUrl } from './config';
import { useChat } from 'ai/react';
import { Card } from "./components/ui/card"
import type { Chat } from './ChatWindow';
import ToolInvocation from './components/ToolInvocation';

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
      // The onFinish callback is triggered when a finish message part is received
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
    // Show loading state for a brief moment
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [initialQuery]);

  // Get the most recent tool invocation
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
    // Create URL with chat history
    const chatHistory = encodeURIComponent(JSON.stringify(messages));
    window.open(`/chat/1?history=${chatHistory}`, '_blank');
  };

  return (
    <div className="fixed inset-0 p-[10px] overflow-auto bg-window-gradient">
      <Card className="w-full h-full flex flex-col items-center justify-center bg-card-gradient border-none shadow-xl rounded-2xl">
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
            <button
              onClick={handleOpenChat}
              className="px-8 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 text-lg font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              Continue in Goose
            </button>
          </div>
        ) : (
          <div className="text-gray-600 text-lg">Goose is getting a running start...</div>
        )}
      </Card>
    </div>
  );
}