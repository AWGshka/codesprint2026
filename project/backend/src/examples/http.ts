import { Elysia, t } from "elysia";

import { data, ok } from "~/lib/response";

// Plain request/response: validated query + body, standard { data } envelope.
export const httpExample = new Elysia({ prefix: "/http" })
  .get("/hello", ({ query }) => ok({ message: `Hello, ${query.name ?? "world"}!` }), {
    query: t.Object({ name: t.Optional(t.String()) }),
    response: { 200: data(t.Object({ message: t.String() })) },
    detail: { summary: "Greeting with an optional query param", tags: ["Examples"] },
  })
  .post("/echo", ({ body }) => ok(body), {
    body: t.Object({ value: t.String() }),
    response: { 200: data(t.Object({ value: t.String() })) },
    detail: { summary: "Echo a validated JSON body", tags: ["Examples"] },
  });
