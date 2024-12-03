import React, { useEffect, useState } from 'react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';

export interface Session {
  id: string;
  title: string;
  lastModified: Date;
  messages: Array<{
    id: string;
    role: 'function' | 'system' | 'user' | 'assistant' | 'data' | 'tool';
    content: string;
  }>;
}

interface SessionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionSelect: (session: Session) => void;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  isOpen,
  onClose,
  onSessionSelect,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        // Load sessions through electron IPC
        const loadedSessions = await window.electron.loadSessions();
        setSessions(loadedSessions);
      } catch (error) {
        console.error('Failed to load sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="fixed inset-0 bg-black/50 z-50">
        <div className="container flex items-center justify-center min-h-screen px-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
            <h2 className="text-2xl font-bold mb-4">Load Session</h2>
            
            {loading ? (
              <div className="text-center py-4">Loading sessions...</div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        onSessionSelect(session);
                        onClose();
                      }}
                    >
                      <div className="font-medium">{session.title}</div>
                      <div className="text-sm text-gray-500">
                        Last modified: {new Date(session.lastModified).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};