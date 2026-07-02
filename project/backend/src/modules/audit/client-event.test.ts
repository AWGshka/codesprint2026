import { describe, expect, it } from "bun:test";

import { app } from "~/app";

const BASE = "http://localhost";

// Logs in as the seeded "admin" demo user and returns the session cookie
// header value, for driving authenticated routes through `app.handle`.
const loginAsAdmin = async (): Promise<string> => {
  const res = await app.handle(
    new Request(`${BASE}/api/auth/sign-in/username`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "demo1234" }),
    }),
  );
  expect(res.status).toBe(200);

  const cookie = res.headers.get("set-cookie");
  expect(cookie).toBeTruthy();
  const firstCrumb = (cookie ?? "").split(";")[0];
  if (!firstCrumb) throw new Error("sign-in did not return a session cookie");
  return firstCrumb;
};

describe("POST /api/admin/audit/client-event", () => {
  it("accepts an optional allowlisted targetType/targetId and stores them", async () => {
    const cookie = await loginAsAdmin();

    const res = await app.handle(
      new Request(`${BASE}/api/admin/audit/client-event`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ action: "ledger.export.pdf", targetType: "ledger", targetId: "export-scope-all" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: { recorded: true } });

    const listRes = await app.handle(new Request(`${BASE}/api/admin/audit?action=ledger.export.pdf&pageSize=1`, { headers: { cookie } }));
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: { rows: { targetType: string | null; targetId: string | null }[] } };
    const [latest] = listBody.data.rows;
    expect(latest?.targetType).toBe("ledger");
    expect(latest?.targetId).toBe("export-scope-all");
  });

  it("rejects a targetType outside the allowlist with a validation error", async () => {
    const cookie = await loginAsAdmin();

    const res = await app.handle(
      new Request(`${BASE}/api/admin/audit/client-event`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ action: "ledger.export.pdf", targetType: "not-a-real-type" }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it("still records without targetType/targetId (backward compatible)", async () => {
    const cookie = await loginAsAdmin();

    const res = await app.handle(
      new Request(`${BASE}/api/admin/audit/client-event`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ action: "ledger.export.pdf" }),
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /api/campaigns (public discover)", () => {
  it("returns active campaigns each with a progress object (no crash)", async () => {
    const res = await app.handle(new Request(`${BASE}/api/campaigns`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { progress: { raisedMinor: number; targetMinor: number; donorCount: number } }[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    for (const c of body.data) {
      expect(c.progress).toBeDefined();
      expect(typeof c.progress.raisedMinor).toBe("number");
      expect(typeof c.progress.targetMinor).toBe("number");
      expect(typeof c.progress.donorCount).toBe("number");
    }
  });
});
