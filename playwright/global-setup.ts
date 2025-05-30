import { spawn } from 'child_process';
import waitOn from 'wait-on';
import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tmpPidFile = path.resolve(__dirname, './servers.json');

export default async function globalSetup() {
  const authServer = spawn('npm', ['run', 'start-local'], { stdio: 'inherit' });
  const appServer = spawn('npx', ['http-server', './dist', '-p', '8080', '-s'], {
    stdio: 'inherit',
    shell: true,
  });

  // Wait for both servers to be ready
  await waitOn({
    resources: ['http://localhost:8080'],
    timeout: 5_000,
  });

  // Save PIDs to file
  fs.writeFileSync(
    tmpPidFile,
    JSON.stringify({
      authPid: authServer.pid,
      appPid: appServer.pid,
    }),
  );
}
