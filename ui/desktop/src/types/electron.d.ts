interface IElectronAPI {
  hideWindow: () => void;
  createChatWindow: (query: string) => void;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}