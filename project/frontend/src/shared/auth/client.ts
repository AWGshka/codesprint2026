import { createAuthClient } from "better-auth/solid";
import { adminClient, inferAdditionalFields, usernameClient } from "better-auth/client/plugins";

import { env } from "~/shared/config/env";

// Talks to the backend's Better Auth routes (/api/auth/*). Cookies flow via
// credentialed CORS, so the same client works in dev and across origins in prod.
// `adminClient()` gives the session's `user` a typed `role`/`banned` (the
// server's admin plugin already carries these; this just surfaces the types).
// `inferAdditionalFields()` types the server's `user.additionalFields`
// (`firstName`/`lastName`, registered in `backend/src/auth.ts`, D7 run 2) onto
// the session user and `updateUser`'s input - manually mirrored here since the
// frontend can't import the backend's `auth` instance to infer them directly.
export const authClient = createAuthClient({
  baseURL: env.apiBaseUrl,
  plugins: [
    usernameClient(),
    adminClient(),
    inferAdditionalFields({
      user: { firstName: { type: "string", required: false, input: true }, lastName: { type: "string", required: false, input: true } },
    }),
  ],
});
