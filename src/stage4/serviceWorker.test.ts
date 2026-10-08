// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { SHELL_VERSION } from './types';

function worker(marker: string) {
  const entries = new Map([[marker, new Response('503')]]);
  const handlers: Record<string, (event: unknown) => void> = {};
  const fetch = vi.fn(async () => new Response('{"accepted":true}'));
  runInNewContext(readFileSync('public/sw-stage4.js', 'utf8'), {
    self: { addEventListener: (name: string, handle: (event: unknown) => void) => { handlers[name] = handle; } },
    URL, Response, fetch,
    caches: { open: async () => ({ match: async (key: string) => entries.get(key), delete: async (key: string) => entries.delete(key) }) },
  });
  async function request(name: string): Promise<Response> {
    let response: Promise<Response> | undefined;
    handlers.fetch({ request: new Request(`https://viouquduxutuslafiooy.supabase.co/rest/v1/rpc/${name}`, { method: 'POST' }), respondWith: (value: Promise<Response>) => { response = value; } });
    return response!;
  }
  return { entries, fetch, request };
}

describe('isolated browser operation fault controls', () => {
  it('keeps a lost acknowledgment armed through snapshot reads, then drops one accepted operation response', async () => {
    const marker = '/__stage4_drop_ack__';
    const test = worker(marker);
    expect((await test.request('tracker_raffle_snapshot_v1')).status).toBe(200);
    expect(test.entries.has(marker)).toBe(true);
    expect((await test.request('tracker_apply_raffle_operation_v1')).type).toBe('error');
    expect(test.entries.has(marker)).toBe(false);
    expect((await test.request('tracker_apply_raffle_operation_v1')).status).toBe(200);
    expect(test.fetch).toHaveBeenCalledTimes(3);
  });

  it('keeps a forced 503 armed through snapshot reads and fails only the next operation before sending it', async () => {
    const marker = '/__stage4_fail_rpc__';
    const test = worker(marker);
    expect((await test.request('tracker_raffle_snapshot_v1')).status).toBe(200);
    expect(test.entries.has(marker)).toBe(true);
    const response = await test.request('tracker_apply_raffle_operation_v1');
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('PGRST002');
    expect(test.entries.has(marker)).toBe(false);
    expect(test.fetch).toHaveBeenCalledTimes(1);
    expect((await test.request('tracker_apply_raffle_operation_v1')).status).toBe(200);
  });
});

describe('release service worker boundary', () => {
  it('uses the same cache version as the coach app', () => {
    expect(readFileSync('public/sw-release.js', 'utf8')).toContain(`const CACHE = 'kaizen-release-${SHELL_VERSION}';`);
  });

  it('leaves Supabase requests to the browser network stack', () => {
    const handlers: Record<string, (event: unknown) => void> = {};
    runInNewContext(readFileSync('public/sw-release.js', 'utf8'), {
      self: { location: { origin: 'https://coach.example' }, addEventListener: (name: string, handle: (event: unknown) => void) => { handlers[name] = handle; } },
      URL,
    });
    const respondWith = vi.fn();
    handlers.fetch({ request: new Request('https://pwgqwcvultxihntvaewo.supabase.co/rest/v1/rpc/tracker_apply_operation_v1', { method: 'POST' }), respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  });
});
