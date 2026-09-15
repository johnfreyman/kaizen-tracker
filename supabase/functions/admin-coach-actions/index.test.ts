// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Exercise the deployed Deno handler in Node, replacing only the runtime and SDK.
const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8")
  .replace(/^import \{ createClient \} from .*;\n/, "");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function setup({ authenticated = true, admin = true, adminError = false, queryError = false, empty = false } = {}) {
  const coaches = empty ? [] : [{ coach_id: "coach-1", email: "coach@example.test" }];
  const selectCoaches = vi.fn().mockResolvedValue({
    data: queryError ? null : coaches,
    error: queryError ? new Error("Query failed") : null,
  });
  const privilegedFrom = vi.fn().mockReturnValue({ select: selectCoaches });
  const adminLookup = vi.fn().mockResolvedValue({
    data: admin ? { user_id: "caller-1" } : null,
    error: adminError ? new Error("Lookup failed") : null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle: adminLookup });
  const callerFrom = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) });
  const getUser = vi.fn().mockResolvedValue({
    data: { user: authenticated ? { id: "caller-1" } : null },
    error: authenticated ? null : new Error("Expired session"),
  });
  const createClient = vi.fn()
    .mockReturnValueOnce({ auth: { getUser }, from: callerFrom })
    .mockReturnValueOnce({ from: privilegedFrom });
  let handler!: (req: Request) => Promise<Response>;
  runInNewContext(compiled, {
    createClient, Request, Response, Error,
    Deno: {
      env: { get: (key: string) => key },
      serve: (fn: typeof handler) => { handler = fn; },
    },
  });
  const request = (body: object = { action: "list-coaches" }, authorization = "Bearer test-session") =>
    handler(new Request("https://example.test/admin-coach-actions", {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : {},
      body: JSON.stringify(body),
    }));
  return { request, createClient, privilegedFrom, selectCoaches, callerFrom, eq, coaches };
}

describe("admin-coach-actions list-coaches authorization", () => {
  it("returns coach summaries for a verified super admin without requiring coachId", async () => {
    const app = setup();
    const response = await app.request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ coaches: app.coaches });
    expect(app.callerFrom).toHaveBeenCalledWith("super_admins");
    expect(app.eq).toHaveBeenCalledWith("user_id", "caller-1");
    expect(app.privilegedFrom).toHaveBeenCalledWith("admin_coach_summary_view");
    expect(app.createClient.mock.calls[0][2].global.headers.Authorization).toBe("Bearer test-session");
  });

  it("rejects signed-out requests before creating a database client", async () => {
    const app = setup();
    expect((await app.request({ action: "list-coaches" }, "")).status).toBe(401);
    expect(app.createClient).not.toHaveBeenCalled();
  });

  it("rejects expired or invalid sessions before any privileged read", async () => {
    const app = setup({ authenticated: false });
    expect((await app.request()).status).toBe(401);
    expect(app.privilegedFrom).not.toHaveBeenCalled();
    expect(app.createClient).toHaveBeenCalledTimes(1);
  });

  it("rejects ordinary users even if they claim admin status in the request", async () => {
    const app = setup({ admin: false });
    const response = await app.request({ action: "list-coaches", isSuperAdmin: true, coachId: "admin-id" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(app.privilegedFrom).not.toHaveBeenCalled();
    expect(app.createClient).toHaveBeenCalledTimes(1);
  });

  it("fails closed if the admin lookup fails", async () => {
    const app = setup({ adminError: true });
    expect((await app.request()).status).toBe(403);
    expect(app.privilegedFrom).not.toHaveBeenCalled();
  });

  it("returns an empty list when there are no coaches", async () => {
    const app = setup({ empty: true });
    expect(await (await app.request()).json()).toEqual({ coaches: [] });
  });

  it("reports database failures instead of pretending the list is empty", async () => {
    const app = setup({ queryError: true });
    const response = await app.request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Query failed" });
  });

  it("still requires coachId for actions on an individual coach", async () => {
    const app = setup();
    expect((await app.request({ action: "suspend-account" })).status).toBe(400);
    expect(app.createClient).not.toHaveBeenCalled();
  });
});
