import { createServer } from 'net';
import log from './logger';

export const findAvailablePort = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = createServer();


    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => {
        log.info(`Found available port: ${port}`);
        resolve(port);
      });
    });
  });
};

// Cache the port once found to ensure consistency
let cachedPort: number | null = null;

export const getPort = async (): Promise<number> => {
  if (cachedPort !== null) {
    return cachedPort;
  }

  try {
    cachedPort = await findAvailablePort();
    return cachedPort;
  } catch (error) {
    log.error('Error finding available port:', error);
    throw error;
  }
};