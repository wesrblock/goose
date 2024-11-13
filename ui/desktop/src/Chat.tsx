import React, { useEffect } from 'react'
import { useChat } from 'ai/react'
import { useNavigate } from 'react-router-dom'
import { getApiUrl } from './config'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Send, Share } from 'lucide-react'
import { Card } from './components/ui/card'
import { Input } from './components/ui/input'
import { Button } from "./components/ui/button"
import { ScrollArea } from "./components/ui/scroll-area"
import ToolResult from './components/ui/tool-result'
import ToolCall from './components/ui/tool-call'

export default function Chat({ chats, setChats, selectedChatId, setSelectedChatId }) {
  const navigate = useNavigate()
  const chat = selectedChatId === 'new' ? { id: chats.length + 1, title: `Chat ${chats.length + 1}`, messages: [] } : chats.find((c: any) => c.id === selectedChatId)
  const chatIndex = chats.findIndex((c: any) => c.id === selectedChatId)

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: getApiUrl("/reply"),
    initialMessages: chat.messages,
    id: chat.id.toString(),
  })

  useEffect(() => {
    if (selectedChatId !== 'new') {
      const updatedChats = [...chats]
      updatedChats[chatIndex].messages = messages
      setChats(updatedChats)
    }
  }, [messages])

  const navigateChat = (direction: string) => {
    let newChatId = 0;
    if (direction === 'next') {
      newChatId = selectedChatId === chats.length ? 1 : selectedChatId + 1
    } else {
      newChatId = selectedChatId === 1 ? chats[chats.length - 1].id : selectedChatId - 1
    }
    setSelectedChatId(newChatId)
    navigate(`/chat/${newChatId}`)
  }

  const handleSendMessage = (e: any) => {
    e.preventDefault()
    if (selectedChatId === 'new') {
      const newChat = {
        id: chats.length + 1,
        title: `Chat ${chats.length + 1}`,
        messages: [],
      }
      setChats([...chats, newChat])
      navigate(`/chat/${newChat.id}`)
    }
    handleSubmit(e)
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center p-[30px]">
      <Card className="w-full h-[calc(100vh-60px)] flex flex-col bg-white/80 backdrop-blur-sm shadow-xl">
        <AnimatePresence initial={false}>
          <motion.div
            key={chat.id}
            className="flex flex-col h-full"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="text-sm text-muted-foreground">
                Current session: {chat.title}
              </div>
              <Button variant="ghost" size="icon">
                <Share className="h-4 w-4" />
              </Button>
            </div>

            {/* Main Content */}
            <ScrollArea className="flex-grow p-4 space-y-4">
            
              {messages.map((message) => (
                <div key={message.id} className={`p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <div className="font-semibold">{message.role === 'user' ? 'You' : 'Goose 🪿'}</div>
                  {message.toolInvocations == null ? (
                  <ReactMarkdown
                    components={{
                      code({ node, className, children, ...props }) {
                        return (
                          <code className={`${className} bg-gray-800 text-white p-1 rounded`} {...props}>
                            {children}
                          </code>
                        )
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  ) : 
                  
                  <div>
                  {message.toolInvocations.map((toolInvocation) => {
                    const { toolCallId, state } = toolInvocation;
                    console.log("Tool Invocation:", JSON.stringify(toolInvocation, null, 2))
                    if (state === 'result') {
                      return (
                        <div key={toolCallId}>
                          <div>
                            <ToolResult 
                              result={toolInvocation} 
                              onSubmitInput={(input) => {
                                handleInputChange({ target: { value: input } } as any);
                                handleSubmit({ preventDefault: () => {} } as any);
                              }}
                            />
                            <details className="mt-2">
                              <summary className="cursor-pointer text-sm text-blue-600">View Raw JSON</summary>
                              <pre className="mt-2 p-2 bg-gray-800 text-white rounded overflow-auto text-xs">
                                {JSON.stringify(toolInvocation, null, 2)}
                              </pre>
                            </details>
                          </div>
                        </div>
                      );
                    }
                    if (state === 'call') {
                      return (
                        <div key={toolCallId}>
                          <ToolCall call={toolInvocation} />
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>

                  
                  
                  }

                </div>
              ))}

              
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <Input
                    placeholder="What's next?"
                    value={input}
                    onChange={handleInputChange}
                    className="pr-10"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    className="absolute right-0 top-0 h-full"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>

              {/* Bottom Actions */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Button variant="secondary" size="sm" className="w-full" onClick={() => navigateChat('prev')}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous Chat
                </Button>
                <Button variant="secondary" size="sm" className="w-full" onClick={() => navigate('/')}>
                  <X className="w-4 h-4 mr-2" />
                  Close Session
                </Button>
                <Button variant="secondary" size="sm" className="w-full" onClick={() => navigateChat('next')}>
                  Next Chat
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </Card>
    </div>
  )
}