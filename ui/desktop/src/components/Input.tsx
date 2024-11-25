import React from 'react';
import { Button } from './ui/button'
import Send from './ui/Send'

interface InputProps {
  handleSubmit: (e: React.FormEvent) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  input: string;
  disabled?: boolean;
}

export default function Input({ handleSubmit, handleInputChange, input, disabled = false }: InputProps) {
  return (
    <form onSubmit={handleSubmit} className="flex relative bg-white h-[57px] px-[16px] rounded-b-2xl">
      <input 
        type="text" 
        placeholder="What should goose do?"
        value={input}
        onChange={handleInputChange}
        disabled={disabled}
        className={`w-full outline-none border-none focus:ring-0 bg-transparent p-0 text-14 ${
          disabled ? 'cursor-not-allowed opacity-50' : ''
        }`}
      />  
      <Button
        type="submit"
        size="icon"
        variant="ghost"
        disabled={disabled}
        className={`absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <Send size={24} />
      </Button>
    </form>
  );
}