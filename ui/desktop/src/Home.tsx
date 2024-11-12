import React from 'react';
import { Link } from "react-router-dom";
import { Card } from "./components/ui/card"
import { Button } from "./components/ui/button"
import { ScrollArea } from "./components/ui/scroll-area"
import { Plus, Trash2, MessageCircle } from "lucide-react"

export default function Home({ chats, setChats, onSelectChat }) {
  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center p-[30px]">
      <Card className="w-full h-[calc(100vh-60px)] flex flex-col bg-white/80 backdrop-blur-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-2xl font-bold">Goose 🪿</h1>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => {
              const id = chats.length + 1;
              setChats([
                ...chats,
                { id, title: `Chat #${id}` }
              ])
            }}
          >
            <Plus className="w-4 h-4" />
            New Session
          </Button>
        </div>
        <ScrollArea className="flex-grow p-4 space-y-4">
          {chats.map((chat: any) => (
            <Link
              key={chat.id}
              className="block"
              onClick={() => onSelectChat(chat.id)}
              to={`chat/${chat.id}`}
            >
              <div className="flex justify-between items-center p-3 mb-5 rounded-lg bg-blue-100 hover:bg-blue-200 transition-colors">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                  <span className="text-lg font-semibold text-blue-800">{chat.title}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-300"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setChats(chats.filter((c: any) => c.id !== chat.id));
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="sr-only">Delete Session</span>
                </Button>
              </div>
            </Link>
          ))}
        </ScrollArea>
        <div className="p-4 border-t text-center text-sm text-gray-500">
          Select a chat to start a conversation or create a new session.
        </div>
      </Card>
    </div>
  );
}