/** How long a request may take before it fails, like a stalled `fetch` would eventually. */
const TIMEOUT_MS = 30_000;

/** Turns the raw "Name: value\r\n" header block from GM.xmlHttpRequest into Headers. */
export function parseHeaders(raw: string): Headers {
  const headers = new Headers();
  for (const line of raw.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    try {
      headers.append(line.slice(0, i).trim(), line.slice(i + 1).trim());
    } catch {
      // Skip header names the Headers class rejects.
    }
  }
  return headers;
}

/**
 * A `fetch` that goes through the userscript manager, which can reach origins the page's
 * CORS rules would block. It covers what Vivalko sends: a method, string headers and a
 * string body. The response body is always read as bytes so text, JSON and images all work.
 */
export function gmFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  const body = init.body ?? undefined;
  if (body !== undefined && typeof body !== 'string') {
    return Promise.reject(new TypeError('gmFetch only sends string bodies'));
  }
  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((value, name) => (headers[name] = value));

  return new Promise((resolve, reject) => {
    const fail = (what: string) => () => reject(new TypeError(`${what}: ${url}`));
    GM.xmlHttpRequest({
      url,
      method: init.method ?? 'GET',
      headers,
      data: body,
      responseType: 'arraybuffer',
      timeout: TIMEOUT_MS,
      onload(res) {
        // Status 0 means the request never got a response.
        if (res.status < 200 || res.status > 599) {
          reject(new TypeError(`Network request failed: ${url}`));
          return;
        }
        // 204 and 304 responses cannot have a body.
        const body = res.status === 204 || res.status === 304 ? null : (res.response as ArrayBuffer | null);
        resolve(new Response(body, { status: res.status, statusText: res.statusText, headers: parseHeaders(res.responseHeaders) }));
      },
      onerror: fail('Network request failed'),
      ontimeout: fail('Request timed out'),
      onabort: fail('Request aborted'),
    });
  });
}
