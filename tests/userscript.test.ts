import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gmFetch, parseHeaders } from '../userscript/gm-fetch';
import { storage } from '../userscript/gm-storage';

/** An in-memory GM API; `xhr` answers each request. */
function fakeGM(xhr: (d: GM.XhrDetails) => void = () => {}) {
  const values = new Map<string, unknown>();
  const gm = {
    xmlHttpRequest: vi.fn(xhr),
    getValue: async (k: string, d?: unknown) => (values.has(k) ? structuredClone(values.get(k)) : d),
    setValue: async (k: string, v: unknown) => void values.set(k, structuredClone(v)),
    deleteValue: async (k: string) => void values.delete(k),
    listValues: async () => [...values.keys()],
  };
  vi.stubGlobal('GM', gm);
  return { gm, values };
}

const bytes = (s: string) => new TextEncoder().encode(s).buffer;

describe('gm-storage', () => {
  beforeEach(() => fakeGM());
  afterEach(() => vi.unstubAllGlobals());

  it('drops the area prefix and returns null for missing items', async () => {
    await storage.setItem('local:vivino:1', { a: 1 });
    expect(await storage.getItem('local:vivino:1')).toEqual({ a: 1 });
    expect(await storage.getItem('local:missing')).toBeNull();
    expect(await storage.snapshot('local')).toEqual({ 'vivino:1': { a: 1 } });
  });

  it('removes items and falls back for defined items', async () => {
    const item = storage.defineItem<boolean>('local:enabled', { fallback: true });
    expect(await item.getValue()).toBe(true);
    await item.setValue(false);
    expect(await item.getValue()).toBe(false);
    await storage.removeItems(['local:enabled']);
    expect(await item.getValue()).toBe(true);
  });
});

describe('gm-fetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses raw header blocks', () => {
    const h = parseHeaders('Content-Type: image/jpeg\r\nX-A: b: c\r\n\r\n');
    expect(h.get('content-type')).toBe('image/jpeg');
    expect(h.get('x-a')).toBe('b: c');
  });

  it('sends method, headers and body, and returns a Response', async () => {
    const { gm } = fakeGM((d) =>
      d.onload!({ readyState: 4, status: 200, statusText: 'OK', responseHeaders: 'content-type: application/json', response: bytes('{"ok":1}') }),
    );
    const res = await gmFetch('https://example.com/q', { method: 'POST', headers: { 'X-Key': 'k' }, body: 'hi' });
    expect(await res.json()).toEqual({ ok: 1 });
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(gm.xmlHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/q', method: 'POST', headers: { 'x-key': 'k' }, data: 'hi', responseType: 'arraybuffer' }),
    );
  });

  it('passes HTTP errors through but rejects when there is no response', async () => {
    fakeGM((d) => d.onload!({ readyState: 4, status: 404, statusText: 'Not Found', responseHeaders: '', response: bytes('') }));
    expect((await gmFetch('https://example.com/')).status).toBe(404);

    fakeGM((d) => d.onload!({ readyState: 4, status: 0, statusText: '', responseHeaders: '', response: null }));
    await expect(gmFetch('https://example.com/')).rejects.toThrow(TypeError);

    fakeGM((d) => d.ontimeout!({ readyState: 4, status: 0, statusText: '', responseHeaders: '', response: null }));
    await expect(gmFetch('https://example.com/')).rejects.toThrow(/timed out/);
  });
});
