import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const SESSIONS_PATH = path.join(app.getPath('userData'), 'sessions');
if (!fs.existsSync(SESSIONS_PATH)) {
    fs.mkdirSync(SESSIONS_PATH);
}

interface Session {
    name: string; // Derived from a synopsis of the conversation
    messages: Array<{
        id: number;
        role: 'function' | 'system' | 'user' | 'assistant' | 'data' | 'tool';
        content: string;
    }>;
    directory: string;
}

function generateSessionName(messages: object[]): string {
    // Create a session name based on the first message or a combination of initial messages
    if (messages === undefined || messages.length === 0) return 'empty_session';
    return messages[0].content.split(' ').slice(0, 5).join(' ');
}

export function saveSession(session: Session): string {
    try {
        const sessionData = {
            ...session,
            name: generateSessionName(session.messages)
        };
        const filePath = path.join(SESSIONS_PATH, `${sessionData.name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
        console.log('Session saved:', sessionData);
        return sessionData.name;
    } catch (error) {
        console.error('Error saving session:', error);
    }
}

export function loadSessions(): Session[] {
    try {
        console.log('Attempting to load sessions from:', SESSIONS_PATH);
    const files = fs.readdirSync(SESSIONS_PATH);
    if (files.length === 0) {
        console.warn('No session files found in directory');
    } else {
        console.log('Session files found:', files);
    }
        return files.map(file => {
            const data = fs.readFileSync(path.join(SESSIONS_PATH, file), 'utf8');
            return JSON.parse(data) as Session;
        });
    } catch (error) {
        console.error('Error loading sessions:', error);
        return [];
    }
}

export function clearAllSessions(): void {
    try {
        const files = fs.readdirSync(SESSIONS_PATH);
        files.forEach(file => fs.unlinkSync(path.join(SESSIONS_PATH, file)));
        console.log('All sessions cleared');
    } catch (error) {
        console.error('Error clearing sessions:', error);
    }
}
