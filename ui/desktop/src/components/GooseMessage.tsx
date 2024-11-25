import React from 'react'
import ToolInvocation from './ToolInvocation'
import ReactMarkdown from 'react-markdown'


export default function GooseMessage({ message, metadata }) {

  console.log('GooseMessageMetadata', metadata)
  const [ready, options, form] = metadata

  if (ready === "QUESTION") {
    // need to render a go ahead button or a no button. When pressed they put their title into the input in the chat window as text and then send it to the server
  } else if (ready === "OPTIONS") {
    // need to render a list of options for the user to pick from. When picked they put their title into the input in the chat window as text and then send it to the server
    // format of options field: JSON array of objects of the form optionTitle:string, optionDescription:string (markdown) - may have ```json at the start we need to strip out etc
  } else if (ready === "READY") {
    // don't need to do anything
  }
  // if form is json then we need to render a form with the fields in the json as per: fieldName:{type: string, number, email or date, title:string, description:optional markdown, required: true or false} - parse it, may need to strip out ```json at the start etc. 

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
