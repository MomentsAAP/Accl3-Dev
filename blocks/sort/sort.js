/*
 * Sort block: the "SORT BY ▾" dropdown, plus the sort logic and
 * shared sort state that the Products block imports.
 * Picking an option calls setSort -> "sort-changed" event; Products listens and re-orders.
 *
 * Authoring: one row per dropdown option, in the order shown. Row 1 is the default
 * (selected on page load). Known text ("top rated", "high to low", "low to high", ...)
 * runs that sort; any other text is shown as written and sorts like row 1.
 * See readOptions() for details and the older "Default | <sort>" format.
 */

/* ================================================================== */
/* 1. DATA LOADING (used by test-sort.mjs in Node or the browser)      */
/* ================================================================== */

let productsCache = [];
//let currentJsonUrl = './dummy_products.json';

export async function loadProductsData(jsonUrl) {
  if (jsonUrl && jsonUrl !== currentJsonUrl) {
    currentJsonUrl = jsonUrl;
    productsCache = [];
  }

  if (productsCache.length > 0) {
    return [...productsCache];
  }

  try {
    let json;

    // 1. If running in Browser OR using a live http/https JSON link -> use fetch()
    if (typeof window !== 'undefined' || currentJsonUrl.startsWith('http')) {
      const response = await fetch(currentJsonUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      json = await response.json();
    } else {
      // 2. If testing a local file in Node.js terminal -> use readFile()
      const { readFile } = await import('node:fs/promises');
      const { resolve } = await import('node:path');
      const cleanPath = currentJsonUrl.replace(/^\.?\//, '');
      const fileText = await readFile(resolve(process.cwd(), cleanPath), 'utf-8');
      json = JSON.parse(fileText);
    }

    productsCache = Array.isArray(json.data) ? json.data : [];
    return [...productsCache];
  } catch (error) {
    console.error('Error fetching EDS JSON data:', error.message);
    return [];
  }
}

/* ================================================================== */
/* 2. SORTING LOGIC (pure: no DOM)                                     */
/* ================================================================== */

/** First finite number among the given values, else NaN. */
function firstNumber(...values) {
  const found = values.map((v) => parseFloat(v)).find(Number.isFinite);
  return found ?? NaN;
}

/*
 * Field readers that work for both shapes of product:
 * - normalized products from the Products block (effectivePrice, ratings, reviews)
 * - raw sheet rows (Product_Actual_Pricing, Rating, No_of_Raters)
 */
const priceOf = (p) => firstNumber(p.effectivePrice, p.Product_Actual_Pricing, p.price);
const ratingOf = (p) => firstNumber(p.ratings, p.Rating) || 0;
const ratersOf = (p) => firstNumber(p.reviews, p.No_of_Raters) || 0;

/**
 * Sort options, in the order shown in the UI.
 * Any other value (e.g. `default`) keeps the sheet order. `rating` is an alias of
 * `relevant`, kept for scripts such as test-sort.mjs.
 */
export const SORT_OPTIONS = [
  { value: 'price-asc', label: 'Price: Low to High', aliases: ['low-high', 'ascending', 'lowest'] },
  { value: 'price-desc', label: 'Price: High to Low', aliases: ['high-low', 'descending', 'highest'] },
  // Top Rated = highest rated first, lowest rated last (value stays 'relevant';
  // "Relevant" is still accepted from authored content)
  {
    value: 'relevant',
    label: 'Top Rated',
    aliases: ['relevant', 'relevance', 'most relevant', 'rating', 'best rated', 'default'],
  },
];

const RATING_SORTS = ['relevant', 'rating'];

/** Initial sort when the author gives no (valid) default. */
export const DEFAULT_SORT = 'relevant';

/**
 * Return a sorted copy of `list` (the input is never mutated).
 * Products without a price always go to the end of a price sort.
 * Rating sort (Top Rated): highest rating first; equal ratings -> more reviews first;
 * products without a rating count as 0, so they come last.
 */
export function sortProductList(list, sortBy = 'default') {
  if (!Array.isArray(list)) return [];
  const byRating = RATING_SORTS.includes(sortBy);
  if (!byRating && !['price-asc', 'price-desc'].includes(sortBy)) return [...list];

  return [...list].sort((a, b) => {
    if (byRating) {
      return (ratingOf(b) - ratingOf(a)) || (ratersOf(b) - ratersOf(a));
    }
    const priceA = priceOf(a);
    const priceB = priceOf(b);
    const hasA = Number.isFinite(priceA);
    const hasB = Number.isFinite(priceB);
    if (!hasA || !hasB) return Number(!hasA) - Number(!hasB);
    return sortBy === 'price-asc' ? priceA - priceB : priceB - priceA;
  });
}

/** Load a sheet and sort it in one go (used by test-sort.mjs). */
export async function sortProducts(sortBy = 'default', jsonUrl) {
  const data = await loadProductsData(jsonUrl);
  return sortProductList(data, sortBy);
}

/* ================================================================== */
/* 3. SHARED SORT STATE + EVENT (Sort block -> Products block)         */
/* ================================================================== */

export const SORT_CHANGED = 'sort-changed';

let currentSort = 'default'; // sheet order until a Sort block picks one

/** Latest sort value. Lets a block that loads late catch up. */
export function getCurrentSort() {
  return currentSort;
}

/** Remember the new sort and announce it to the whole page. */
export function setSort(value) {
  currentSort = value;
  document.dispatchEvent(new CustomEvent(SORT_CHANGED, { detail: value }));
}

/** Listen for sort changes. Returns a function that stops listening. */
export function onSortChanged(handler) {
  const listener = (event) => handler(event.detail);
  document.addEventListener(SORT_CHANGED, listener);
  return () => document.removeEventListener(SORT_CHANGED, listener);
}

/* ================================================================== */
/* 4. DROPDOWN UI                                                      */
/* ================================================================== */

const CHEVRON_ICON = '<svg class="sort-chevron" viewBox="0 0 24 24"'
  + ' aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg>';

/* Up/down arrows, shown instead of the text on mobile (round icon button) */
const SORT_ICON = '<svg class="sort-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + '<path d="M7 21V3M7 3L3 7M7 3l4 4M17 3v18M17 21l-4-4M17 21l4-4"/>'
  + '</svg>';

const CHECK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + '<path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

let sortMenuCount = 0; // unique ids when a page has more than one Sort block

/**
 * "SORT BY ▾" button (round ⇅ icon on mobile) that opens a themed list of options.
 * A custom listbox instead of a native <select>, so the open list can be styled.
 * Mouse: click to open/choose, click outside to close.
 * Keyboard: Enter/Space/Arrows open; Arrows/Home/End move; Enter/Space choose; Escape/Tab close.
 *
 * `options`: [{ value, label, sortAs? }]. `sortAs` is the sort actually run (used by a
 * custom authored option, which shows its own label but sorts like Top Rated).
 * `onChange` receives the chosen option.
 */
function buildSortMenu(options, initialValue, onChange) {
  sortMenuCount += 1;
  const listId = `sort-list-${sortMenuCount}`;
  const sortOf = (option) => option.sortAs || option.value;
  let selected = Math.max(0, options.findIndex((o) => o.value === initialValue));
  let active = selected; // option highlighted while the list is open

  const sort = document.createElement('div');
  sort.className = 'sort-menu';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sort-button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', listId);
  // Desktop shows "SORT BY ⌄"; mobile shows only the round ⇅ icon (CSS decides).
  // The selected option is hidden visually but stays in the button, so screen
  // readers announce e.g. "Sort by Price: Low to High".
  button.innerHTML = `${SORT_ICON}<span class="sort-label">Sort by</span>`
    + `<span class="sort-value"></span>${CHEVRON_ICON}`;
  const valueEl = button.querySelector('.sort-value');

  const list = document.createElement('ul');
  list.className = 'sort-list';
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Sort products');
  list.tabIndex = -1;
  list.hidden = true;

  const items = options.map(({ value, label }) => {
    const li = document.createElement('li');
    li.className = 'sort-option';
    li.id = `${listId}-${value}`;
    li.setAttribute('role', 'option');
    const text = document.createElement('span');
    text.textContent = label; // authored text: never parsed as HTML
    li.innerHTML = CHECK_ICON;
    li.prepend(text);
    list.append(li);
    return li;
  });
  const indexOf = (target) => items.indexOf(target.closest('.sort-option'));

  function updateActive() {
    items.forEach((li, i) => li.classList.toggle('is-active', i === active));
    list.setAttribute('aria-activedescendant', items[active].id);
  }

  function updateSelected() {
    items.forEach((li, i) => li.setAttribute('aria-selected', String(i === selected)));
    valueEl.textContent = ` ${options[selected].label}`; // leading space: "Sort by Price…"
  }

  function isOpen() {
    return !list.hidden;
  }

  function onOutsideClick(e) {
    if (!sort.contains(e.target)) close(); // eslint-disable-line no-use-before-define
  }

  /**
   * The list opens right-aligned under the button. On small screens it can be wider
   * than the space to the button's left, so nudge it back inside the screen.
   */
  const EDGE = 8; // px kept free between the list and the screen edge
  function keepInViewport() {
    list.style.right = '';
    const { left, right } = list.getBoundingClientRect();
    const screenWidth = document.documentElement.clientWidth;
    if (left < EDGE) {
      list.style.right = `${left - EDGE}px`; // negative right = move it rightwards
    } else if (right > screenWidth - EDGE) {
      list.style.right = `${right - (screenWidth - EDGE)}px`;
    }
  }

  let openWidth = 0; // screen width when the list was opened
  function onViewportChange() {
    // Rotating / resizing would leave the list in the wrong place. Only the width
    // matters: phones also fire "resize" when the address bar hides while scrolling.
    if (document.documentElement.clientWidth !== openWidth) close(); // eslint-disable-line no-use-before-define
  }

  function open() {
    if (isOpen()) return;
    active = selected;
    updateActive();
    list.hidden = false;
    openWidth = document.documentElement.clientWidth;
    keepInViewport();
    sort.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    list.focus({ preventScroll: true }); // don't make the page jump on phones
    document.addEventListener('click', onOutsideClick);
    window.addEventListener('resize', onViewportChange);
  }

  function close(returnFocus = false) {
    if (!isOpen()) return;
    list.hidden = true;
    sort.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutsideClick);
    window.removeEventListener('resize', onViewportChange);
    if (returnFocus) button.focus();
  }

  function choose(i) {
    const changed = i !== selected;
    selected = i;
    updateSelected();
    close(true);
    if (changed) onChange(options[i]);
  }

  list.addEventListener('mousemove', (e) => {
    const i = indexOf(e.target);
    if (i >= 0 && i !== active) {
      active = i;
      updateActive();
    }
  });
  list.addEventListener('click', (e) => {
    const i = indexOf(e.target);
    if (i >= 0) choose(i);
  });

  button.addEventListener('click', () => (isOpen() ? close(true) : open()));
  button.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      open();
    }
  });

  list.addEventListener('keydown', (e) => {
    const last = items.length - 1;
    const moves = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      active = moves[e.key];
      updateActive();
      items[active].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      close();
    }
  });

  /** Show the option for a sort that was set elsewhere, without calling onChange. */
  function setValue(value) {
    if (sortOf(options[selected]) === value) return; // already showing it (e.g. custom option)
    const i = options.findIndex((o) => sortOf(o) === value);
    if (i < 0) return;
    selected = i;
    updateSelected();
  }

  updateSelected();
  sort.append(button, list);
  return { element: sort, setValue };
}

/**
 * Forgiving match. Case, spaces, punctuation and filler words ("price", "rate", "cost",
 * "sort", "by") are ignored, so "High to Low", "price: high to low", "rate-high to low"
 * and "price-desc" all give 'price-desc'.
 */
const FILLER = /\b(price|prices|rate|rates|cost|sort|by)\b/g;
const squash = (text) => text.toLowerCase().replace(FILLER, ' ').replace(/[^a-z]/g, '');

/** Direction phrases found anywhere in the text, e.g. "Sort: high to low (₹)" */
const PHRASES = [
  ['hightolow', 'price-desc'],
  ['lowtohigh', 'price-asc'],
  ['toprated', 'relevant'],
];

function matchSort(text) {
  const clean = squash(text);
  if (!clean) return null;
  const match = SORT_OPTIONS.find(
    ({ value, label, aliases = [] }) => [value, label, ...aliases].some((t) => squash(t) === clean),
  );
  if (match) return match.value;
  const phrase = PHRASES.find(([words]) => clean.includes(words));
  return phrase ? phrase[1] : null;
}

const cellText = (cell) => (cell ? cell.textContent.trim().replace(/\s+/g, ' ') : '');

/**
 * The dropdown options authored in the block, in authored order.
 *
 *   | sort         |
 *   | top rated    |  <- row 1 = the default: selected on page load
 *   | high to low  |  <- every other row = one more option
 *   | low to high  |
 *   | Best Sellers |  <- not a known sort: shown as written, sorts like row 1
 *
 * Each option: { value (unique id), label (authored text), sortAs (sort to run) }.
 * Known text runs its own sort; unknown text runs the first row's sort (Top Rated if the
 * first row is unknown too).
 *
 * Older format still works: a single "Default | <sort>" row (or an empty block) gives the
 * built-in options, with that sort first.
 */
function readOptions(block) {
  const rows = [...block.querySelectorAll(':scope > div')]
    .map((row) => [...row.querySelectorAll(':scope > div')]);

  const legacy = rows.find(
    (cells) => cells.length > 1 && cellText(cells[0]).toLowerCase() === 'default',
  );
  let texts = rows.filter((cells) => cells !== legacy)
    .map((cells) => cellText(cells[0]))
    .filter(Boolean);

  if (!texts.length) {
    // Old "Default | <sort>" format / empty block: built-in options, default first
    const preferred = legacy ? cellText(legacy[1]) : '';
    const builtIns = SORT_OPTIONS.map((o) => o.label);
    const first = preferred || SORT_OPTIONS.find((o) => o.value === DEFAULT_SORT).label;
    const firstSort = matchSort(first);
    texts = [first, ...builtIns.filter((label) => !firstSort || matchSort(label) !== firstSort)];
  }

  const defaultSort = matchSort(texts[0]) || DEFAULT_SORT;
  return texts.map((label, i) => ({
    value: `opt-${i}-${squash(label) || 'sort'}`,
    label,
    sortAs: matchSort(label) || defaultSort,
  }));
}

export default function decorate(block) {
  const current = getCurrentSort();
  const options = readOptions(block);
  block.textContent = '';

  // Row 1 is the default: selected and applied when the page loads
  const [first] = options;
  const menu = buildSortMenu(options, first.value, (option) => setSort(option.sortAs));
  block.append(menu.element);

  // Tell blocks that are already listening (e.g. Products) which order to start with
  if (first.sortAs !== current) setSort(first.sortAs);

  // Keep the button in sync if something else changes the sort
  onSortChanged((value) => menu.setValue(value));
}
