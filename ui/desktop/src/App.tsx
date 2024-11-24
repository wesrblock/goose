import React from 'react';
import LauncherWindow from './LauncherWindow';
import WingToWingWindow from './WingToWingWindow';
import ChatWindow from './ChatWindow';

export default function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const isLauncher = searchParams.get('window') === 'launcher';
  const isWingToWing = searchParams.get('window') === 'wingToWing';  
  
  // TODO - Look at three separate renderers for this
  if (isLauncher) {
    return <LauncherWindow />;
  } else if (isWingToWing) {
    return <WingToWingWindow />;
  } else {
    return <ChatWindow />;
  }
}