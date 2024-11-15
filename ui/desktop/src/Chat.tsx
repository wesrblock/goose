import React, { useEffect } from 'react'
import { useChat } from 'ai/react'
import { useNavigate } from 'react-router-dom'
import { getApiUrl } from './config'
import ReactMarkdown from 'react-markdown'
import { X, Plus, Send, FileText, Check } from 'lucide-react'
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

  const renderToolInvocation = (toolInvocation) => {
    const isCompleted = toolInvocation.state === 'result';
    
    return (
      <div key={toolInvocation.toolCallId} className="space-y-4 transition-all duration-300">
        {/* Always show the tool call */}
        <Card className={`p-4 space-y-2 ${isCompleted ? 'bg-gray-50/80' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="h-4 w-4" />
            <span>Tool Call</span>
            {isCompleted && (
              <span className="flex items-center text-green-600 text-xs">
                <Check className="h-3 w-3 mr-1" />
                Completed
              </span>
            )}
          </div>
          <div className="font-mono text-sm whitespace-pre-wrap">
            <ToolCall call={toolInvocation} />
          </div>
        </Card>

        {/* Show result if available */}
        {isCompleted && (
          <div className="space-y-2 animate-fadeIn">
            <Card className="p-4 bg-white/90 border-green-100">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>Result</span>
              </div>
              <div className="rounded-lg">
                <ToolResult 
                  result={toolInvocation}
                  onSubmitInput={(input) => {
                    handleInputChange({ target: { value: input } })
                    handleSubmit({ preventDefault: () => {} })
                  }}
                />
              </div>
            </Card>
            <Button
              variant="secondary"
              className="w-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              Take flight with this direction
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-window-gradient flex flex-col items-center justify-center p-0">
      <div className="flex items-center justify-start overflow-x-auto relative p-[10px] pb-0 w-full">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`flex bg-tab items-center min-w-[140px] max-w-[240px] h-8 px-3 mr-1 rounded-t-lg cursor-pointer transition-all`}
            onClick={() => navigateChat(chat.id)}
            onKeyDown={(e) => e.key === "Enter" && navigateChat(chat.id)}
            tabIndex={0}
            role="tab"
            aria-selected={selectedChatId === chat.id}
          >
            <span className="flex-grow truncate text-sm font-medium">{chat.title}</span>
            {chats.length > 1 && (
              <button
                className="ml-2 p-1 rounded-full hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                onClick={(e) => {
                  e.stopPropagation();
                  removeChat(chat.id);
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

      <Card className="w-[calc(100%-20px)] h-[calc(100vh-20px)] m-[10px] bg-card-gradient mt-0 backdrop-blur-sm border-none shadow-xl rounded-2xl rounded-tl-none overflow-hidden">
        <div className="flex flex-col h-full">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === 'user' ? (
                    <div className="flex justify-end mb-4">
                      <div className="bg-[#555FE7E5] text-white rounded-2xl p-4 max-w-[80%]">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <div className="flex mb-4">
                      <div className="bg-goose-bubble text-black rounded-2xl p-4 max-w-[80%]">
                        {message.toolInvocations ? (
                          <div className="space-y-4">
                            {message.toolInvocations.map(renderToolInvocation)}
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
          <form onSubmit={handleSubmit} className="relative bg-white mb-0 h-{57px}">
            <Input
              placeholder="What should goose do?"
              value={input}
              onChange={handleInputChange}
              className="pr-12 rounded-full border-none focus:outline-none focus:ring-0"
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
      </Card>
    </div>
  )
}