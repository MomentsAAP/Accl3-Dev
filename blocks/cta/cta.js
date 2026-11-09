/*
 * CTA block
 * An outlined button with a chevron. "CTA (Pill)" = black rounded button.
 *
 * Authoring:
 *   | CTA                    |
 *   | [View More](/shop)     |
 *
 * When a Text block comes right before this block, the button sits top-right
 * next to the heading on desktop, and below the cards (full width) on mobile.
 * Screen readers hear "View More: <heading>" so every button is unique.
 */

function safeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (trimmed.startsWith('#')) return trimmed;
  try {
    const parsed = new URL(trimmed, window.location.href);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? parsed.href : '';
  } catch (e) {
    return '';
  }
}

const DESKTOP = window.matchMedia('(width >= 900px)');

/** finds the Text block wrapper authored right before the CTA */
function findTextWrapper(wrapper) {
  const prev = wrapper.previousElementSibling;
  if (prev) return prev.classList.contains('text-wrapper') ? prev : null;
  const prevSection = wrapper.closest('.section')?.previousElementSibling;
  const last = prevSection && prevSection.lastElementChild;
  return last && last.classList.contains('text-wrapper') ? last : null;
}

function pairWithText(block) {
  const wrapper = block.closest('.cta-wrapper');
  const textWrapper = wrapper && findTextWrapper(wrapper);
  if (!textWrapper) return;

  // "View More: Finish the Fit", so each button is unique for screen readers
  const headingEl = textWrapper.querySelector('h1, h2, h3, h4, h5, h6') || textWrapper.querySelector('p');
  const heading = headingEl?.textContent.trim();
  if (heading) {
    block.querySelectorAll('.cta-link').forEach((a) => {
      a.setAttribute('aria-label', `${a.firstChild.textContent.trim()}: ${heading}`);
    });
  }

  const section = wrapper.closest('.section');
  const row = document.createElement('div');
  row.className = 'cta-row';
  textWrapper.before(row);
  row.append(textWrapper);
  // desktop: next to the heading; mobile: end of the section, below the cards
  const place = () => {
    if (DESKTOP.matches) row.append(wrapper);
    else row.parentElement.append(wrapper);
    block.classList.toggle('cta-stacked', !DESKTOP.matches);
  };
  place();
  DESKTOP.addEventListener('change', place);
  if (section && !section.children.length) section.remove();
}

export default function decorate(block) {
  const list = document.createElement('div');
  list.className = 'cta-links';

  [...block.querySelectorAll('a[href]')].forEach((source) => {
    const href = safeUrl(source.getAttribute('href'));
    const label = source.textContent.trim();
    if (!href || !label) return;
    const a = document.createElement('a');
    a.className = 'cta-link';
    a.href = href;
    a.textContent = label;
    if (/^https?:/.test(href) && new URL(href).origin !== window.location.origin) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      const hint = document.createElement('span');
      hint.className = 'cta-sr-only';
      hint.textContent = ' (opens in new tab)';
      a.append(hint);
    }
    list.append(a);
  });

  if (!list.children.length) {
    block.closest('.cta-wrapper')?.remove();
    return;
  }
  block.replaceChildren(list);
  if (!block.classList.contains('pill')) pairWithText(block);
}