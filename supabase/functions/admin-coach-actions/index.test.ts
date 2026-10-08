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

function setup({ authenticated = true, admin = true, adminError = false, queryError = false, empty = false, targetAdmin = false, targetMissing = false, records = {} as Record<string, unknown[]> } = {}) {
  const coaches = empty ? [] : [{ coach_id: "coach-1", email: "coach@example.test" }];
  const selectCoaches = vi.fn().mockResolvedValue({
    data: queryError ? null : coaches,
    error: queryError ? new Error("Query failed") : null,
  });
  const queries: Array<{ table: string; columns?: string; owner?: string; ranges: number[][] }> = [];
  const privilegedFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'admin_coach_summary_view') return { select: selectCoaches };
    if (table === 'super_admins') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: targetAdmin ? { user_id: 'protected-admin' } : null, error: null }) }) }) };
    const entry = { table, columns: '', owner: '', ranges: [] as number[][] }; queries.push(entry);
    const query = { select: (columns: string) => { entry.columns = columns; return query; }, eq: (column: string, owner: string) => { expect(column).toBe('coach_id'); entry.owner = owner; return query; }, order: () => query,
      range: async (from: number, to: number) => { entry.ranges.push([from, to]); return { data: queryError ? null : (records[table] ?? []).slice(from, to + 1), error: queryError ? new Error('Query failed') : null }; } };
    return query;
  });
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
  const resend = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ data: 2, error: null });
  const updateUserById = vi.fn().mockResolvedValue({ data: {}, error: null });
  const getUserById = vi.fn().mockResolvedValue({ data: { user: targetMissing ? null : { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'actual-coach@example.test' } }, error: null });
  const createClient = vi.fn()
    .mockReturnValueOnce({ auth: { getUser, resend }, from: callerFrom, rpc })
    .mockReturnValueOnce({ from: privilegedFrom, rpc, auth: { admin: { getUserById, updateUserById } } });
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
  const requestFrom = (origin: string) => handler(new Request("https://example.test/admin-coach-actions", { method: "POST", headers: { Authorization: "Bearer test-session", Origin: origin }, body: JSON.stringify({ action: "list-coaches" }) }));
  return { request, requestFrom, createClient, privilegedFrom, selectCoaches, callerFrom, eq, coaches, queries, resend, rpc, updateUserById, getUserById };
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

describe('canonical admin coach details and account controls', () => {
  const coachId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  it('denies nonadmins before any coach lookup or privileged data read', async () => {
    const app = setup({ admin: false });
    expect((await app.request({ action: 'coach-data', coachId, isSuperAdmin: true })).status).toBe(403);
    expect(app.getUserById).not.toHaveBeenCalled();
    expect(app.privilegedFrom).not.toHaveBeenCalled();
  });
  it('returns only the selected coach’s canonical dataset and paginates large rosters', async () => {
    const players = Array.from({ length: 501 }, (_, id) => ({ id, first_name: 'Invented' }));
    const app = setup({ records: { tracker_players: players, tracker_sessions: [{ id: 'session-a', credit_hours: 1.5 }] } });
    const response = await app.request({ action: 'coach-data', coachId });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.coachId).toBe(coachId); expect(data.players).toHaveLength(501); expect(data.sessions).toHaveLength(1);
    expect(app.queries.every(query => query.owner === coachId)).toBe(true);
    expect(app.queries.filter(query => query.table === 'tracker_players').flatMap(query => query.ranges)).toEqual([[0, 499], [500, 999]]);
    expect(app.queries.some(query => ['tracker_exit_codes', 'tracker_operations', 'roster', 'events'].includes(query.table))).toBe(false);
    expect(app.queries.every(query => !query.columns?.includes('*'))).toBe(true);
  });
  it('fails without returning partial coach records if any query fails', async () => {
    const app = setup({ queryError: true });
    const response = await app.request({ action: 'coach-data', coachId });
    expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: 'Query failed' });
  });
  it('rejects unknown coaches and malformed identities', async () => {
    const app = setup({ targetMissing: true });
    expect((await app.request({ action: 'coach-data', coachId })).status).toBe(404);
    expect(app.queries).toHaveLength(0);
    const malformed = setup();
    expect((await malformed.request({ action: 'coach-data', coachId: 'invalid' })).status).toBe(400);
    expect(malformed.getUserById).not.toHaveBeenCalled();
  });
  it('sends verification to the verified target email rather than a client-provided address', async () => {
    const app = setup();
    expect((await app.request({ action: 'resend-verification', coachId, email: 'different@example.test' })).status).toBe(200);
    expect(app.resend).toHaveBeenCalledWith({ type: 'signup', email: 'actual-coach@example.test', options: { emailRedirectTo: 'https://teamtracker.leftbraincreative.xyz/' } });
  });
  it.each(['force-logout', 'suspend-account', 'restore-account'])('protects a superuser from %s', async action => {
    const app = setup({ targetAdmin: true });
    expect((await app.request({ action, coachId })).status).toBe(403);
    expect(app.rpc).not.toHaveBeenCalled(); expect(app.updateUserById).not.toHaveBeenCalled();
  });
  it("revokes refresh sessions through the protected helper using the caller's authenticated client", async () => {
    const app = setup();
    expect((await app.request({ action: 'force-logout', coachId, adminId: 'forged' })).status).toBe(200);
    expect(app.rpc).toHaveBeenCalledWith('admin_revoke_coach_sessions_v1', { p_coach_id: coachId });
  });
});

describe("admin-coach-actions hardening (audit A9)", () => {
  it("allows the coach app origin and omits CORS approval for other sites", async () => {
    const allowed = await setup().requestFrom("https://teamtracker.leftbraincreative.xyz");
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://teamtracker.leftbraincreative.xyz");
    const other = await setup().requestFrom("https://evil.example");
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(other.headers.get("Vary")).toBe("Origin");
  });

  it("no longer offers the unused view-as-coach magic link", async () => {
    const app = setup();
    const response = await app.request({ action: "view-as-coach", coachId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain("link");
  });
});
