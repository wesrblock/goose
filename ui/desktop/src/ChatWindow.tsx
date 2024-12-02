import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from './ai-sdk-fork/useChat';
import { Route, Routes, Navigate } from 'react-router-dom';
import { getApiUrl } from './config';
import { Card } from './components/ui/card';
import { ScrollArea } from './components/ui/scroll-area';
import Splash from './components/Splash';
import GooseMessage from './components/GooseMessage';
import UserMessage from './components/UserMessage';
import Input from './components/Input';
import MoreMenu from './components/MoreMenu';
import LoadingGoose from './components/LoadingGoose';
import { ApiKeyWarning } from './components/ApiKeyWarning';
import { askAi } from './utils/askAi';
import { WingView, Working } from './components/WingToWing';
// import fakeToolInvocations from './fixtures/tool-calls-and-results.json';

type DirectoryState = 'undecided' | 'default' | string;

export interface Chat {
  id: number;
  title: string;
  messages: Array<{
    id: string;
    role: 'function' | 'system' | 'user' | 'assistant' | 'data' | 'tool';
    content: string;
  }>;
}


// Custom fetch implementation
const customFetch = async (
  input: string | URL | globalThis.Request,
  init?: RequestInit
): Promise<Response> => {
  // Dynamically look up the API URL for every call
  let dynamicUrl = getApiUrl('/reply');
  if (!window.goosedPort) {
    // pause a sec to let goose start
    await new Promise((resolve) => setTimeout(resolve, 1000));
    dynamicUrl = getApiUrl('/reply');
  }
  // Pass through the request options unchanged
  return globalThis.fetch(dynamicUrl, init);
};

function ChatContent({
  chats,
  setChats,
  selectedChatId,
  setSelectedChatId,
  initialQuery,
  setProgressMessage,
  setWorking,
  setDirectory,
  directory,
}: {
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  selectedChatId: number;
  setSelectedChatId: React.Dispatch<React.SetStateAction<number>>;
  initialQuery: string | null;
  setProgressMessage: React.Dispatch<React.SetStateAction<string>>;
  setWorking: React.Dispatch<React.SetStateAction<Working>>;
  setDirectory: React.Dispatch<React.SetStateAction<DirectoryState>>;
  directory: DirectoryState;
}) {
  const chat = chats.find((c: Chat) => c.id === selectedChatId);

  const [messageMetadata, setMessageMetadata] = useState<Record<string, string[]>>({});

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    stop,
    isLoading,
    error,
  } = useChat({
    initialMessages: chat?.messages || [],
    onToolCall: ({ toolCall }) => {
      setWorking(Working.Working);
      setProgressMessage(`Executing tool: ${toolCall.toolName}`);
    },
    onResponse: (response) => {
      if (!response.ok) {
        setProgressMessage('An error occurred while receiving the response.');
        setWorking(Working.Idle);
      } else {
        setProgressMessage('thinking...');
        setWorking(Working.Working);
      }
    },
    fetch: customFetch,
    onFinish: async (message, options) => {
      setProgressMessage('Task finished. Click here to expand.');
      setWorking(Working.Idle);

      const promptTemplates = [
        "You are a simple classifier that takes content and decides if it is asking for input from a person before continuing if there is more to do, or not. These are questions on if a course of action should proceeed or not, or approval is needed. If it is a question very clearly, return QUESTION, otherwise READY. If it of the form of 'anything else I can do?' sort of question, return READY as that is not the sort of question we are looking for. ### Message Content:\n" + message.content + "\nYou must provide a response strictly limited to one of the following two words: QUESTION, READY. No other words, phrases, or explanations are allowed. Response:", 
        "You are a simple classifier that takes content and decides if it a list of options or plans to choose from, or not a list of options to choose from It is IMPORTANT that you really know this is a choice, just not numbered steps. If it is a list of options and you are 95% sure, return OPTIONS, otherwise return NO. ### Message Content:\n" + message.content + "\nYou must provide a response strictly limited to one of the following two words:OPTIONS, NO. No other words, phrases, or explanations are allowed. Response:",
        "If the content is list of distinct options or plans of action to choose from, and not just a list of things, but clearly a list of things to choose one from, taking into account the Message Content alone, try to format it in a json array, like this JSON array of objects of the form optionTitle:string, optionDescription:string (markdown).\n If is not a list of options or plans to choose from, then return empty list.\n ### Message Content:\n" + message.content + "\n\nYou must provide a response strictly as json in the format descriribed. No other words, phrases, or explanations are allowed. Response:",
      ];

      const fetchResponses = await askAi(promptTemplates);

      setMessageMetadata((prev) => ({ ...prev, [message.id]: fetchResponses }));
    },
  });

  // const messages = fakeToolInvocations;

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

  // if user starts typing without having picked a dir, we set to default
  const inputChangeHandler = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!window.goosedPort) {
      await setDirectory("default");
     }
    return handleInputChange(e);
  }

  return (
    <div className="chat-content flex flex-col w-screen h-screen bg-window-gradient items-center justify-center p-[10px]">
      <div className="relative block h-[20px] w-screen">
        <MoreMenu
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
      <Card className="flex flex-col flex-1 h-[calc(100vh-95px)] w-full bg-card-gradient mt-0 border-none shadow-xl rounded-2xl relative">
        {messages.length === 0 ? (
          <Splash append={append} setDirectory={setDirectory} directory={directory} />
        ) : (
          <ScrollArea className="flex-1 px-[10px]" id="chat-scroll-area">
            <div className="block h-10" />
            <div ref={(el) => {
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }
            }}>
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
            </div>
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <LoadingGoose />
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
          handleInputChange={inputChangeHandler}
          input={input}
          disabled={isLoading}
          isLoading={isLoading}
          onStop={stop}
        />
      </Card>
    </div>
  );
}

export default function ChatWindow() {
  // Type for directory state management
  type DirectoryState = 'undecided' | 'default' | string;

  // State for managing Goosed initialization and directory
  const [isGoosedStarted, setIsGoosedStarted] = useState(false);
  const [directory, setDirectory] = useState<DirectoryState>(window.appConfig.get("GOOSE_DIR"));

  // Function to initialize Goosed
  const initializeGoosed = useCallback(async () => {
    window.electron.logInfo(`Initializing Goosed...${directory} `);
    if (isGoosedStarted) {
      window.electron.logInfo('Goosed already started');
      return;
    }

    if (directory === 'undecided') {
      window.electron.logInfo('Waiting for directory state to be determined');
      return;
    }

    try {
      if (directory === 'default') {
        window.electron.logInfo('Starting Goosed server with default directory...');
        window.goosedPort = await window.electron.startGoosed();
        window.electron.logInfo(`Goosed started successfully on port ${window.goosedPort}`);
        window.directory = 'default';
        console.log("Goosed started successfully on port (from window)", window.goosedPort);
        setIsGoosedStarted(true);
      } else {
        window.electron.logInfo(`Starting Goosed server for directory: ${directory}...`);
        window.goosedPort = await window.electron.startGoosed(directory);
        window.directory = directory;
        window.electron.logInfo(`Goosed started successfully on port ${window.goosedPort}`);
        setIsGoosedStarted(true);
      }
    } catch (error) {
      console.log('Failed to start Goosed:', error);
      console.error('Failed to start Goosed:', error);
    }
  }, [isGoosedStarted, directory]);

  // Initialize Goosed only when directory state is determined
  useEffect(() => {
    // Only initialize if directory is set and Goosed hasn't started
    if (directory !== 'undecided' && !isGoosedStarted) {
      initializeGoosed();
    }
  }, [directory, initializeGoosed, isGoosedStarted]);


  // Add keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Command+N (Mac) or Control+N (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault(); // Prevent default browser behavior
        window.electron.createChatWindow();
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Check if API key is missing from the window arguments
  const apiCredsMissing = window.electron.getConfig().apiCredsMissing;

  // Get initial query and history from URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get('initialQuery');
  const historyParam = searchParams.get('history');
  const initialHistory = historyParam ? JSON.parse(decodeURIComponent(historyParam)) : [];

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

  const [working, setWorking] = useState<Working>(Working.Idle);
  const [progressMessage, setProgressMessage] = useState<string>('');

  const toggleMode = () => {
    const newMode = mode === 'expanded' ? 'compact' : 'expanded';
    console.log(`Toggle to ${newMode}`);
    setMode(newMode);
  };

  window.electron.logInfo('ChatWindow loaded');

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-transparent flex flex-col">
      <div className="titlebar-drag-region" />
      {apiCredsMissing ? (
        <div className="w-full h-full">
          <ApiKeyWarning className="w-full h-full" />
        </div>
      ) : (
        <>
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
                    setProgressMessage={setProgressMessage}
                    setWorking={setWorking}
                    setDirectory={setDirectory}
                    directory={directory}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/chat/1" replace />} />
            </Routes>
          </div>

          {/* Always render WingView but control its visibility */}
          <WingView onExpand={toggleMode} progressMessage={progressMessage} working={working} />
        </>
      )}
    </div>
  );
}
