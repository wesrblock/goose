import React from 'react'
import ToolInvocation from './ToolInvocation'
import ReactMarkdown from 'react-markdown'


export default function GooseMessage({ message, metadata }) {
  console.log("GooseMessage", metadata)

  let isReady = false;
  let isQuestion = false;
  let isOptions = false;

  if (metadata) {
    isReady = metadata[0] === "READY";
    isQuestion = metadata[0] === "QUESTION";
    isOptions = metadata[0] === "OPTIONS";
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
          <ReactMarkdown className="prose">{message.content}</ReactMarkdown>
        )}
      </div>
    </div>
  )
};
