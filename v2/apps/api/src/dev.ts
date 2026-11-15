import { serve } from "@hono/node-server";
import app from "./index.ts";

const port = Number(process.env.PORT ?? 5050);
serve({ fetch: app.fetch, port }, () => console.log(`Roy API v2: http://localhost:${port}`));
