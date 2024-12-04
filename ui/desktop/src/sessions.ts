import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

interface Message {
  id: number;
  role: 'function' | 'system' | 'user' | 'assistant' | 'data' | 'tool';
  content: string;
}

/**
 * Get the Goose config directory path
 */
export const getSessionsDir = (): string => {
  return path.join(os.homedir(), '.config', 'goose', 'sessions');
};


/**
 * Find the most recently modified .jsonl file in the sessions directory
 */
export async function findMostRecentSessionFile(): Promise<string | null> {
  try {
    const sessionsDir = getSessionsDir();
    const dirEntries = await fs.readdir(sessionsDir, { withFileTypes: true });
    
    // Filter out directories and non-.jsonl files
    const files = dirEntries.filter(entry => 
      entry.isFile() && entry.name.endsWith('.jsonl')
    );

    if (files.length === 0) {
      return null;
    }

    const fileStats = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(sessionsDir, file.name);
        const stats = await fs.stat(filePath);
        return { path: filePath, mtime: stats.mtime };
      })
    );

    // Sort by modification time in descending order
    fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    return fileStats[0].path;
  } catch (error) {
    console.error('Error finding most recent session file:', error);
    return null;
  }
}

export async function loadSession(): Promise<Message[]> {
  try {
    const sessionFile = await findMostRecentSessionFile();
    if (!sessionFile) {
      return [];
    }

    const content = await fs.readFile(sessionFile, 'utf-8')
    const lines = content.toString().split('\n').filter(line => line.trim());

    return lines.map(line => {
      try {
        const jsonlMessage = JSON.parse(line);

        // Transform the JSONL message format to ChatWindow format
        let content = '';
        
        // Process each content item and track tool invocations
        let toolInvocations: any[] = [];
        let currentToolCall: any = null;
        
        if (jsonlMessage.content) {
          const contentParts: string[] = [];
          
          jsonlMessage.content.forEach((item: any) => {
            if (item.type === 'Text') {
              contentParts.push(item.text);
            } else if (item.type === 'ToolUse') {
              currentToolCall = {
                toolCallId: `tool-${jsonlMessage.id}-${toolInvocations.length}`,
                toolName: item.name,
                args: item.parameters,
                state: 'running'
              };
            } else if (item.type === 'ToolResult' && currentToolCall) {
              currentToolCall.state = 'result';
              currentToolCall.result = item.output;
              // Also add the result to content for display
              contentParts.push(`[Tool Result]:\n${item.output}`);
            }
            toolInvocations.push(currentToolCall);
          });
          
          content = contentParts.join('\n');
        }

        return {
          id: jsonlMessage.id,
          role: jsonlMessage.role as 'function' | 'system' | 'user' | 'assistant' | 'data' | 'tool',
          content: content,
          ...(toolInvocations.length > 0 && { toolInvocations })
        };
      } catch (e) {
        console.error('Error parsing session line:', e);
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    console.error('Error loading session:', error);
    return [];
  }
}

export async function saveSession(messages: Message[]): Promise<Message[]> {
  try {
    const sessionsDir = getSessionsDir();
    await fs.mkdir(sessionsDir, { recursive: true });

    const randomId = Math.random().toString(36).substring(2, 6);
    const sessionFile = path.join(sessionsDir, `${randomId}.jsonl`);

    const content = messages
      .map(message => JSON.stringify(message))
      .join('\n');

    await fs.writeFile(sessionFile, content, 'utf-8');
    return messages;
  } catch (error) {
    console.error('Error saving session:', error);
    return [];
  }
}