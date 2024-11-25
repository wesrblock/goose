import React, { useState } from 'react';
import ToolInvocation from './ToolInvocation';
import ReactMarkdown from 'react-markdown';
import { GPSIcon } from './ui/icons';

export default function GooseMessage({ message, metadata }) {
  console.log("GooseMessage", metadata);

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

        // Remove ```json block if present
        if (optionsData.startsWith('```json')) {
          optionsData = optionsData.replace(/```json/g, '').replace(/```/g, '');
        }

        // Parse the options JSON
        options = JSON.parse(optionsData);

        // Validate the structure of each option
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

  const [selectedOption, setSelectedOption] = useState(null);

  const handleOptionClick = (index) => {
    setSelectedOption(index);
  };

  const handleAccept = () => {
    console.log("Plan accepted");
    // Add additional logic for accepting the plan here
  };

  const handleCancel = () => {
    console.log("Plan canceled");
    // Add additional logic for canceling the plan here
  };

  const handleSubmit = () => {
    if (selectedOption !== null) {
      console.log("Selected Option:", options[selectedOption]);
    } else {
      console.log("No option selected");
    }
  };

  return (
    <div className="flex mb-4">
      <div className="bg-white w-full text-black rounded-2xl p-4 shadow-md">
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
          <>
            {(!isOptions || options.length == 0) && (
              <ReactMarkdown className="prose">{message.content}</ReactMarkdown>
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
        )}
      </div>
    </div>
  );
}
