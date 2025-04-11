import fs from "fs";
import path from "path";

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tmpPidFile = path.resolve(__dirname, "./servers.json");

export default async function globalTeardown() {
  if (!fs.existsSync(tmpPidFile)) return;

  const { authPid, appPid } = JSON.parse(fs.readFileSync(tmpPidFile, "utf-8"));

  for (const pid of [authPid, appPid]) {
    try {
      process.kill(pid);
      console.log(`✅ Killed process ${pid}`);
    } catch (e) {
      console.warn(`⚠️ Could not kill process ${pid}`, e);
    }
  }

  fs.unlinkSync(tmpPidFile);
}
