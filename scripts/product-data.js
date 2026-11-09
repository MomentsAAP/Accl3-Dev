export const normalize = (v) => String(v ?? '').trim().toLowerCase();
export function toList(value) { /* as today */ }
export function normalizeProduct(raw, index = 0) { /* as today */ }

/** First sheet's rows from an EDS JSON (single- or multi-sheet). Cached per URL. */
const cache = new Map();
export function loadRows(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`${url} returned ${r.status}`); return r.json(); })
      .then((json) => {
        if (Array.isArray(json.data)) return json.data;
        const sheet = Object.values(json).find((v) => v && Array.isArray(v.data));
        return sheet ? sheet.data : [];
      })
      .catch((e) => { cache.delete(url); return []; }));
  }
  return cache.get(url);
}