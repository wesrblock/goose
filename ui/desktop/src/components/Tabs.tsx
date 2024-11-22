import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom'

import Plus from './ui/Plus';
import X from './ui/X';

// Core layout constants
const TAB_MIN_WIDTH = 80;    // Tabs won't shrink smaller than this
const TAB_MAX_WIDTH = 135;   // Default/maximum tab width
const CONTAINER_PADDING = 100; // Left margin for entire tab container

// Calculate how wide each tab should be based on available space
function calculateTabWidths(containerWidth: number, tabCount: number) {
  // Remove left margin from available space
  const availableWidth = containerWidth - CONTAINER_PADDING;
  
  // Case 1: Plenty of space - use maximum tab width
  if (tabCount * TAB_MAX_WIDTH <= availableWidth) {
    return {
      tabWidth: TAB_MAX_WIDTH,
      needsScroll: false
    };
  }
  
  // Case 2: Calculate if tabs need to shrink
  const idealWidth = availableWidth / tabCount;
  
  // Case 3: Not enough space even at minimum width
  if (idealWidth < TAB_MIN_WIDTH) {
    return {
      tabWidth: TAB_MIN_WIDTH,
      needsScroll: true  // Enable horizontal scrolling
    };
  }
  
  // Case 4: Shrink tabs to fit exactly
  return {
    tabWidth: Math.floor(idealWidth),
    needsScroll: false
  };
}

export default function Tabs({ chats, selectedChatId, setSelectedChatId, setChats }) {
  // Track container width for responsive tab sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [tabWidth, setTabWidth] = useState(TAB_MAX_WIDTH);
  const [needsScroll, setNeedsScroll] = useState(false);
  
  // Recalculate tab widths when window resizes or chat count changes
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

  // Add this effect after the existing resize effect
  useEffect(() => {
    // Scroll to end whenever chats list changes
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [chats]); // Trigger when chats array changes

  // Add this effect alongside the other useEffects
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent the default vertical scroll
      e.preventDefault();

      // Convert vertical scroll to horizontal
      // You can adjust the multiplier (30) to change scroll speed
      container.scrollLeft += e.deltaY * 0.5;
    };

    // Add event listener
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Cleanup
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []); // Empty dependency array since we only need to set this up once

  // SVG path generator for tab shape
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

  // Navigation functions
  const navigate = useNavigate()
  const navigateChat = (chatId: number) => {
    setSelectedChatId(chatId)
    navigate(`/chat/${chatId}`)
  }

  // Tab management functions
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
    // Outer container - full width with relative positioning for scroll buttons
    <div className="relative w-full">
      {/* Left scroll button - only visible when tabs overflow */}
      {needsScroll && (
        <button className="absolute left-[70px] top-1/2 -translate-y-1/2 z-20">
          {/* Scroll left button */}
        </button>
      )}
      
      {/* Main tabs container - includes 100px left margin */}
      <div 
        ref={containerRef} 
        className={`
          flex items-center relative pb-0 ml-[100px]
          ${needsScroll ? 'overflow-x-auto hide-scrollbar' : ''}
        `}
      >
        {/* Individual tab rendering */}
        {chats.map((chat, idx) => (
          <div
            key={chat.id}
            style={{ width: tabWidth }}  // Dynamic width based on available space
            className="relative flex items-center h-[32px] mr-1 cursor-pointer transition-all group"
            onClick={() => navigateChat(chat.id)}
            onKeyDown={(e) => e.key === "Enter" && navigateChat(chat.id)}
            tabIndex={0}
            role="tab"
            aria-selected={selectedChatId === chat.id}
          >
            {/* SVG Background - creates the tab shape */}
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
            
              {/* Tab content container - holds title and X button */}
              {/* Adjusted padding on the left side and reduced margin for the close button */}
              <div className="relative z-10 flex items-center justify-between w-full pl-6 pr-4">
                {/* Tab title - truncates if too long */}
                <span className="tab-type truncate">
                  {chat.title}
                </span>

                {/* X (Close) Button - only shown when multiple tabs exist */}
                {/* Position controlled by:
                * - justify-between on parent div pushes it right
                * - ml-1 reduces left margin
                * - flex-shrink-0 prevents button from shrinking
                */}
                {chats.length > 1 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeChat(chat.id);
                    }}
                    className="flex items-center justify-center w-[16px] h-[16px] ml-1 flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
          </div>
        ))}

        {/* New tab button - fixed width, positioned after last tab */}
        <button 
          onClick={addChat}
          className="flex items-center justify-center h-[32px] w-[32px] ml-2"
          aria-label="New chat"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Right scroll button - only visible when tabs overflow */}
      {needsScroll && (
        <button className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
          {/* Scroll right button */}
        </button>
      )}
    </div>
  );
}