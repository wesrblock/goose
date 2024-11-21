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

export interface Chat {
  id: number;
  title: string;
  messages: Array<{ id: string; role: "function" | "system" | "user" | "assistant" | "data" | "tool"; content: string }>;
}

function stripMarkdownCodeBlocks(text: string): string {
  const jsonBlockRegex = /^```(?:json)?\n([\s\S]*?)```$/;
  const match = text.trim().match(jsonBlockRegex);
  return match ? match[1].trim() : text.trim();
}

function logResponseContent(content: any): void {
  console.log('Response content:', {
    type: content.type,
    rawContent: content,
    timestamp: new Date().toISOString()
  });
}

function ChatContent({ chats, setChats, selectedChatId, setSelectedChatId }: {
  chats: Chat[],
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  selectedChatId: number,
  setSelectedChatId: React.Dispatch<React.SetStateAction<number>>
}) {
  const chat = chats.find((c: Chat) => c.id === selectedChatId);
  const [messageMetadata, setMessageMetadata] = useState<Record<string, { schemaContent: any }>>({});
  const [inputValue, setInputValue] = useState('');


  const onFinish = async (message: any) => {
    console.log("Chat finished with message:", message);
    try {
      const promptTemplate = `Analyze the following text and determine if it matches one of these cases:
1. If it's asking for confirmation for goose to take action of a specific plan, respond with:
   {"type": "PlanConfirmation", "selectedPlan": {"id": "...", "name": "an optional prompt like: please confirm", "description": " a more detailed description of the plan"}}
2. If it's presenting multiple plans to choose from to take action, respond with:
   {"type": "PlanChoice", "plans": [{"id": "...", "name": "name of the option", "description": "more detailed description of the option"}, ...]}
3. If it requires much more complex input can't only if it the above cases, respond with:
   {"type": "ComplexInput", "complexInputReason": "explanation of what's needed"}
4. If it's a simple greeting or acknowledgment, respond with:
   {"status": "complete", "waitingForUser": true}
Content to analyze:
${message.content}
Generate ONLY the JSON response, no additional text:`;

      const response = await fetch(getApiUrl("/ask"), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptTemplate
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      console.log('Raw response from /ask:', data.response);

      try {
        const cleanedResponse = stripMarkdownCodeBlocks(data.response);
        console.log('Cleaned response:', cleanedResponse);
        const parsedContent = JSON.parse(cleanedResponse);
        logResponseContent(parsedContent);

        setMessageMetadata(prev => ({
          ...prev,
          [message.id]: { 
            schemaContent: parsedContent,
            onPlanSelect: (plan) => {
              setInputValue(plan.description);
            },
            onPlanConfirm: (plan) => {
              setInputValue(plan.description);
            }
          }
        }));
      } catch (parseError) {
        console.error('JSON Parse Error:', {
          error: parseError,
          rawResponse: data.response,
          errorMessage: parseError.message
        });
      }
    } catch (error) {
      console.error('Error getting feedback:', error);
    }
  };  

  const { messages, input, handleInputChange, handleSubmit, append } = useChat({
    api: getApiUrl("/reply"),
    initialMessages: chat?.messages || [], 
    onFinish
  });


  // Update chat messages when they change
  useEffect(() => {
    const updatedChats = chats.map(c => 
      c.id === selectedChatId ? { ...c, messages } : c
    );
    setChats(updatedChats);
  }, [messages, selectedChatId]);

  // Effect to sync input value with the chat input
  useEffect(() => {
    if (inputValue) {
      handleInputChange({ target: { value: inputValue } } as React.ChangeEvent<HTMLTextAreaElement>);
    }
  }, [inputValue]);

  return (
    <div className="flex flex-col w-screen h-screen bg-window-gradient items-center justify-center p-[10px]">
      <Tabs
        chats={chats}
        selectedChatId={selectedChatId}
        setSelectedChatId={setSelectedChatId}
        setChats={setChats}
      />

      <Card className="flex flex-col flex-1 h-[calc(100vh-95px)] w-full bg-card-gradient mt-0 border-none shadow-xl rounded-2xl rounded-tl-none">
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
                  <GooseMessage message={message}
                                metadata={messageMetadata[message.id]} />
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