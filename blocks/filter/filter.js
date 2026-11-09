/**
 * Dynamic Filter Block (`blocks/filter/filter.js`)
 * ---------------------------------------------------------------------
 * A content-driven filtering system that dynamically builds UI elements
 * (checkboxes, color swatches, size pills, and dual-thumb range sliders)
 * based directly on table configurations authored in Edge Delivery Services (DA).
 *
 * Broadcasts global `filters-changed` custom events on `document` whenever 
 * the user updates selections.
 */

/* ================================================================== */
/* 1. FILTERING LOGIC (Pure functional utilities)                      */
/* ================================================================== */

/**
 * Normalizes input strings by converting to lowercase and stripping whitespace.
 * @param {*} value - Value to normalize.
 * @returns {string} Cleaned lowercase string.
 */
export const normalize = (value) => String(value ?? '').trim().toLowerCase();

/**
 * Converts arrays or comma-delimited string values into a sanitized array of strings.
 * @param {Array|string} value - Raw string or list.
 * @returns {Array<string>} Cleaned string array.
 */
export function toList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value ?? '').split(',').map((v) => v.trim()).filter(Boolean);
}

/**
 * Evaluates whether a product attribute matches any value within a selected filter Set.
 * @param {Set<string>} selectedSet - Set containing normalized active filter values.
 * @param {Array|string} productValue - Target product property value to inspect.
 * @returns {boolean} True if product value intersects with the selected filter set.
 */
function matchesGroup(selectedSet, productValue) {
  if (!selectedSet || selectedSet.size === 0) return true;
  return toList(productValue).some((v) => selectedSet.has(normalize(v)));
}

/**
 * Evaluates an array of products against all active filter criteria.
 * @param {Array<Object>} products - List of product items.
 * @param {Object} filters - Key-value pair object holding current active filter selections.
 * @returns {Array<Object>} Filtered product list matching all current conditions.
 */
export function filterProducts(products, filters = {}) {
  return products.filter((product) => {
    return Object.entries(filters).every(([key, filterVal]) => {
      if (!filterVal) return true;

      // Handle dual-range / numeric bounds filters (e.g., price slider min/max)
      if (typeof filterVal === 'object' && ('min' in filterVal || 'max' in filterVal)) {
        const productVal = Number(product.effectivePrice ?? product[key] ?? product.price);
        const min = filterVal.min ?? -Infinity;
        const max = filterVal.max ?? Infinity;
        return productVal >= min && productVal <= max;
      }

      // Handle standard option lists/sets (Categories, Sizes, Colors, etc.)
      const list = Array.isArray(filterVal) ? filterVal : [];
      if (list.length === 0) return true;
      const selectedSet = new Set(list.map(normalize));
      
      return matchesGroup(selectedSet, product[key]);
    });
  });
}

/**
 * Calculates total count of user-selected active filters (used for badge display).
 * @param {Object} filters - Active filter selections object.
 * @param {Object} boundsConfig - Min/Max limits dictionary for numerical sliders.
 * @returns {number} Count of total active filter conditions.
 */
export function countActiveFilters(filters, boundsConfig = {}) {
  let count = 0;
  Object.entries(filters).forEach(([key, val]) => {
    if (Array.isArray(val)) {
      count += val.length;
    } else if (val && typeof val === 'object' && boundsConfig[key]) {
      const bounds = boundsConfig[key];
      // Increment count only if current slider bounds differ from default limits
      if (val.min !== bounds.min || val.max !== bounds.max) count += 1;
    }
  });
  return count;
}

/* ================================================================== */
/* 2. SHARED STATE MANAGEMENT & EVENT PUBLISHING                      */
/* ================================================================== */

/** Custom event name constant for filter state updates */
export const EVENTS = {
  FILTERS_CHANGED: 'filters-changed',
};

/** Private in-memory store for active filters */
let currentFilters = {};

/**
 * Retrieves a deep clone of current active filter state.
 * @returns {Object} Deep copy of current active filters.
 */
export function getCurrentFilters() {
  return structuredClone(currentFilters);
}

/**
 * Updates private filter state memory with new user selection data.
 * @param {Object} nextFilters - Updated filter selection values.
 * @returns {Object} Updated filter state copy.
 */
export function updateFilterState(nextFilters) {
  currentFilters = structuredClone(nextFilters);
  return getCurrentFilters();
}

/**
 * Broadcasts global `filters-changed` custom event to document context.
 * @param {Object} [filters=currentFilters] - Filter payload dispatched to subscribers.
 */
export function publishFilterChange(filters = currentFilters) {
  document.dispatchEvent(
    new CustomEvent(EVENTS.FILTERS_CHANGED, { detail: structuredClone(filters) }),
  );
}

/**
 * Attaches event listener subscription for filter state changes.
 * @param {Function} handler - Subscriber callback function.
 * @returns {Function} Unsubscribe cleanup listener function.
 */
export function onFiltersChanged(handler) {
  const listener = (event) => handler(event.detail);
  document.addEventListener(EVENTS.FILTERS_CHANGED, listener);
  return () => document.removeEventListener(EVENTS.FILTERS_CHANGED, listener);
}

/* ================================================================== */
/* 3. PRODUCT DATA FETCHING & NORMALIZATION                           */
/* ================================================================== */

export const DEFAULT_SOURCE = '/products.json';
const cache = new Map();

/** Evaluates string/boolean values to true boolean primitive */
const toBoolean = (value) => (typeof value === 'boolean'
  ? value
  : ['true', 'yes', 'y', '1', 'x'].includes(String(value ?? '').trim().toLowerCase()));

/** Parses float number from string stripping currency or non-numeric tokens */
const toNumber = (value) => parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''));

/** Normalizes size labels (e.g., converts '2XL' to 'XXL') */
const toSizeLabel = (size) => String(size).trim().toUpperCase()
  .replace(/^(\d)XL$/, (_, count) => `${'X'.repeat(Number(count))}L`);

/**
 * Converts raw backend/sheet row structures into standardized product records.
 * @param {Object} raw - Raw unformatted sheet row dictionary.
 * @param {number} [index=0] - Fallback product identifier index.
 * @returns {Object} Normalized domain object representing a product item.
 */
export function normalizeProduct(raw, index = 0) {
  const cols = {};
  Object.entries(raw).forEach(([key, value]) => {
    cols[key.trim().toLowerCase()] = typeof value === 'string' ? value.trim() : value;
  });

  // Pick first available match across key aliases
  const pick = (...names) => names
    .map((name) => cols[name])
    .find((value) => value !== undefined && value !== null && String(value).trim() !== '');

  const price = toNumber(pick('price'));
  const sale = toNumber(pick('saleprice', 'sale-price', 'sale price'));
  const onSale = Number.isFinite(sale) && sale > 0 && (!Number.isFinite(price) || sale < price);
  const title = String(pick('title', 'name') ?? '').trim();
  const ratings = toNumber(pick('ratings', 'rating'));
  const reviews = toNumber(pick('reviews', 'reviewcount'));
  const images = toList(pick('image', 'images'));

  return {
    ...raw,
    id: String(pick('id', 'skuid') ?? index),
    title,
    name: title,
    image: images[0] ?? '',
    images,
    url: String(pick('url') ?? '').trim(),
    category: String(pick('category', 'categories') ?? '').trim(),
    size: toList(pick('size', 'sizes')).map(toSizeLabel),
    color: toList(pick('color', 'colors', 'colour', 'colours')),
    price,
    salePrice: onSale ? sale : null,
    effectivePrice: onSale ? sale : price,
    ratings: Number.isFinite(ratings) ? ratings : 0,
    reviews: Number.isFinite(reviews) ? reviews : 0,
    tryOn: toBoolean(pick('tryon', 'tryonenabled', 'try-on', 'try on')),
  };
}

/**
 * Fetches and caches product dataset from the specified source endpoint path.
 * @param {string} [source=DEFAULT_SOURCE] - Source JSON URL endpoint.
 * @returns {Promise<Array<Object>>} Promise resolving to array of normalized product items.
 */
export function loadProducts(source = DEFAULT_SOURCE) {
  if (!cache.has(source)) {
    const request = fetch(source)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${source} (${response.status})`);
        return response.json();
      })
      .then((json) => (Array.isArray(json) ? json : (json.data ?? [])).map(normalizeProduct))
      .catch((error) => {
        cache.delete(source);
        throw error;
      });
    cache.set(source, request);
  }
  return cache.get(source);
}

/* ================================================================== */
/* 4. UI CONSTANTS & AUTHORING PARSER                                 */
/* ================================================================== */

/** Fallback hex codes mapping color names to swatches */
const SWATCHES = {
  black: '#111111',
  white: '#ffffff',
  blue: '#0b6bd3',
  green: '#4caf50',
  red: '#d6455d',
  yellow: '#e6d83a',
  orange: '#f58a1f',
};

const FILTER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h16l-6.2 7.6V19l-3.6 1.8v-8.2z"/></svg>';
const CHEVRON_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 15l6-6 6 6"/></svg>';

let groupCount = 0;
const PRICE_STEP = 5;
const PUBLISH_DELAY_MS = 120; // Debounce threshold for range slider events

/**
 * DOM Element Builder Helper.
 * @param {string} tag - HTML tag name.
 * @param {Object} [props={}] - Attribute properties and custom keys (`class`, `text`).
 * @param {...HTMLElement|string} children - Child nodes to append.
 * @returns {HTMLElement} Created DOM element.
 */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : value);
  });
  node.append(...children);
  return node;
}

/**
 * Creates a debounced version of a target function execution.
 * @param {Function} fn - Function execution target.
 * @param {number} delay - Debounce timer threshold in milliseconds.
 * @returns {Function} Debounced function wrapper.
 */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Parses authored table cell content into a clean option string array.
 * @param {HTMLElement} cell - Table cell container DOM node.
 * @returns {Array<string>} Parsed option strings.
 */
function parseCellList(cell) {
  const items = [...cell.querySelectorAll('li')];
  if (items.length) return items.map((li) => li.textContent.trim()).filter(Boolean);
  const paragraphs = [...cell.querySelectorAll('p')];
  const text = paragraphs.length ? paragraphs.map((p) => p.textContent).join(',') : cell.textContent;
  return toList(text);
}

/**
 * Dynamically parses authored block table rows into structured filter configurations.
 * @param {HTMLElement} block - Authoring block table container.
 * @returns {{groups: Array<Object>, source: string}} Configured groups and JSON source URL.
 */
export function readConfig(block) {
  const groups = [];
  let source = DEFAULT_SOURCE;

  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    if (!keyCell || !valueCell) return;

    const rawTitle = keyCell.textContent.trim();
    const normKey = normalize(rawTitle);

    // Reserved configuration row declaring JSON data source
    if (normKey === 'source') {
      source = valueCell.textContent.trim() || DEFAULT_SOURCE;
      return;
    }

    const textValue = valueCell.textContent.trim();
    const rangeNumbers = textValue.match(/^\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/);

    // Range dynamic detection (e.g. authored as "0 - 200")
    if (rangeNumbers) {
      const min = Number(rangeNumbers[1]);
      const max = Number(rangeNumbers[2]);
      groups.push({
        type: 'range',
        key: normKey.includes('price') ? 'price' : normKey,
        title: rawTitle,
        bounds: { min: Math.min(min, max), max: Math.max(min, max) },
      });
    } else {
      // List/Option dynamic detection (e.g. standard check, size pill, or color swatch)
      let variant = 'check';
      if (normKey.includes('size')) variant = 'pill';
      if (normKey.includes('color') || normKey.includes('colour')) variant = 'swatch';

      let key = normKey;
      if (normKey.includes('cat')) key = 'category';
      else if (normKey.includes('size')) key = 'size';
      else if (normKey.includes('color') || normKey.includes('colour')) key = 'color';

      groups.push({
        type: 'options',
        key,
        title: rawTitle,
        variant,
        options: parseCellList(valueCell),
      });
    }
  });

  return { groups, source };
}

/* ================================================================== */
/* 5. UI COMPONENT BUILDERS & RENDERERS                               */
/* ================================================================== */

/**
 * Wraps individual filter controls inside an expandable/collapsible accordian section card.
 * @param {Object} sectionConfig - Configuration payload (`key`, `title`, `body`).
 * @returns {HTMLDivElement} Section group container DOM node.
 */
function buildSection({ key, title, body }) {
  groupCount += 1;
  const bodyId = `filter-group-body-${groupCount}`;
  const titleId = `filter-group-title-${groupCount}`;

  const button = el(
    'button',
    {
      type: 'button', class: 'filter-title', id: titleId, 'aria-expanded': 'true', 'aria-controls': bodyId,
    },
    el('span', { class: 'filter-title-text', text: title }),
  );
  button.insertAdjacentHTML('beforeend', CHEVRON_ICON);

  const content = el(
    'div',
    {
      class: 'filter-group-body', id: bodyId, role: 'group', 'aria-labelledby': titleId,
    },
    body,
  );

  const section = el(
    'div',
    { class: `filter-group filter-group-${key}` },
    el('h3', { class: 'filter-heading' }, button),
    content,
  );

  // Accordion open/close click event toggle logic
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    content.hidden = open;
    section.classList.toggle('is-collapsed', open);
  });
  return section;
}

/**
 * Builds selectable options list UI (checkbox list, color swatch grid, or size button pills).
 * @param {Object} optionsConfig - Target properties (`key`, `options`, `variant`).
 * @returns {HTMLDivElement} Options container DOM node.
 */
function buildOptions({ key, options, variant }) {
  const optionNodes = options.map((option) => {
    const input = el('input', { type: 'checkbox', name: key, value: option });
    
    // Render button-style pill input (Size filters)
    if (variant === 'pill') {
      return el('label', { class: 'filter-pill' }, input, el('span', { class: 'filter-pill-text', text: option }));
    }
    
    // Render standard options (Checkbox or Swatch)
    const label = el('label', { class: 'filter-option' }, input);
    if (variant === 'swatch') {
      const dot = el('span', { class: 'filter-swatch', 'aria-hidden': 'true' });
      dot.style.setProperty('--swatch', SWATCHES[normalize(option)] || normalize(option));
      label.append(dot);
    }
    label.append(el('span', { class: 'filter-label', text: option }));
    
    // Append product count badge only for standard checkbox variants
    if (variant === 'check') {
      label.append(el('span', { class: 'filter-count' }));
    }
    return label;
  });

  return el('div', { class: `filter-options filter-options-${variant}` }, ...optionNodes);
}

/**
 * Builds dynamic dual-handle price/range slider UI component.
 * @param {string} key - Field identifier key name (e.g., 'price').
 * @param {{min: number, max: number}} bounds - Min and max limits object.
 * @returns {HTMLDivElement} Range slider control container node.
 */
function buildPriceSlider(key, bounds) {
  const range = (name, value, label) => el('input', {
    type: 'range', name: `${key}-${name}`, min: bounds.min, max: bounds.max, step: PRICE_STEP, value, 'aria-label': label,
  });

  return el(
    'div',
    { class: 'price-control' },
    el(
      'div',
      { class: 'price-slider' },
      el('div', { class: 'price-track' }),
      range('min', bounds.min, `Minimum ${key}`),
      range('max', bounds.max, `Maximum ${key}`),
    ),
    el(
      'div',
      { class: 'price-values', 'aria-hidden': 'true' },
      el('span', { class: `price-value ${key}-value-min` }),
      el('span', { class: `price-value ${key}-value-max` }),
    ),
  );
}

/**
 * Extracts and parses currently selected form controls into a structured selection object.
 * @param {HTMLFormElement} form - Filter form DOM container.
 * @param {Array<Object>} groupsConfig - Authored filter group configurations.
 * @returns {Object} Active selections dictionary object.
 */
export function getSelectedFilters(form, groupsConfig) {
  const selected = {};

  groupsConfig.forEach((group) => {
    if (group.type === 'options') {
      selected[group.key] = [...form.querySelectorAll(`input[name="${group.key}"]:checked`)].map((i) => i.value);
    } else if (group.type === 'range') {
      const minVal = Number(form.elements[`${group.key}-min`]?.value ?? group.bounds.min);
      const maxVal = Number(form.elements[`${group.key}-max`]?.value ?? group.bounds.max);
      selected[group.key] = {
        min: Math.min(minVal, maxVal),
        max: Math.max(minVal, maxVal),
      };
    }
  });

  return selected;
}

/**
 * Updates dynamic CSS custom properties and DOM elements to reflect current filter state.
 * @param {HTMLElement} block - Filter block container element.
 * @param {Object} filters - Active filter selections object.
 * @param {Array<Object>} groupsConfig - Authored configuration list.
 */
function renderFilterState(block, filters, groupsConfig) {
  const boundsMap = {};

  groupsConfig.forEach((group) => {
    if (group.type === 'range') {
      boundsMap[group.key] = group.bounds;
      const rangeVal = filters[group.key];
      if (!rangeVal) return;

      const span = group.bounds.max - group.bounds.min || 1;
      const groupEl = block.querySelector(`.filter-group-${group.key}`);
      if (!groupEl) return;

      // Update CSS variables positioning active black track line and values
      groupEl.style.setProperty('--lo', (rangeVal.min - group.bounds.min) / span);
      groupEl.style.setProperty('--hi', (rangeVal.max - group.bounds.min) / span);

      // Adjust slider z-index when thumbs collide at the upper bound limit (resolves drag-stuck issues)
      const minInput = block.querySelector(`input[name="${group.key}-min"]`);
      const maxInput = block.querySelector(`input[name="${group.key}-max"]`);
      if (minInput && maxInput) {
        if (rangeVal.min === rangeVal.max && rangeVal.max === group.bounds.max) {
          minInput.classList.add('is-active-min');
        } else {
          minInput.classList.remove('is-active-min');
        }
      }

      // Update numeric value labels directly beneath slider handles
      const minText = block.querySelector(`.${group.key}-value-min`);
      const maxText = block.querySelector(`.${group.key}-value-max`);
      if (minText) minText.textContent = group.key === 'price' ? `$${rangeVal.min}` : rangeVal.min;
      if (maxText) maxText.textContent = group.key === 'price' ? `$${rangeVal.max}` : rangeVal.max;
    }
  });

  // Update mobile toggle count badge and accessibility labels
  const active = countActiveFilters(filters, boundsMap);
  const badge = block.querySelector('.filter-badge');
  if (badge) {
    badge.textContent = active ? String(active) : '';
    badge.hidden = active === 0;
  }
  const toggle = block.querySelector('.filter-toggle');
  if (toggle) {
    toggle.setAttribute('aria-label', active ? `Filters, ${active} selected` : 'Filters');
  }
}

/**
 * Calculates and appends item availability counts next to standard checkbox options.
 * @param {HTMLElement} block - Filter container element.
 * @param {Array<Object>} products - Raw product items dataset.
 * @param {Array<Object>} groupsConfig - Authored filter group configurations.
 */
function applyCounts(block, products, groupsConfig) {
  groupsConfig.forEach((group) => {
    // Only calculate item counts for standard check option groups
    if (group.type !== 'options' || group.variant !== 'check') return;

    block.querySelectorAll(`.filter-group-${group.key} .filter-option`).forEach((label) => {
      const input = label.querySelector('input');
      if (!input) return;
      const val = normalize(input.value);
      
      const count = products.filter((p) => {
        const itemVal = p[group.key];
        return toList(itemVal).some((v) => normalize(v) === val);
      }).length;

      const countSpan = label.querySelector('.filter-count');
      if (countSpan) countSpan.textContent = `(${count})`;
    });
  });
}

/* ================================================================== */
/* 6. MAIN BLOCK DECORATOR (Entry point execution)                    */
/* ================================================================== */

/**
 * Primary block decorator method executed by AEM runtime script loader.
 * @param {HTMLElement} block - Target authored container element.
 */
export default async function decorate(block) {
  const config = readConfig(block);
  block.textContent = ''; // Clear default authored HTML table content

  // Build section DOM cards for each configured filter group
  const sectionElements = config.groups.map((group) => {
    let body;
    if (group.type === 'options') {
      body = buildOptions({ key: group.key, options: group.options, variant: group.variant });
    } else if (group.type === 'range') {
      body = buildPriceSlider(group.key, group.bounds);
    }
    return buildSection({ key: group.key, title: group.title, body });
  });

  // Construct main form container
  const form = el('form', { class: 'filter-form', novalidate: true, autocomplete: 'off' }, ...sectionElements);
  form.addEventListener('submit', (event) => event.preventDefault());

  // Construct mobile expandable panel wrapper and trigger toggle button
  const panel = el('div', { class: 'filter-panel', id: 'filter-panel' }, form);
  const toggle = el(
    'button',
    {
      type: 'button',
      class: 'filter-toggle',
      'aria-label': 'Filters',
      'aria-expanded': 'false',
      'aria-controls': 'filter-panel',
    },
    el('span', { class: 'filter-badge', hidden: true }),
  );
  toggle.insertAdjacentHTML('afterbegin', FILTER_ICON);
  toggle.addEventListener('click', () => {
    const open = block.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  block.append(toggle, panel);

  // Define dispatch handlers for state synchronization
  const apply = () => {
    const filters = getSelectedFilters(form, config.groups);
    updateFilterState(filters);
    publishFilterChange(filters);
  };
  const applyDebounced = debounce(apply, PUBLISH_DELAY_MS);
  const refreshUI = () => renderFilterState(block, getSelectedFilters(form, config.groups), config.groups);

  // Attach change event listener for checkboxes (instant update)
  form.addEventListener('change', (event) => {
    if (event.target.type !== 'checkbox') return;
    refreshUI();
    apply();
  });

  // Attach input event listener for range sliders (debounced update + boundary collision checks)
  form.addEventListener('input', (event) => {
    if (event.target.type !== 'range') return;
    const name = event.target.name;
    const key = name.replace(/-(min|max)$/, '');
    const minInput = form.elements[`${key}-min`];
    const maxInput = form.elements[`${key}-max`];

    // Boundary cross-prevention enforcement
    if (minInput && maxInput) {
      if (event.target === minInput && Number(minInput.value) > Number(maxInput.value)) {
        minInput.value = maxInput.value;
      }
      if (event.target === maxInput && Number(maxInput.value) < Number(minInput.value)) {
        maxInput.value = minInput.value;
      }
    }
    refreshUI();
    applyDebounced();
  });

  // Initial state synchronization
  refreshUI();
  apply();

  // Async load product counts in background without blocking initial rendering
  loadProducts(config.source)
    .then((products) => applyCounts(block, products, config.groups))
    .catch((error) => console.warn('[filter] counts unavailable:', error.message));
}