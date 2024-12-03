interface Session {
  id: string;
  title: string;
  lastModified: Date;
  messages: Array<{
    id: string;
    role: string;
    content: string;
  }>;
}

interface IElectronAPI {
  hideWindow: () => void;
  createChatWindow: (query: string) => void;
  getConfig: () => {
    GOOSE_SERVER__PORT: number;
    GOOSE_API_HOST: string;
    apiCredsMissing: boolean;
  };
  logInfo: (txt: string) => void;
  showNotification: (data: { title: string; body: string }) => void;
  createWingToWingWindow: (query: string) => void;
  openInChrome: (url: string) => void;
  fetchMetadata: (url: string) => Promise<string>;
  loadSessions: () => Promise<Session[]>;
  saveSession: (session: Session) => Promise<void>;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}