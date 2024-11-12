import React from 'react';
import { Link } from "react-router-dom";
import { Button } from "./components/ui/button"
import { ScrollArea } from "./components/ui/scroll-area"
import { Plus, Trash2 } from "lucide-react"

const rainbowColors = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
]

export default function Home({ chats, setChats, onSelectChat }) {
  return (
    <div className="absolute inset-6 bg-white bg-opacity-20 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col">
      <h1 className="text-3xl font-bold text-white text-center mt-8 mb-4 flex items-center justify-center gap-3">
        Goose 🪿
      </h1>
      <ScrollArea className="flex-grow px-8">
        <ul className="space-y-4">
          {chats.map((chat: any, index: number) => (
            <Link
              key={chat.id}
              className={`block p-4 rounded-xl cursor-pointer transition-colors ${
                rainbowColors[index % rainbowColors.length]
              } hover:opacity-80`}
              onClick={ () => onSelectChat(chat.id) }
              to={`chat/${chat.id}`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold text-white">{chat.title}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-white bg-opacity-50 hover:bg-opacity-75 rounded-full p-1"
                  onClick={(e) => {
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
        </ul>
      </ScrollArea>
      <div className="p-8 flex justify-center">
        <Button
          className="bg-white text-purple-600 hover:bg-opacity-90 flex items-center gap-2"
          onClick={() => {
            const id = chats.length + 1;
            setChats([
              ...chats,
              { id, title: `Chat #${id}` }
            ])
          }}>
          <Plus className="w-5 h-5" />
          New Session
        </Button>
      </div>
    </div>
  );
}
