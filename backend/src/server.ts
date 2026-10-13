import { createApp } from "./app";

const port = Number(process.env.PORT ?? 4000);

createApp().listen(port, () => {
  console.log(`Kanban server listening on http://localhost:${port}`);
});
