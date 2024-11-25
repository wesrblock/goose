import React, { useState } from 'react';
import ToolInvocation from './ToolInvocation';
import ReactMarkdown from 'react-markdown';
import { GPSIcon } from './ui/icons';
import LinkPreview from './LinkPreview';
import { extractUrls } from '../utils/urlUtils';

interface GooseMessageProps {
  message: any;
  metadata?: any;
  messages?: any[];
  onInputChange?: (value: string) => void;
}

interface GooseResponseFormProps {
  message: string;
  metadata: any;
  onInputChange: (value: string) => void;
}

function GooseResponseForm({ message, metadata, onInputChange }: GooseResponseFormProps) {
  const [selectedOption, setSelectedOption] = useState(null);

  let isReady = false;
  let isQuestion = false;
  let isOptions = false;
  let options = [];

  if (metadata) {
    isReady = metadata[0] === "READY";
    isQuestion = metadata[0] === "QUESTION";
    isOptions = metadata[0] === "OPTIONS";

    if (isOptions && metadata[1]) {
      try {
        let optionsData = metadata[1];
        if (optionsData.startsWith('```json')) {
          optionsData = optionsData.replace(/```json/g, '').replace(/```/g, '');
        }
        options = JSON.parse(optionsData);
        options = options.filter(
          (opt) =>
            typeof opt.optionTitle === 'string' &&
            typeof opt.optionDescription === 'string'
        );
      } catch (err) {
        console.error("Failed to parse options data:", err);
        options = [];
      }
    }
  }

  const handleOptionClick = (index) => {
    setSelectedOption(index);
  };

  const handleAccept = () => {
    onInputChange({ target: { value: "accept" } } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleCancel = () => {
    onInputChange({ target: { value: "No thanks" } } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleSubmit = () => {
    if (selectedOption !== null) {
      onInputChange({ target: { value: options[selectedOption].optionTitle } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  if (isQuestion || isOptions) {    
    window.electron.showNotification({
      title: 'Goose has a question for you',
      body: `please check with goose to approve the plan of action`,
    });
  }

  return (
    <>
      {(!isOptions || options.length === 0) && (
        <ReactMarkdown className="prose">{message}</ReactMarkdown>
      )}
      {isQuestion && (
        <div className="mt-4 bg-gray-100 p-4 rounded-lg shadow-lg">
          <div className="flex space-x-4">
            <button
              onClick={handleAccept}
              className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition"
            >
              <GPSIcon size={14} />
              Accept Plan
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition"
            >
              <GPSIcon size={14} />
              Cancel
            </button>
          </div>
        </div>
      )}
      {isOptions && options.length > 0 && (
        <div className="mt-4 space-y-4">
          {options.map((opt, index) => (
            <div
              key={index}
              onClick={() => handleOptionClick(index)}
              className={`p-4 rounded-lg shadow-md cursor-pointer ${
                selectedOption === index
                  ? 'bg-blue-100 border border-blue-500'
                  : 'bg-gray-100'
              }`}
            >
              <h3 className="font-semibold text-lg">{opt.optionTitle}</h3>
              <ReactMarkdown className="prose">
                {opt.optionDescription}
              </ReactMarkdown>
            </div>
          ))}
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition mt-4"
          >
            <GPSIcon size={14} />
            Submit
          </button>
        </div>
      )}
    </>
  );
}

export default function GooseMessage({ message, metadata, messages, onInputChange }: GooseMessageProps) {
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
                onInputChange={onInputChange}
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