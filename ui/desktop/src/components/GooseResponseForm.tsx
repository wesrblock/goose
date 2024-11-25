import React, { useState } from 'react';
import { GPSIcon } from './ui/icons';
import ReactMarkdown from 'react-markdown';

interface GooseResponseFormProps {
  message: string;
  metadata: any;
  append: (value: any) => void;
}

export default function GooseResponseForm({ message, metadata, append }: GooseResponseFormProps) {
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
    const message = {
      content: "Yes - execute this plan",
      role: "user",
    };
    append(message);
  };

  const handleCancel = () => {
    const message = {
      content: "No - do not execute this plan",
      role: "user",
    };
    append(message);
  };

  const handleSubmit = () => {
    if (selectedOption !== null) {
      const message = {
        content: `Yes - continue with: ${options[selectedOption].optionTitle}`,
        role: "user",
      };
      append(message);
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
              Take flight with this direction
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
