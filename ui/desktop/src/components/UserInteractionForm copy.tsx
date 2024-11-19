import React, { useEffect, useState } from 'react'
import { useChat, Message } from 'ai/react'
import { getApiUrl } from '../config'

interface UserInteractionFormProps {
  message?: Message // Allow `message` to be optional
}

export default function UserInteractionForm({ message }: UserInteractionFormProps) {
  const { messages, handleSubmit } = useChat({
    api: getApiUrl("/reply"),
    initialInput: "how are you"
  })
  const [response, setResponse] = useState<string | null>(null)

  // Trigger API call when the component mounts, if message.content exists
  useEffect(() => {
    if (message && message.content) {
      handleSubmit(message.content)
    }
  }, [message, handleSubmit])

  // Extract the latest assistant response when `messages` updates
  useEffect(() => {
    const assistantMessage = messages.find((msg) => msg.role === 'assistant')
    if (assistantMessage) {
      setResponse(assistantMessage.content)
    }
  }, [messages])

  if (!message) {
    return (
      <div className="p-4 bg-gray-800 text-white rounded-md">
        <h3 className="text-lg font-semibold">No Message Provided</h3>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-800 text-white rounded-md">
      <h3 className="text-lg font-semibold">Simple Chat Widget</h3>
      <p><strong>Request:</strong> {message.content}</p>
      <p><strong>Response:</strong> {response || "Waiting for response..."}</p>
    </div>
  )
}
