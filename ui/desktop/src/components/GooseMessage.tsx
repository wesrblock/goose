import React from 'react';
import ToolInvocation from './ToolInvocation';
import ReactMarkdown from 'react-markdown';
import LinkPreview from './LinkPreview';
import GooseResponseForm from './GooseResponseForm';
import { extractUrls } from '../utils/urlUtils';

interface GooseMessageProps {
  message: any;
  messages: any[];
  metadata?: any;
  append: (value: any) => void;
}

export default function GooseMessage({ message, metadata, messages, append }: GooseMessageProps) {
  // Find the preceding user message
  const messageIndex = messages?.findIndex(msg => msg.id === message.id);
  const previousMessage = messageIndex > 0 ? messages[messageIndex - 1] : null;

  // Get URLs from previous user message (if it exists)
  const previousUrls = previousMessage
    ? extractUrls(previousMessage.content)
    : [];

  // Extract URLs from current message, excluding those from the previous user message
  const urls = extractUrls(message.content, previousUrls);

  return (
    <div className="flex mb-[16px]">
      <div className="flex flex-col">
        <div className="bg-goose-bubble text-white rounded-2xl p-4">
          {message.toolInvocations ? (
            <div className="space-y-4">
              {message.toolInvocations.map((toolInvocation) => (
                <ToolInvocation
                  key={toolInvocation.toolCallId}
                  toolInvocation={toolInvocation}
                />
              ))}
            </div>
          ) : (
            metadata ? (
              <GooseResponseForm 
                message={message.content}
                metadata={metadata}
                append={append}
              />
            ) : (
              <ReactMarkdown className="prose">{message.content}</ReactMarkdown>
            )
          )}
        </div>

        {urls.length > 0 && (
          <div className="mt-2">
            {urls.map((url, index) => (
              <LinkPreview key={index} url={url} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}