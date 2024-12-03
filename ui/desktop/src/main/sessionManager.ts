import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Session {
  id: string;
  title: string;
  lastModified: Date;
  messages: Array<{
    id: string;
    role: string;
    content: string;
  }>;
}

export class SessionManager {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = path.join(app.getPath('home'), '.config', 'goose', 'sessions');
  }

  async initialize() {
    try {
      await fs.access(this.sessionsDir);
    } catch {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    }
  }

  async loadSessions(): Promise<Session[]> {
    const files = await fs.readdir(this.sessionsDir);
    const sessions: Session[] = [];

    // Get all .jsonl files with their stats
    const fileStats = await Promise.all(
      files
        .filter(file => file.endsWith('.jsonl'))
        .map(async file => ({
          name: file,
          stats: await fs.stat(path.join(this.sessionsDir, file))
        }))
    );

    // Sort by modification time and take the 5 most recent
    const recentFiles = fileStats
      .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime())
      .slice(0, 5)
      .map(f => f.name);

    // Load only the recent files
    for (const file of recentFiles) {
      try {
        const filePath = path.join(this.sessionsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');
        
        if (lines.length > 0) {
          // Parse the first message to get the title
          const firstMessage = JSON.parse(lines[0]);
          const title = typeof firstMessage.content === 'string' 
            ? firstMessage.content.slice(0, 50) 
            : Array.isArray(firstMessage.content) && firstMessage.content[0]?.text
              ? firstMessage.content[0].text.slice(0, 50)
              : file;

          const messages = lines.map(line => {
            const msg = JSON.parse(line);
            return {
              id: msg.id,
              role: msg.role,
              content: typeof msg.content === 'string' 
                ? msg.content 
                : JSON.stringify(msg.content),
            };
          });

          sessions.push({
            id: file.replace('.jsonl', ''),
            title: title + '...',
            lastModified: (await fs.stat(filePath)).mtime,
            messages,
          });
        }
      } catch (error) {
        console.error(`Error loading session ${file}:`, error);
      }
    }

    return sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  async saveSession(session: Session): Promise<void> {
    const fileName = `${session.id}.jsonl`;
    const filePath = path.join(this.sessionsDir, fileName);

    const content = session.messages
      .map(msg => JSON.stringify({
        role: msg.role,
        id: msg.id,
        created: Math.floor(Date.now() / 1000),
        content: msg.content,
      }))
      .join('\n');

    await fs.writeFile(filePath, content, 'utf-8');
  }
}