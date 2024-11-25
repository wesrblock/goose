import React from 'react';
import ToolInvocation from './ToolInvocation';
import ReactMarkdown from 'react-markdown';

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

  return (
    <div className="flex mb-4">
      <div className="bg-goose-bubble w-full text-black rounded-2xl p-4">
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
            {!isOptions && (
              <ReactMarkdown className="prose">{message.content}</ReactMarkdown>
            )}
            {isQuestion && (
              <div className="mt-4 bg-zinc-100 p-4 rounded-lg shadow-md">
                <p className="font-semibold text-lg mb-2">Question</p>
                <div className="space-x-2">
                  <button className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition">
                    Ok
                  </button>
                  <button className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition">
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
                    className="p-4 bg-zinc-100 rounded-lg shadow-md"
                  >
                    <h3 className="font-semibold text-lg">{opt.optionTitle}</h3>
                    <ReactMarkdown className="prose">
                      {opt.optionDescription}
                    </ReactMarkdown>
                  </div>
                ))}
                <button className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition mt-4">
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
