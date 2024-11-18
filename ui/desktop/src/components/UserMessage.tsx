
import React from 'react'
import ReactMarkdown from 'react-markdown'

export default function UserMessage({ message }) {
  return (
    <div className="flex justify-end mb-[16px]">
      <div className="bg-user-bubble text-white rounded-2xl p-4">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
    </div>
  )
};
