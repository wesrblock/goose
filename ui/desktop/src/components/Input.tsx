import React from 'react';
import { Button } from './ui/button'
import { Send } from 'lucide-react'

export default function Input({ handleSubmit, handleInputChange, input }) {
  return (
    <form onSubmit={handleSubmit} className="flex relative bg-white h-[57px] px-[16px] rounded-b-2xl">
      <input 
        type="text" 
        placeholder="What should goose do?"
        value={input}
        onChange={handleInputChange}
        className="w-full outline-none border-none focus:ring-0 bg-transparent p-0" 
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
  );
}
