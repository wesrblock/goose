interface IElectronAPI {
  hideWindow: () => void;
  createChatWindow: (query: string) => void;
  resizeWindow: (width: number, height: number) => void;
  getWindowId: () => number;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}