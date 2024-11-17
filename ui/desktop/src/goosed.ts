import path from 'node:path';
import { spawn } from 'child_process';

// Start the goosed binary
export const start = (app) => {
  // In development, the binary is in src/bin
  // In production, it will be in the resources/bin directory
  const isDev = process.env.NODE_ENV === 'development';
  let goosedPath: string;

  if (isDev) {
    // In development, use the absolute path from the project root
    goosedPath = path.join(process.cwd(), 'src', 'bin', process.platform === 'win32' ? 'goosed.exe' : 'goosed');
  } else {
    // In production, use the path relative to the app resources
    goosedPath = path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'goosed.exe' : 'goosed');
  }

  console.log(`Starting goosed from: ${goosedPath}`);

  const goosedProcess = spawn(goosedPath);

  goosedProcess.stdout.on('data', (data) => {
    console.log(`goosed stdout: ${data}`);
  });

  goosedProcess.stderr.on('data', (data) => {
    console.error(`goosed stderr: ${data}`);
  });

  goosedProcess.on('close', (code) => {
    console.log(`goosed process exited with code ${code}`);
  });

  goosedProcess.on('error', (err) => {
    console.error('Failed to start goosed:', err);
  });

  // Ensure goosed is terminated when the app quits
  app.on('will-quit', () => {
    goosedProcess.kill();
  });
};
