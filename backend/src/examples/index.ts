import { httpExample } from "./http";
import { streamExample } from "./stream";
import { webhookExample } from "./webhook";

import { Elysia } from "elysia";

// Deletable reference endpoints under /examples — http, stream, webhook.
// Remove this folder and its `.use(examples)` in app.ts for a real project.
export const examples = new Elysia({ prefix: "/examples" }).use(httpExample).use(streamExample).use(webhookExample);
