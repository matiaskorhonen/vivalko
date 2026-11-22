/**
 * Stands in for `wxt/utils/storage` in the userscript build, keeping values with the
 * userscript manager's GM.getValue and friends. It covers only what Vivalko's shared code
 * calls. WXT keys carry an area prefix ("local:enabled"); GM storage has one area per
 * script, so the prefix is dropped.
 */

type StorageKey = `local:${string}` | `session:${string}` | `sync:${string}` | `managed:${string}`;

function gmKey(key: string): string {
  return key.slice(key.indexOf(':') + 1);
}

async function getItem<T>(key: StorageKey): Promise<T | null> {
  const value = await GM.getValue<T>(gmKey(key));
  return value === undefined ? null : value;
}

async function setItem<T>(key: StorageKey, value: T): Promise<void> {
  // WXT removes an item when it is set to null or undefined.
  if (value == null) await GM.deleteValue(gmKey(key));
  else await GM.setValue(gmKey(key), value);
}

async function removeItems(keys: StorageKey[]): Promise<void> {
  await Promise.all(keys.map((k) => GM.deleteValue(gmKey(k))));
}

/** Every stored value. There is only one area, so `area` is ignored. */
async function snapshot(_area: string): Promise<Record<string, unknown>> {
  const keys = await GM.listValues();
  const values = await Promise.all(keys.map((k) => GM.getValue(k)));
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
}

function defineItem<T>(key: StorageKey, { fallback }: { fallback: T }) {
  return {
    getValue: async (): Promise<T> => (await getItem<T>(key)) ?? fallback,
    setValue: (value: T): Promise<void> => setItem(key, value),
  };
}

export const storage = { getItem, setItem, removeItems, snapshot, defineItem };
