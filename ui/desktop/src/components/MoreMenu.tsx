import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import VertDots from './ui/VertDots';

interface MoreMenuProps {
  className?: string;
  onStopGoose: () => void;
  onClearContext: () => void;
  onRestartGoose: () => void;
}

export default function MoreMenu({ onStopGoose, onClearContext, onRestartGoose }: MoreMenuProps) {
  const [open, setOpen] = useState(false);

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="z-30 block w-[30px] h-[30px]"
          aria-label="Menu"
        >
          <VertDots size={18} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 rounded-md">
        <div className="flex flex-col bg-black text-white rounded-md">
          <button
            onClick={() => handleAction(onStopGoose)}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            Stop current Goose
          </button>
          <button
            onClick={() => handleAction(onClearContext)}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            Clear context
          </button>
          <button
            onClick={() => handleAction(onRestartGoose)}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            Restart goose
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}