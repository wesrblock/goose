import React, { useEffect, useRef, useState } from 'react';
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
import { BoxIcon } from './components/ui/icons';
import ReactMarkdown from 'react-markdown';

export interface Chat {
  id: number;
  title: string;
  messages: Array<{
    id: string;
    role: 'function' | 'system' | 'user' | 'assistant' | 'data' | 'tool';
    content: string;
  }>;
}

const WingView: React.FC<{ onExpand: () => void; status: string }> = ({ onExpand, status }) => {
  return (
  <div
    onClick={onExpand}
    className="flex items-center w-full h-20 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-300 shadow-md rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all duration-200">      
      {/* SVG Icon */}
        <div className="w-10 h-10 mr-4 flex-shrink-0">
      <svg width="45" height="39" viewBox="0 0 45 39" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M26.4047 17.9373C27.3193 17.5522 28.3302 17.3596 29.293 17.6003C29.7791 17.7218 30.4615 18.1747 31.111 18.6057C31.748 19.0283 32.3532 19.43 32.7107 19.4777C33.0285 19.52 33.4581 19.4971 33.8805 19.4746C34.4182 19.446 34.9443 19.418 35.2139 19.5258C35.4268 19.611 35.6304 19.9223 35.8537 20.2638C36.1351 20.6942 36.4479 21.1727 36.8506 21.3069C37.0202 21.3634 37.2005 21.412 37.3721 21.4583C37.9307 21.6088 38.3967 21.7343 38.1021 22.0289C37.717 22.414 35.3583 22.6547 35.1176 22.5585C34.9949 22.5094 35.0098 22.3852 35.0284 22.2306C35.0463 22.082 35.0676 21.9053 34.9732 21.7401C34.8829 21.5821 34.708 21.3289 34.5426 21.0896C34.3554 20.8185 34.1804 20.5652 34.1549 20.4885C33.9623 20.3441 33.144 20.1997 33.144 20.3923C33.144 20.5848 33.3847 21.9808 33.5772 22.1734C33.6063 22.2024 33.6354 22.2304 33.6628 22.2568C33.8169 22.4051 33.9187 22.503 33.6735 22.4622C33.3847 22.414 31.748 21.7401 31.2185 21.2106C30.689 20.6811 29.9188 19.959 29.2448 19.959C28.871 19.959 27.9491 21.1144 27.0625 22.2255C26.3509 23.1174 25.662 23.9808 25.2976 24.1951C24.4792 24.6765 21.7835 25.7837 20.2431 25.8799C18.7027 25.9762 16.8254 25.9762 16.7772 25.4948C16.7291 25.0135 16.9217 24.5802 17.6437 24.6765C18.3658 24.7728 24.2867 23.6656 25.9234 21.9808C26.3025 21.5905 26.612 21.2802 26.8612 21.0304C27.6877 20.2016 27.8524 20.0365 27.7044 19.8146C27.6538 19.7386 27.5032 19.5927 27.3183 19.4135C26.8006 18.9119 26.0145 18.1501 26.4047 17.9373ZM34.8264 20.5249C34.8275 20.5419 34.8288 20.5615 34.8288 20.5848C34.8288 20.7292 34.8769 20.8255 35.0213 20.8736C35.1657 20.9218 35.262 20.7292 35.2139 20.5848C35.1657 20.4404 35.1176 20.296 35.0213 20.296C34.8195 20.4171 34.8207 20.4366 34.8264 20.5249Z" fill="#7F7F7F"/>
<path d="M25.8272 13.4604C26.5492 14.1343 25.8272 17.167 25.779 17.3595C25.5615 18.2298 24.0352 17.619 23.565 16.8551C23.3126 16.4449 23.1018 15.9636 23.0833 15.4822C23.0352 14.2306 22.3131 13.0272 22.1206 12.4495C21.928 11.8719 19.5212 10.9573 18.414 10.6684C17.3068 10.3796 17.1143 8.3097 17.2587 8.02087C17.4031 7.73205 21.4948 10.524 23.0833 11.2461C24.6719 11.9681 25.1051 12.7865 25.8272 13.4604Z" fill="#7F7F7F"/>
<path d="M16.5848 24.0024C16.2478 24.0024 16.0553 24.195 15.6702 24.8208C15.253 25.3824 14.3704 26.5441 14.1779 26.6981C13.9372 26.8907 13.7447 26.5056 13.0707 26.4575C12.3968 26.4093 11.771 27.5646 11.4822 27.9016C11.1934 28.2385 12.7819 28.3348 14.3704 27.5646C15.959 26.7944 16.8255 24.7245 16.9699 24.3875C17.1143 24.0506 16.9217 24.0024 16.5848 24.0024Z" fill="#7F7F7F"/>
<path d="M20.2432 12.3532C21.4948 12.8827 21.8317 13.6529 21.8799 14.8563C21.9912 17.6399 22.2769 20.3073 19.7272 21.4296C17.9018 22.2331 16.1005 22.9204 15.7664 23.0397C15.0925 23.2804 14.6593 23.5211 14.3704 23.9062C14.0816 24.2913 14.5149 24.3876 14.7555 24.7727C14.9962 25.1578 14.0816 25.6391 13.2151 25.591C12.3487 25.5429 11.1934 24.8208 11.1452 24.195C11.0971 23.5692 13.4558 22.9434 14.3704 22.7027C15.2851 22.4621 16.5848 21.1623 17.4031 20.8254C18.2214 20.4884 17.3068 20.681 17.0661 20.4403C16.8255 20.1996 16.6329 19.0924 16.5848 18.5629C16.5366 18.0334 15.959 17.1669 15.7664 16.9262C15.5739 16.6856 18.1733 16.83 18.2696 16.6374C18.3659 16.4449 16.5848 16.493 15.4295 16.3005C14.2742 16.1079 13.7928 15.3377 13.6484 15.097C13.504 14.8563 17.7401 15.5784 17.9808 15.3377C18.2214 15.097 16.1997 15.097 15.2369 14.9045C14.2742 14.7119 13.3114 14.5194 12.83 14.1824C12.3487 13.8455 11.9154 13.0271 12.3005 13.2197C12.6856 13.4122 17.4031 14.2787 17.7401 14.0861C18.077 13.8936 12.9263 12.7383 12.1561 12.4495C11.3859 12.1606 10.712 10.8128 10.6157 10.524C10.5194 10.2351 11.7229 11.1016 12.3005 11.2942L12.3005 11.2942C12.8782 11.4867 16.9217 12.8346 17.4031 12.7383C17.8845 12.642 13.3596 11.0535 12.0598 10.524C10.7601 9.99446 10.375 8.5022 10.2788 8.1171C10.1825 7.732 11.3859 8.55034 12.0598 8.98357C12.7338 9.41681 18.9916 11.8237 20.2432 12.3532Z" fill="#7F7F7F"/>
</svg>

      </div>
      

      {/* Status Text */}
      <div className="flex flex-col text-left">
        <span className="text-sm text-gray-600 font-medium">{status}</span>
      </div>
    </div>
  );
};


function ChatContent({
  chats,
  setChats,
  selectedChatId,
  setSelectedChatId,
  initialQuery,
  setStatus,
}: {
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  selectedChatId: number;
  setSelectedChatId: React.Dispatch<React.SetStateAction<number>>;
  initialQuery: string | null;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
}) {
  const chat = chats.find((c: Chat) => c.id === selectedChatId);

  //window.electron.logInfo('chats' + JSON.stringify(chats, null, 2));

  const [messageMetadata, setMessageMetadata] = useState<Record<string, string[]>>({});

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
    api: getApiUrl('/reply'),
    initialMessages: chat?.messages || [],
    onToolCall: ({ toolCall }) => {
      setStatus(`Executing tool: ${toolCall.toolName}`);
      // Optionally handle tool call result here
    },
    onResponse: (response) => {
      if (!response.ok) {
        setStatus('An error occurred while receiving the response.');
      } else {
        setStatus('Receiving response...');
      }
    },
    onFinish: async (message, options) => {
      setStatus('Goose is ready');

      const promptTemplates = [
        "Take a look at this content, if this looks like it could be asking for a confirmation, return QUESTION. If it looks like it is a list of options or plans to choose from, return OPTIONS. It can't just be a list, but clearly must be asking the user to pick one or more of the plan or option alternatives, otherwise return READY. \n ### Message Content:\n" + message.content,
        "If the content is clearly a list of distinct options or plans of action to choose from, and not just a list of things, but clearly a list of things to choose one from from, taking into account the Message Content alone, try to format it in a json array, like this JSON array of objects of the form optionTitle:string, optionDescription:string (markdown).\n If is not a list of options or plans to choose from, then return empty list.\n ### Message Content:\n" + message.content,
      ];

      const fetchResponses = await askAi(promptTemplates);

      setMessageMetadata(prev => ({ ...prev, [message.id]: fetchResponses }));

      console.log('All responses:', fetchResponses);
    },
  });

  // Update chat messages when they change
  useEffect(() => {
    const updatedChats = chats.map((c) =>
      c.id === selectedChatId ? { ...c, messages } : c
    );
    setChats(updatedChats);
  }, [messages, selectedChatId]);

  const initialQueryAppended = useRef(false);
  useEffect(() => {
    if (initialQuery && !initialQueryAppended.current) {
      append({ role: 'user', content: initialQuery });
      initialQueryAppended.current = true;
    }
  }, [initialQuery]);

  if (error) {
    console.log('Error:', error);
  }

  return (
    <div className="chat-content flex flex-col w-screen h-screen bg-window-gradient items-center justify-center p-[10px]">
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
          <MoreMenu
            className="absolute top-2 right-2"
            onStopGoose={() => {
              stop();
            }}
            onClearContext={() => {
              append({
                id: Date.now().toString(),
                role: 'system',
                content: 'Context cleared',
              });
            }}
            onRestartGoose={() => {
              append({
                id: Date.now().toString(),
                role: 'system',
                content: 'Goose restarted',
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
                  <GooseMessage
                    message={message}
                    messages={messages}
                    metadata={messageMetadata[message.id]}
                    append={append}
                  />
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
                  {error.message|| 'An error occurred while processing your request'}
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
  //window.electron.logInfo('initialQuery: ' + initialQuery);
  const historyParam = searchParams.get('history');
  const initialHistory = historyParam
    ? JSON.parse(decodeURIComponent(historyParam))
    : [];

  const [chats, setChats] = useState<Chat[]>(() => {
    const firstChat = {
      id: 1,
      title: initialQuery || 'Chat 1',
      messages: initialHistory.length > 0 ? initialHistory : [],
    };
    return [firstChat];
  });

  const [selectedChatId, setSelectedChatId] = useState(1);

  const [mode, setMode] = useState<'expanded' | 'compact'>(
    initialQuery ? 'compact' : 'expanded'
  );

  const [status, setStatus] = useState('Goose is ready');

  const toggleMode = () => {
    const newMode = mode === 'expanded' ? 'compact' : 'expanded';
    console.log(`Toggle to ${newMode}`);
    setMode(newMode);
  };

  window.electron.logInfo('ChatWindow loaded');

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-transparent flex flex-col">
      {/* Always render ChatContent but control its visibility */}
      <div style={{ display: mode === 'expanded' ? 'block' : 'none' }}>
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
                initialQuery={initialQuery}
                setStatus={setStatus} // Pass setStatus to ChatContent
              />
            }
          />
          <Route path="*" element={<Navigate to="/chat/1" replace />} />
        </Routes>
      </div>

      {/* Always render WingView but control its visibility */}
      <WingView onExpand={toggleMode} status={status} />
    </div>
  );
}

/**
 * Utillity to ask the LLM any question to clarify without wider context.
 */
async function askAi(promptTemplates: string[]) {
  console.log('askAi called...');
  const responses = await Promise.all(promptTemplates.map(async (template) => {
    const response = await fetch(getApiUrl('/ask'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: template })
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    const data = await response.json();
    console.log('ask Response:', data.response);

    return data.response;
  }));

  return responses;
}
