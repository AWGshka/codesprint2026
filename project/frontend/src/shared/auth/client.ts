import { createAuthClient } from "better-auth/solid";
import { adminClient, usernameClient } from "better-auth/client/plugins";

import { env } from "~/shared/config/env";

// Talks to the backend's Better Auth routes (/api/auth/*). Cookies flow via
// credentialed CORS, so the same client works in dev and across origins in prod.
// `adminClient()` gives the session's `user` a typed `role`/`banned` (the
// server's admin plugin already carries these; this just surfaces the types).
export const authClient = createAuthClient({ baseURL: env.apiBaseUrl, plugins: [usernameClient(), adminClient()] });
