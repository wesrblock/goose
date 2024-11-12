import React, { useEffect } from 'react';
import { useChat } from 'ai/react';
import { useNavigate } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Send } from "lucide-react";
import { Button } from "./components/ui/button";
import { ScrollArea } from "./components/ui/scroll-area";

const rainbowColors = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
];

export default function Chat({ chats, setChats, selectedChatId, setSelectedChatId }) {
  const navigate = useNavigate()
  const chat = selectedChatId === 'new' ? { id: chats.length + 1, title: `Chat ${chats.length + 1}`, messages: [] } : chats.find((c: any) => c.id === selectedChatId)
  const chatIndex = chats.findIndex((c: any) => c.id === selectedChatId)

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: 'http://127.0.0.1:3000/reply',
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
    let newChatId: number;

    if (direction === 'next') {
      newChatId = selectedChatId === chats.length ? 1 : selectedChatId + 1;
    } else {
      newChatId = selectedChatId === 1 ? chats[chats.length - 1].id : selectedChatId - 1;
    }
    
    setSelectedChatId(newChatId);
    navigate(`/chat/${newChatId}`);
  };

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
    <div className="absolute inset-6 bg-white bg-opacity-20 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden">
      <AnimatePresence initial={false}>
        <motion.div
          key={chat.id}
          className={`absolute inset-4 flex flex-col rounded-2xl ${
            rainbowColors[(chat.id as number) % rainbowColors.length]
          }`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.2 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <h2 className="text-2xl font-bold text-white mb-4 p-4">{chat.title}</h2>
          <ScrollArea className="flex-grow overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.map(message => (                
                <div key={message.id} className="bg-white bg-opacity-20 rounded-lg p-3 text-white">
                  {message.role === 'user' ? 'User: ' : 'Goose 🪿: '}
                  <ReactMarkdown
                    components={{
                      code({ node, className, children, ...props }) {
                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        )
                      }
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ))}
            </div>
          </ScrollArea>

          <form onSubmit={handleSendMessage} className="block p-4 mb-50 mt-auto">
            <div className="flex items-center space-x-2">
              <input
                name="prompt"
                value={input}
                onChange={handleInputChange}
                className="flex-grow p-2 rounded-full bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-70 focus:outline-none focus:ring-2 focus:ring-white"
              />
              <button type="submit">
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-x-8 bottom-8 flex justify-between items-center">
        <Button
          variant="outline"
          size="icon"
          className="bg-white bg-opacity-50 hover:bg-opacity-75 rounded-full p-2"
          onClick={() => navigateChat('prev')}
        >
          <ChevronLeft className="w-6 h-6 text-white" />
          <span className="sr-only">Previous</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="bg-white bg-opacity-50 hover:bg-opacity-75 rounded-full p-2"
          onClick={() => navigate('/')}
        >
          <X className="w-6 h-6 text-white" />
          <span className="sr-only">Close session</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="bg-white bg-opacity-50 hover:bg-opacity-75 rounded-full p-2"
          onClick={() => navigateChat('next')}
        >
          <ChevronRight className="w-6 h-6 text-white" />
          <span className="sr-only">Next</span>
        </Button>
      </div>
    </div>
  );
}
