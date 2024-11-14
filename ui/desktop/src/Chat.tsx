import React, { useEffect } from 'react'
import { useChat } from 'ai/react'
import { useNavigate } from 'react-router-dom'
import { getApiUrl } from './config'
import ReactMarkdown from 'react-markdown'
import { X, Plus, MessageSquare } from 'lucide-react'
import { Send, FileText } from 'lucide-react'
import { Avatar } from "./components/ui/avatar"
import { Button } from "./components/ui/button"
import { Card } from "./components/ui/card"
import { Input } from "./components/ui/input"
import { ScrollArea } from "./components/ui/scroll-area"
import ToolResult from './components/ui/tool-result'
import ToolCall from './components/ui/tool-call'

export default function Chat({ chats, setChats, selectedChatId, setSelectedChatId }) {
  const navigate = useNavigate()
  const chat = chats.find((c) => c.id === selectedChatId);

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: getApiUrl("/reply"),
    initialMessages: chat.messages
  })

  // Combine messages in the currently rendered chat with global chat state
  useEffect(() => {
    const updatedChats = [...chats]
    updatedChats.find((c) => c.id === selectedChatId).messages = messages
    setChats(updatedChats)
  }, [messages, selectedChatId])

  const navigateChat = (chatId) => {
    setSelectedChatId(chatId)
    navigate(`/chat/${chatId}`)
  }

  const addChat = () => {
    const newChatId = chats[chats.length-1].id + 1;
    const newChat = {
      id: newChatId,
      title: `Chat ${newChatId}`,
      messages: [],
    };
    setChats([...chats, newChat]);
    navigateChat(newChatId);
  };

  const removeChat = (chatId: number) => {
    const updatedChats = chats.filter((chat: any) => chat.id !== chatId);
    setChats(updatedChats);
    navigateChat(updatedChats[0].id);
  };

  return (
    <div className="flex flex-col h-full">
     <div className="flex items-center bg-gray-200 p-1 rounded-t-lg overflow-x-auto">
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`flex items-center min-w-[140px] max-w-[240px] h-9 px-4 mr-1 rounded-t-lg cursor-pointer transition-colors ${
              selectedChatId === chat.id ? 'bg-white' : 'bg-gray-100 hover:bg-gray-300'
            }`}
            onClick={() => navigateChat(chat.id)}
            onKeyDown={(e) => e.key === 'Enter' && navigateChat(chat.id)}
            tabIndex={0}
            role="tab"
            aria-selected={selectedChatId === chat.id}
          >
            <MessageSquare className="w-4 h-4 mr-2 text-gray-500" />
            <span className="flex-grow truncate text-sm">{chat.title}</span>
            <button
              className="ml-2 p-1 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
              onClick={(e) => {
                e.stopPropagation()
                removeChat(chat.id)
              }}
              aria-label={`Close ${chat.title} chat`}
            >
              {chats.length > 1 && <X className="w-3 h-3 text-gray-500" />}
            </button>
          </div>
        ))}
        <button
          className="flex items-center justify-center w-8 h-8 rounded-full bg-transparent hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
          onClick={addChat}
          aria-label="New chat"
        >
          <Plus className="w-5 h-5 text-gray-700" />
        </button>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id}>
              {message.role === 'user' ? (
                <div className="flex justify-end mb-4">
                  <div className="bg-[#6366F1] text-white rounded-2xl p-4 max-w-[80%]">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="flex mb-4">
                  <div className="bg-gray-300 text-black rounded-2xl p-4 max-w-[80%]">
                    <Avatar className="h-8 w-8 mt-1">🪿</Avatar>
                    {message.toolInvocations ? (
                      <div className="flex items-start gap-3">
                        {message.toolInvocations.map((toolInvocation) => {
                          console.log(JSON.stringify(message.toolInvocations,null,2))
                          if (toolInvocation.state === 'call') {                                                        
                            return (
                              <Card key={toolInvocation.toolCallId} className="p-4 space-y-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <FileText className="h-4 w-4" />
                                  A file
                                  <span className="text-xs">Link from clipboard</span>
                                </div>
                                <div className="font-mono text-sm whitespace-pre-wrap">
                                  <ToolCall call={toolInvocation} />
                                </div>
                              </Card>
                            )
                          }
                          if (toolInvocation.state === 'result') {
                            console.log("SHOWING RESULT")
                            return (
                              <div key={toolInvocation.toolCallId} className="space-y-2">
                                <div className="bg-gray-300 text-black rounded-2xl p-4 max-w-[80%]">
                                  <ToolResult 
                                    result={toolInvocation}
                                    onSubmitInput={(input) => {
                                      handleInputChange({ target: { value: input } })
                                      handleSubmit({ preventDefault: () => {} })
                                    }}
                                  />
                                </div>
                                <Button
                                  variant="secondary"
                                  className="w-full text-indigo-600"
                                >
                                  Take flight with this direction
                                </Button>
                              </div>
                            )
                          }
                          return null
                        })}
                      </div>
                    ) : (
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="relative">
          <Input
            placeholder="What next?"
            value={input}
            onChange={handleInputChange}
            className="pr-12"
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
