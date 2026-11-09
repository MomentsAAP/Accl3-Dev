/**
 * Shared product service for the PDP blocks.
 * - getProduct(): one cached fetch of the product sheet (json), normalized for the blocks
 * - selection store: selected color / size shared between blocks
 * - blockText(): author-editable labels read from the block's `key | value` rows (da.live)
 * - productImage(): optimized, size-reserved image
 */
import { createOptimizedPicture, getMetadata, toClassName } from './aem.js';

// relative so it works on localhost, .aem.page and .aem.live (sheets send no CORS headers)
const DEFAULT_SHEET = '';
const OPTIMIZABLE_HOST = /\.(aem|hlx)\.(page|live)$/;
const IMAGE_KIND = /^(primary|colorpreview|\d+)$/;

const list = (raw) => String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const num = (raw) => {
  const n = parseFloat(String(raw ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export function formatPrice(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Optimized image with reserved dimensions (no layout shift).
 * Only AEM hosts support ?width=&format= so other hosts get a plain <img>.
 */
export function productImage(src, alt, {
  width, height, eager = false, breakpoints = [{ width: '750' }],
} = {}) {
  const url = new URL(src, window.location.href);
  let node;
  if (url.origin === window.location.origin || OPTIMIZABLE_HOST.test(url.hostname)) {
    node = createOptimizedPicture(url.href, alt, eager, breakpoints);
  } else {
    node = el('img');
    Object.assign(node, { src: url.href, alt, loading: eager ? 'eager' : 'lazy' });
  }
  const img = node.tagName === 'IMG' ? node : node.querySelector('img');
  if (width) img.setAttribute('width', width);
  if (height) img.setAttribute('height', height);
  img.decoding = 'async';
  if (eager) img.setAttribute('fetchpriority', 'high');
  return node;
}

/**
 * Groups image urls by color using the file name convention
 * `<sku...>_<color>_<kind>.png` where kind is primary | colorpreview | 1, 2, 3...
 * Missing primary -> first image; missing colorpreview -> primary.
 */
function groupImages(urls) {
  const groups = new Map();
  urls.forEach((src) => {
    const file = decodeURIComponent(src.split('?')[0].split('/').pop()).replace(/\.[^.]+$/, '');
    // underscores separate the fields, so a color may contain hyphens (midnight-black)
    const parts = file.split(file.includes('_') ? '_' : '-');
    const kind = parts[parts.length - 1].toLowerCase();
    const known = IMAGE_KIND.test(kind) && parts.length > 1;
    const raw = known ? parts[parts.length - 2] : '';
    const key = raw.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: raw.replace(/-/g, ' ').replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
        others: [],
      });
    }
    const group = groups.get(key);
    if (known && kind === 'primary') group.primary = src;
    else if (known && kind === 'colorpreview') group.preview = src;
    else group.others.push({ src, n: Number(known ? kind : 0) });
  });

  return [...groups.values()].map((g) => {
    const others = g.others.sort((a, b) => a.n - b.n).map((o) => o.src);
    const primary = g.primary || others.shift() || g.preview;
    return {
      key: g.key,
      name: g.name,
      preview: g.preview || primary,
      images: [...new Set([primary, g.preview, ...others])].filter(Boolean),
    };
  }).filter((g) => g.images.length);
}

function normalize(row) {
  const get = (...names) => String(names.map((n) => row[n])
    .find((v) => v !== undefined && String(v).trim() !== '') ?? '').trim();
  const price = num(row.price);
  const sale = num(row.salePrice);
  const onSale = price !== null && sale !== null && sale < price;
  const sku = get('skuID', 'sku');
  const colors = groupImages(list(row.pdpimages));
  const wanted = get('defaultColor').toLowerCase();
  const defaultColor = colors.find((c) => c.key === wanted || c.name.toLowerCase() === wanted);

  return {
    sku,
    title: get('title'),
    price,
    salePrice: onSale ? sale : null,
    discount: onSale ? Math.round(((price - sale) / price) * 100) : 0,
    rating: num(get('ratings', 'rating')),
    reviewCount: num(get('reviews', 'reviewCount')),
    reviewsUrl: `/${encodeURIComponent(sku.toLowerCase())}/reviews`,
    colors,
    defaultColor: (defaultColor || colors[0])?.key ?? '',
    sizes: list(get('size', 'sizes')),
    outOfStock: list(row.outOfStock),
    sizeGuide: get('sizeGuide'),
    tryOn: ['tryOn', 'tryOnEnabled'].some((n) => String(row[n]).toLowerCase() === 'true'),
    details: get('details'),
    washCare: get('washCare'),
    delivery: get('delivery'),
    moreInfo: get('moreInfo'),
  };
}

function productKey() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('skuID') || params.get('sku') || params.get('urlKey')
    || window.location.pathname.split('/').filter(Boolean).pop() || '').trim().toLowerCase();
}

async function fetchRows(sheet) {
  try {
    const resp = await fetch(sheet);
    if (!resp.ok) return [];
    const json = await resp.json();
    // multi-tab workbooks nest rows under each tab name, so use the first tab
    return json.data || json[json[':names']?.[0]]?.data || [];
  } catch (e) {
    return [];
  }
}

let productPromise;

/** @returns {Promise<Object|null>} normalized product for the current page, cached */
export function getProduct() {
  if (!productPromise) {
    productPromise = (async () => {
      const key = productKey();
      const rows = await fetchRows(getMetadata('product-sheet') || DEFAULT_SHEET);
      const row = rows.find((r) => [r.skuID, r.sku, r.urlKey]
        .some((v) => String(v || '').toLowerCase() === key));
      return row ? normalize(row) : null;
    })();
  }
  return productPromise;
}

/* selection store shared by the blocks */
const bus = new EventTarget();
const selection = { color: '', size: '' };

export const getSelection = () => ({ ...selection });

export function setSelection(patch) {
  Object.assign(selection, patch);
  bus.dispatchEvent(new CustomEvent('change', { detail: getSelection() }));
}

export function onSelection(fn) {
  bus.addEventListener('change', (e) => fn(e.detail));
}

/**
 * Reads author-editable text from the block's `key | value` rows,
 * falling back to defaults. Keys are lowercase, hyphenated ("Add to bag" -> add-to-bag).
 * Keys ending in `-url` return the link href when the author inserted a link.
 */
export function blockText(block, defaults) {
  const text = { ...defaults };
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    const name = toClassName(keyCell?.textContent || '');
    const link = valueCell?.querySelector('a');
    const value = name.endsWith('-url') && link
      ? link.getAttribute('href')
      : valueCell?.textContent.trim();
    if (name && value) text[name] = value;
  });
  return text;
}
