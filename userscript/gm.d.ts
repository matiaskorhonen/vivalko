/**
 * The parts of the Greasemonkey 4 `GM` API the userscript uses. Userscripts (Safari),
 * Tampermonkey and Violentmonkey all provide them when granted with `@grant`.
 */
declare namespace GM {
  interface XhrResponse {
    readyState: number;
    status: number;
    statusText: string;
    responseHeaders: string;
    response: unknown;
    responseURL?: string;
    finalUrl?: string;
  }

  interface XhrDetails {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    data?: string;
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';
    timeout?: number;
    onload?: (res: XhrResponse) => void;
    onerror?: (res: XhrResponse) => void;
    ontimeout?: (res: XhrResponse) => void;
    onabort?: (res: XhrResponse) => void;
  }

  function xmlHttpRequest(details: XhrDetails): unknown;
  function getValue<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  function setValue(key: string, value: unknown): Promise<void>;
  function deleteValue(key: string): Promise<void>;
  function listValues(): Promise<string[]>;
}
