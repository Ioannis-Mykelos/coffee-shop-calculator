import { afterEach, describe, expect, it, vi } from 'vitest';
import { allow, clientIp, memoryCounter, redisCounter, sharedCounter } from './rate-limit';

const HOUR = 60 * 60 * 1000;
const T0 = 1_000 * HOUR;

/** A fake Upstash REST API: answers /pipeline with INCR results kept in a map. */
function fakeUpstash() {
  const counts = new Map<string, number>();
  const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const [[, key]] = JSON.parse(String(init?.body)) as string[][];
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return Response.json([{ result: counts.get(key) }, { result: 1 }]);
  });
  return { counts, fetchFn: fetchFn as unknown as typeof fetch, calls: fetchFn.mock.calls };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('allow (in memory)', () => {
  it('allows up to the limit in a window, then refuses until the window ends', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await allow('mem:a', 3, HOUR, T0 + i, memoryCounter));
    expect(results).toEqual([true, true, true, false]);
    expect(await allow('mem:a', 3, HOUR, T0 + HOUR - 1, memoryCounter)).toBe(false);
    expect(await allow('mem:a', 3, HOUR, T0 + HOUR, memoryCounter)).toBe(true);
  });

  it('counts each key on its own', async () => {
    expect(await allow('mem:b', 1, HOUR, T0, memoryCounter)).toBe(true);
    expect(await allow('mem:b', 1, HOUR, T0, memoryCounter)).toBe(false);
    expect(await allow('mem:c', 1, HOUR, T0, memoryCounter)).toBe(true);
  });
});

describe('redisCounter', () => {
  it('increments one key per window and sets it to expire with the window', async () => {
    const upstash = fakeUpstash();
    const count = redisCounter('https://eu.upstash.io/', 'tok', upstash.fetchFn);
    expect(await count('join:1.2.3.4', HOUR, T0)).toBe(1);
    expect(await count('join:1.2.3.4', HOUR, T0 + 5)).toBe(2);
    expect(await count('join:1.2.3.4', HOUR, T0 + HOUR)).toBe(1);

    const [url, init] = upstash.calls[0];
    expect(url).toBe('https://eu.upstash.io/pipeline');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(init?.body))).toEqual([
      ['INCR', 'crema:rl:join:1.2.3.4:1000'],
      ['PEXPIRE', 'crema:rl:join:1.2.3.4:1000', String(HOUR)],
    ]);
  });

  it('throws when Upstash refuses the request', async () => {
    const fetchFn = (async () => Response.json([{ error: 'WRONGPASS' }])) as unknown as typeof fetch;
    await expect(redisCounter('https://x', 'bad', fetchFn)('k', HOUR, T0)).rejects.toThrow('WRONGPASS');
  });
});

describe('sharedCounter', () => {
  it('uses Upstash when its REST URL and token are set, under either name', async () => {
    for (const [url, token] of [
      ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
      ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    ]) {
      const upstash = fakeUpstash();
      vi.stubGlobal('fetch', upstash.fetchFn);
      vi.stubEnv(url, 'https://eu.upstash.io');
      vi.stubEnv(token, 'tok');
      await sharedCounter(`shared:${url}`, HOUR, T0);
      expect(upstash.calls).toHaveLength(1);
      vi.unstubAllEnvs();
    }
  });

  it('counts in memory when Upstash is not set up', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('KV_REST_API_URL', '');
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    expect(await sharedCounter('shared:none', HOUR, T0)).toBe(1);
    expect(await sharedCounter('shared:none', HOUR, T0)).toBe(2);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('falls back to memory when Upstash fails, so a Redis outage never blocks players', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://eu.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok');
    vi.stubGlobal('fetch', async () => new Response('down', { status: 503 }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await sharedCounter('shared:down', HOUR, T0)).toBe(1);
    expect(await sharedCounter('shared:down', HOUR, T0)).toBe(2);
    warn.mockRestore();
  });
});

describe('clientIp', () => {
  it("takes Netlify's client address, then the first x-forwarded-for address, then x-real-ip", () => {
    expect(clientIp(new Headers({ 'x-nf-client-connection-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4' }))).toBe('9.9.9.9');
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
    expect(clientIp(new Headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});
