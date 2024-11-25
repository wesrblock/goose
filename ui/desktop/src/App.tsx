import React from 'react';
import LauncherWindow from './LauncherWindow';
import ChatWindow from './ChatWindow';

export default function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const isLauncher = searchParams.get('window') === 'launcher';
  
  if (isLauncher) {
    return <LauncherWindow />;
  } else {
    return <ChatWindow />;
  }
}