import { currentSku, rowSku } from '../../scripts/pdp.js';
 
const SLOT = '[data-slot="try-on-info"]';
const BUTTON_TEXT = /add to (bag|cart)|try it now/i;
const WAIT_MS = 5000;
const SVG_NS = 'http://www.w3.org/2000/svg';
const PIM_SOURCE = '/services/products-sheet.json';
export const TRY_ON_EVENT = 'try-on-info:open';
 
function safeUrl(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('/') && !trimmed.startsWith('//')) || trimmed.startsWith('#')) return trimmed;
  try {
    const parsed = new URL(trimmed, window.location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch (e) {
    return '';
  }
}
 
/** true only when the PIM row for the current PDP sku has tryOn = TRUE */
async function isTryOnEnabled() {
  const sku = currentSku();
  if (!sku) return false;
  try {
    const resp = await fetch(PIM_SOURCE);
    if (!resp.ok) return false;
    const json = await resp.json();
    const rows = json.data || Object.values(json).find((s) => s?.data)?.data || [];
    const row = rows.find((r) => String(rowSku(r)).toLowerCase() === sku.toLowerCase());
    if (!row) return false;
    const key = Object.keys(row).find((k) => k.toLowerCase().replace(/[\s_-]/g, '') === 'tryon');
    return String(row[key] || '').trim().toUpperCase() === 'TRUE';
  } catch (e) {
    return false;
  }
}
 
/** the row holding the Add to Bag / Try It Now buttons, outside this block */
function findButtonRow(block) {
  const buttons = [...document.querySelectorAll('main a, main button')]
    .filter((el) => !block.contains(el) && BUTTON_TEXT.test(el.textContent));
  if (!buttons.length) return null;
  const holdsAll = (el) => buttons.every((b) => el.contains(b));
  let row = buttons[0].parentElement;
  while (row && row.tagName !== 'MAIN' && !holdsAll(row)) row = row.parentElement;
  return row && row.tagName !== 'MAIN' ? row : buttons[0].parentElement;
}
 
/** moves the block into the product details column once that is rendered */
function place(block) {
  const wrapper = block.closest('.try-on-info-wrapper') || block;
  const tryPlace = () => {
    const slot = document.querySelector(SLOT);
    if (slot) {
      slot.replaceChildren(wrapper);
      return true;
    }
    const row = findButtonRow(block);
    if (!row) return false;
    row.after(wrapper);
    return true;
  };
  if (tryPlace()) {
    block.classList.add('try-on-info-placed');
    return;
  }
  const main = document.querySelector('main');
  if (!main) return;
  const observer = new MutationObserver(() => {
    if (tryPlace()) {
      block.classList.add('try-on-info-placed');
      observer.disconnect();
    }
  });
  observer.observe(main, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), WAIT_MS);
}
 
function sparkle() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'try-on-info-sparkle');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M10 2l1.9 5.6L17.5 9.5l-5.6 1.9L10 17l-1.9-5.6L2.5 9.5l5.6-1.9zM18.5 13l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9zM18 2l.7 1.8 1.8.7-1.8.7L18 7l-.7-1.8-1.8-.7 1.8-.7z');
  svg.append(path);
  return svg;
}
 
/** authored link of a Try On Info block: { label, href }. Works before and after decoration */
export function readTryOnLink(block) {
  if (!block) return null;
  if (block.dataset.tryOnLabel) {
    return { label: block.dataset.tryOnLabel, href: block.dataset.tryOnHref || '#' };
  }
  const a = block.querySelector('a[href]');
  const label = a ? a.textContent.trim() : '';
  return label ? { label, href: a.getAttribute('href').trim() } : null;
}
 
/**
* The Try the look button, shared by the PDP box and Product Cards.
* Link "#" (or ending in "#"): a button that fires `try-on-info:open` with { product }.
* Any other link: a normal link to that URL.
*/
export function createTryOnButton({ label, href }, className, product = {}) {
  const isEvent = !href || href.endsWith('#');
  const url = isEvent ? '' : safeUrl(href);
  const button = document.createElement(url ? 'a' : 'button');
  button.className = className;
  if (url) {
    button.href = url;
  } else {
    button.type = 'button';
    button.addEventListener('click', () => {
      button.dispatchEvent(new CustomEvent(TRY_ON_EVENT, { bubbles: true, detail: { product } }));
    });
  }
  if (product.title) button.setAttribute('aria-label', `${label}: ${product.title}`);
  const span = document.createElement('span');
  span.textContent = label;
  button.append(sparkle(), span);
  return button;
}
 
export default async function decorate(block) {
  const link = readTryOnLink(block);
 
  // "Try On Info (button)": only supplies the label + link to Product Cards, not shown itself
  if (block.classList.contains('button')) {
    if (link) {
      block.dataset.tryOnLabel = link.label;
      block.dataset.tryOnHref = link.href;
    }
    block.replaceChildren();
    (block.closest('.try-on-info-wrapper') || block).hidden = true;
    return;
  }
 
  // PDP box: stay hidden until the PIM confirms try-on is enabled for this product
  block.hidden = true;
  if (!(await isTryOnEnabled())) {
    (block.closest('.try-on-info-wrapper') || block).remove();
    return;
  }
  block.hidden = false;
 
  const lines = [...block.querySelectorAll(':scope > div > div')]
    .filter((cell) => !cell.querySelector('a[href]'))
    .flatMap((cell) => {
      const parts = [...cell.querySelectorAll('h1, h2, h3, h4, h5, h6, p')];
      return (parts.length ? parts : [cell]).map((part) => part.textContent.trim());
    })
    .filter(Boolean);
  const [titleText, ...rest] = lines;
 
  const box = document.createElement('div');
  box.className = 'try-on-info-box';
 
  if (titleText) {
    const title = document.createElement('p');
    title.className = 'try-on-info-title';
    // one sentence per line in a narrow box ("Try it on, virtually." / "No guesswork.")
    titleText.split(/(?<=[.!?])\s+/).forEach((sentence, i) => {
      if (i) title.append(' ');
      title.append(Object.assign(document.createElement('span'), { textContent: sentence }));
    });
    box.append(title);
  }
  if (rest.length) {
    const text = document.createElement('p');
    text.className = 'try-on-info-text';
    text.textContent = rest.join(' ');
    box.append(text);
  }
 
  if (link) box.append(createTryOnButton(link, 'try-on-info-button', { sku: currentSku() }));
 
  block.replaceChildren(box);
  place(block);
}