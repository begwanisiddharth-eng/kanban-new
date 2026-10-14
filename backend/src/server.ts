import { existsSync } from "node:fs";

import { createApp } from "./app";

const ENV_FILE = new URL("../../.env", import.meta.url);
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const port = Number(process.env.PORT ?? 4000);

createApp().listen(port, () => {
  console.log(`Kanban server listening on http://localhost:${port}`);
});
