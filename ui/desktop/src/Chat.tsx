import React, { useEffect } from 'react'
import { useChat } from 'ai/react'
import { useNavigate } from 'react-router-dom'
import { getApiUrl } from './config'
import ReactMarkdown from 'react-markdown'
import { X, Plus, MessageSquare, Send, FileText } from 'lucide-react'
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
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-100 to-blue-200 flex items-center justify-center p-0">
      <Card className="w-[calc(100%-20px)] h-[calc(100vh-20px)] m-[10px] bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden">
        <div className="flex flex-col h-full">
          <div className="flex items-center bg-sky-100absolute opacity-80 text-[#5a5a5a] text-[10px] font-medium font-['Inter'] rounded-t-2xl overflow-x-auto">
            {chats.map(chat => (
              <div
                key={chat.id}
                className={`flex items-center min-w-[140px] max-w-[240px] h-8 px-3 mr-1 rounded-t-lg cursor-pointer transition-all ${
                  selectedChatId === chat.id 
                    ? 'bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] relative z-10' 
                    : 'bg-sky-200 hover:bg-sky-300'
                }`}
                onClick={() => navigateChat(chat.id)}
                onKeyDown={(e) => e.key === 'Enter' && navigateChat(chat.id)}
                tabIndex={0}
                role="tab"
                aria-selected={selectedChatId === chat.id}
              >
                <span className="flex-grow truncate text-sm font-medium">{chat.title}</span>
                {chats.length > 1 && (
                  <button
                    className="ml-2 p-1 rounded-full hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeChat(chat.id)
                    }}
                    aria-label={`Close ${chat.title} chat`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <button
              className="flex items-center justify-center w-8 h-8 rounded-full bg-transparent hover:bg-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
              onClick={addChat}
              aria-label="New chat"
            >
              <Plus className="w-5 h-5 text-sky-600" />
            </button>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === 'user' ? (
                    <div className="flex justify-end mb-4">
                      <div className="bg-indigo-100 text-indigo-800 rounded-2xl p-4 max-w-[80%]">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <div className="flex mb-4">
                      <div className="bg-white text-gray-800 rounded-2xl p-4 max-w-[80%] shadow-sm">
                        <Avatar className="h-8 w-8 mb-2">🪿</Avatar>
                        {message.toolInvocations ? (
                          <div className="flex items-start gap-3">
                            {message.toolInvocations.map((toolInvocation) => {
                              if (toolInvocation.state === 'call') {                                                        
                                return (
                                  <Card key={toolInvocation.toolCallId} className="p-4 space-y-2 bg-gray-50">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
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
                                return (
                                  <div key={toolInvocation.toolCallId} className="space-y-2">
                                    <div className="bg-gray-50 text-gray-800 rounded-2xl p-4 max-w-[80%]">
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
                                      className="w-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
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
          <div className="p-4 border-t border-gray-200">
            <form onSubmit={handleSubmit} className="relative">
              <Input
                placeholder="What should goose do?"
                value={input}
                onChange={handleInputChange}
                className="pr-12 bg-white/50 border-gray-300 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 rounded-full"
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100"
              >
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  )
}