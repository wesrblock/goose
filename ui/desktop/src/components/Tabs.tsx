import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom'

import Plus from './ui/Plus';


// Extending React CSSProperties to include custom webkit property
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: string;  // Now TypeScript knows about WebkitAppRegion
  }
}

// Core layout constants
const TAB_MIN_WIDTH = 80;    // Tabs won't shrink smaller than this
const TAB_MAX_WIDTH = 140;   // Default/maximum tab width
const CONTAINER_PADDING = 50; // Left margin for entire tab container

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
  const [needsScroll, setNeedsScroll] = useState(false);
  

  return null;





  return (
    // Outer container - full width with relative positioning for scroll buttons
    <div className="relative w-full pr-20" style={{ WebkitAppRegion: 'drag' }}>
      {/* Left scroll button - only visible when tabs overflow */}
      {needsScroll && (
        <button className="absolute left-[70px] top-1/2 -translate-y-1/2 z-20">
          {/* Scroll left button */}
        </button>
      )}
      
      
    </div>
  );
}