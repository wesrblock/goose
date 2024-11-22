import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom'

import Plus from './ui/Plus';
import X from './ui/X';

const TAB_MIN_WIDTH = 80; // Minimum width a tab can shrink to
const TAB_MAX_WIDTH = 135; // Current fixed width
const CONTAINER_PADDING = 100; // Current ml-[100px]

function calculateTabWidths(containerWidth: number, tabCount: number) {
  const availableWidth = containerWidth - CONTAINER_PADDING;
  
  // If all tabs can fit at max width, use max width
  if (tabCount * TAB_MAX_WIDTH <= availableWidth) {
    return {
      tabWidth: TAB_MAX_WIDTH,
      needsScroll: false
    };
  }
  
  // Calculate width that would perfectly fill the space
  const idealWidth = availableWidth / tabCount;
  
  // If idealWidth is less than minimum, use minimum and enable scrolling
  if (idealWidth < TAB_MIN_WIDTH) {
    return {
      tabWidth: TAB_MIN_WIDTH,
      needsScroll: true
    };
  }
  
  // Otherwise use the ideal width to fill the space exactly
  return {
    tabWidth: Math.floor(idealWidth),
    needsScroll: false
  };
}

export default function Tabs({ chats, selectedChatId, setSelectedChatId, setChats }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tabWidth, setTabWidth] = useState(TAB_MAX_WIDTH);
  const [needsScroll, setNeedsScroll] = useState(false);
  
  useEffect(() => {
    const updateTabWidths = () => {
      if (containerRef.current) {
        const { tabWidth: newWidth, needsScroll: newNeedsScroll } = calculateTabWidths(
          containerRef.current.offsetWidth,
          chats.length
        );
        setTabWidth(newWidth);
        setNeedsScroll(newNeedsScroll);
      }
    };

    updateTabWidths();
    window.addEventListener('resize', updateTabWidths);
    return () => window.removeEventListener('resize', updateTabWidths);
  }, [chats.length]);

  // Generate SVG path based on tab width
  const generatePath = (width: number) => {
    const curve = Math.min(25, width * 0.2); // Scale curve with width
    const innerWidth = width - (curve * 2);
    
    return `
      M${curve} 11
      C${curve} 4.92487 ${curve + 4.9249} 0 ${curve + 11} 0
      H${curve + innerWidth - 11}
      C${curve + innerWidth - 4.9249} 0 ${curve + innerWidth} 4.92487 ${curve + innerWidth} 11
      V13
      C${curve + innerWidth} 19.0751 ${curve + innerWidth + 4.925} 24 ${curve + innerWidth + 11} 24
      H${width + 11.5}H0H${curve - 11}
      C${curve - 4.9249} 24 ${curve} 19.0751 ${curve} 13
      V11Z
    `;
  };

  const navigate = useNavigate()
  const navigateChat = (chatId: number) => {
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
    <div className="relative w-full">
      {needsScroll && (
        <button className="absolute left-[70px] top-1/2 -translate-y-1/2 z-20">
          {/* Scroll left button */}
        </button>
      )}
      
      <div 
        ref={containerRef} 
        className={`
          flex items-center relative pb-0 ml-[100px]
          ${needsScroll ? 'overflow-x-auto hide-scrollbar' : ''}
        `}
      >
        {chats.map((chat, idx) => (
          <div
            key={chat.id}
            style={{ width: tabWidth }}
            className="relative flex items-center h-[32px] mr-1 cursor-pointer transition-all group"
            onClick={() => navigateChat(chat.id)}
            onKeyDown={(e) => e.key === "Enter" && navigateChat(chat.id)}
            tabIndex={0}
            role="tab"
            aria-selected={selectedChatId === chat.id}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="absolute inset-0 w-full h-full"
              viewBox={`0 0 ${tabWidth} 24`}
              fill="none"
              preserveAspectRatio="none"
            >
              <path 
                d={generatePath(tabWidth)}
                fill={selectedChatId === chat.id ? 
                  'rgba(226, 245, 251, 0.90)' : 
                  'rgba(254, 254, 254, 0.80);'
                }
              />
            </svg>
            
            <div className="relative z-10 flex items-center justify-between w-full px-2">
              <span 
                className="tab-type truncate ml-6" 
                style={{ 
                  maxWidth: tabWidth - 45  // Adjusted since we removed plus button
                }}
              >
                {chat.title}
              </span>
              {chats.length > 1 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChat(chat.id);
                  }}
                  className="mr-2"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* New Plus button outside of tabs */}
        <button 
          onClick={addChat}
          className="flex items-center justify-center h-[32px] w-[32px] ml-2"
          aria-label="New chat"
        >
          <Plus size={18} />
        </button>
      </div>

      {needsScroll && (
        <button className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
          {/* Scroll right button */}
        </button>
      )}
    </div>
  );
}