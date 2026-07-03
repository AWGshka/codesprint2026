import { Elysia } from "elysia";

// Returning an async generator streams each yield to the client as produced.
export const streamExample = new Elysia({ prefix: "/stream" }).get(
  "/countdown",
  async function* () {
    for (let i = 3; i > 0; i--) {
      yield `${i}\n`;
      await Bun.sleep(300);
    }

    yield "liftoff\n";
  },
  { detail: { summary: "Stream chunks via an async generator", tags: ["Examples"] } },
);
