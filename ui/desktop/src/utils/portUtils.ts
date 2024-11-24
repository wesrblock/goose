import { createServer } from 'net';
import log from './logger';

export const findAvailablePort = (startPort: number): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try the next one
        server.close(() => {
          resolve(findAvailablePort(startPort + 1));
        });
      } else {
        reject(err);
      }
    });

    server.listen(startPort, '127.0.0.1', () => {
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

export const getPort = async (defaultPort: number = 3000): Promise<number> => {
  if (cachedPort !== null) {
    return cachedPort;
  }

  try {
    cachedPort = await findAvailablePort(defaultPort);
    return cachedPort;
  } catch (error) {
    log.error('Error finding available port:', error);
    throw error;
  }
};