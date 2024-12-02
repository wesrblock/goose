import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../ai-sdk-fork/useChat';
import { getApiUrl } from '../config';
import ChatArea from './ChatArea';
import { Chat } from '../ChatWindow';

interface ChatContentProps {
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  selectedChatId: number;
  initialQuery: string | null;
  setProgressMessage: React.Dispatch<React.SetStateAction<string>>;
  setWorking: React.Dispatch<React.SetStateAction<'Idle' | 'Working'>>;
  setDirectory: React.Dispatch<React.SetStateAction<'undecided' | 'default' | string>>;
  directory: 'undecided' | 'default' | string;
}

export default function ChatContent({
  chats,
  setChats,
  selectedChatId,
  initialQuery,
  setProgressMessage,
  setWorking,
  setDirectory,
  directory,
}: ChatContentProps) {
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
    api: getApiUrl('/reply'),
    initialMessages: chat?.messages || [],
    onToolCall: ({ toolCall }) => {
      setWorking('Working');
      setProgressMessage(`Executing tool: ${toolCall.toolName}`);
    },
    onResponse: (response) => {
      if (!response.ok) {
        setProgressMessage('An error occurred while receiving the response.');
        setWorking('Idle');
      } else {
        setProgressMessage('thinking...');
        setWorking('Working');
      }
    },
    onFinish: async (message) => {
      setProgressMessage('Task finished. Click here to expand.');
      setWorking('Idle');

      const promptTemplates = [
        "You are a simple classifier that takes content and decides if it is asking for input from a person before continuing if there is more to do, or not. These are questions on if a course of action should proceeed or not, or approval is needed. If it is a question very clearly, return QUESTION, otherwise READY. If it of the form of 'anything else I can do?' sort of question, return READY as that is not the sort of question we are looking for. ### Message Content:\n" + message.content + "\nYou must provide a response strictly limited to one of the following two words: QUESTION, READY. No other words, phrases, or explanations are allowed. Response:", 
        "You are a simple classifier that takes content and decides if it a list of options or plans to choose from, or not a list of options to choose from It is IMPORTANT that you really know this is a choice, just not numbered steps. If it is a list of options and you are 95% sure, return OPTIONS, otherwise return NO. ### Message Content:\n" + message.content + "\nYou must provide a response strictly limited to one of the following two words:OPTIONS, NO. No other words, phrases, or explanations are allowed. Response:",
        "If the content is list of distinct options or plans of action to choose from, and not just a list of things, but clearly a list of things to choose one from, taking into account the Message Content alone, try to format it in a json array, like this JSON array of objects of the form optionTitle:string, optionDescription:string (markdown).\n If is not a list of options or plans to choose from, then return empty list.\n ### Message Content:\n" + message.content + "\n\nYou must provide a response strictly as json in the format descriribed. No other words, phrases, or explanations are allowed. Response:",
      ];

      const fetchResponses = await askAi(promptTemplates);
      setMessageMetadata((prev) => ({ ...prev, [message.id]: fetchResponses }));
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

  return (
    <ChatArea
      messages={messages}
      isLoading={isLoading}
      error={error}
      input={input}
      handleInputChange={handleInputChange}
      handleSubmit={handleSubmit}
      stop={stop}
      append={append}
      setDirectory={setDirectory}
      directory={directory}
      messageMetadata={messageMetadata}
    />
  );
}

async function askAi(promptTemplates: string[]) {
  const responses = await Promise.all(
    promptTemplates.map(async (template) => {
      const response = await fetch(getApiUrl('/ask'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: template }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      return data.response;
    })
  );

  return responses;
}