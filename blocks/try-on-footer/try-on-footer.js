import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * try-on-footer — a brand footer rendered on every page.
 *
 * Content-driven like try-on-header: the author-editable parts (logo, headline,
 * subtext, disclaimer, social links, the three link columns, copyright and
 * legal links) come from the /try-on-footer document; the fixed design chrome
 * (subscribe form) is built here. Every field falls back to the DEFAULTS below,
 * so the footer still renders fully when the document — or any individual
 * piece of it — is missing.
 */

// inline brand glyphs (24×24), drawn with currentColor so hover restyles them
const ICONS = {
  // solid circle with the "f" cut out — the current Facebook mark
  facebook:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
  // rounded-square outline, lens ring and flash dot
  instagram:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="17.7" cy="6.3" r="1.2" fill="currentColor" stroke="none"/></svg>',
  // solid musical note
  tiktok:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
  // solid rounded rectangle with the play triangle cut out
  youtube:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>',
};

// keywords used to recognise a social platform from an authored link
const SOCIAL_MATCH = [
  ['facebook', 'facebook'],
  ['instagram', 'instagram'],
  ['tiktok', 'tiktok'],
  ['youtube', 'youtube'],
];

// design defaults — every field is overridable from /try-on-footer
const DEFAULTS = {
  logo: 'Dripcheck',
  heading: ['Join The Drip Sync', 'And Get 25% Off'],
  subtext: 'Sign up for fresh drops, exclusive deals, and a little extra style delivered straight to your inbox.',
  disclaimer: 'By clicking “subscribe”, you agree to receive updates from Dripcheck. You can unsubscribe at any time.',
  social: [
    { name: 'Facebook', href: '#', icon: 'facebook' },
    { name: 'Instagram', href: '#', icon: 'instagram' },
    { name: 'TikTok', href: '#', icon: 'tiktok' },
    { name: 'YouTube', href: '#', icon: 'youtube' },
  ],
  columns: [
    {
      title: 'Shop',
      links: [
        ['New Arrivals', '#'], ['Men Essentials', '#'], ['Women Essentials', '#'],
        ['Trending', '#'], ['Best Sellers', '#'], ['Sale', '#'],
      ],
    },
    {
      title: 'Brand name',
      links: [
        ['Our Story', '#'], ['Our Community', '#'], ['Our Stores', '#'],
        ['Investor Relations', '#'], ['Careers', '#'], ['Sustainability', '#'],
      ],
    },
    {
      title: 'Order support',
      links: [
        ['Contact Us', '#'], ['Returns & Exchanges', '#'], ['Track Your Order', '#'],
        ['Shipping & Delivery', '#'], ['Size Guide', '#'], ['FAQs', '#'], ['Terms', '#'],
      ],
    },
  ],
  copyright: '© 2026 Dripcheck. All rights reserved',
  // order matches the design: Terms Of Service, then Privacy Policy
  legal: [['Terms Of Service', '#'], ['Privacy Policy', '#']],
  // fixed chrome (not authored today — ask to expose these if needed)
  emailPlaceholder: 'samplename@mail.com',
  subscribeLabel: 'Subscribe',
};

/** Escapes text for safe interpolation into markup strings. */
function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** Returns [label, href] pairs for every anchor in a list. */
function listLinks(ul) {
  return [...ul.querySelectorAll('a')].map((a) => [a.textContent.trim(), a.getAttribute('href') || '#']);
}

/**
 * Reads the author-editable fields out of the /try-on-footer fragment.
 * Classification is by element type (not position), so authors can lay the
 * document out naturally. Returns only the fields it finds; the rest default.
 * @param {Element} root The loaded fragment
 * @returns {object} A partial of the content model
 */
function parseFragment(root) {
  const out = {};
  const columns = [];
  const paragraphs = [];
  const looseLists = [];
  let headline;

  // first picture/img anywhere is the logo
  const picture = root.querySelector('picture');
  const logoImg = picture || root.querySelector('img');
  if (logoImg) out.logoImg = logoImg;

  // ordered content nodes (skip the <p> that only wraps the logo media)
  const nodes = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,ul,picture')]
    .filter((el) => !(el.tagName === 'P' && el.querySelector('picture, img')));

  for (let i = 0; i < nodes.length; i += 1) {
    const el = nodes[i];
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const next = nodes[i + 1];
      if (next && next.tagName === 'UL') {
        columns.push({ title: el.textContent.trim(), links: listLinks(next) });
        i += 1; // consume the paired list
      } else if (!headline) {
        headline = el.textContent.trim();
      }
    } else if (tag === 'ul') {
      looseLists.push(el);
    } else if (tag === 'p') {
      const text = el.textContent.trim();
      if (!text) continue; // eslint-disable-line no-continue
      // a short text line before any heading/column is the logo wordmark
      if (!out.logoImg && !out.logo && !headline && !columns.length && text.split(/\s+/).length <= 3) {
        out.logo = text;
      } else {
        paragraphs.push(el);
      }
    }
  }

  // headingless lists are either social links or the legal row
  const social = [];
  let legal;
  looseLists.forEach((ul) => {
    const anchors = [...ul.querySelectorAll('a')];
    const matched = anchors.map((a) => {
      const hay = `${a.textContent} ${a.getAttribute('href') || ''}`.toLowerCase();
      const hit = SOCIAL_MATCH.find(([key]) => hay.includes(key));
      return hit ? { name: a.textContent.trim() || hit[1], href: a.getAttribute('href') || '#', icon: hit[1] } : null;
    });
    if (matched.length && matched.every(Boolean)) social.push(...matched);
    else if (!legal) legal = listLinks(ul);
  });
  if (social.length) out.social = social;
  if (legal) out.legal = legal;

  // paragraphs: the © line is the copyright; the rest are subtext/disclaimer
  const copy = paragraphs.find((p) => /©|copyright|all rights reserved/i.test(p.textContent));
  if (copy) out.copyright = copy.textContent.trim();
  const rest = paragraphs.filter((p) => p !== copy);
  if (rest[0]) out.subtext = rest[0].textContent.trim();
  if (rest[1]) out.disclaimer = rest[1].textContent.trim();

  if (headline) out.heading = headline;
  if (columns.length) out.columns = columns;
  return out;
}

/** Builds one link column. */
function columnMarkup({ title, links }) {
  const items = links.map(([label, href]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join('');
  return `<div class="footer-col"><h2>${esc(title)}</h2><ul>${items}</ul></div>`;
}

/** Builds the social icon row. */
function socialMarkup(social) {
  return social
    .map(({ name, href, icon }) => `<li><a href="${esc(href)}" aria-label="${esc(name)}">${ICONS[icon] || esc(name)}</a></li>`)
    .join('');
}

/** Builds the legal link list (rendered in authored order). */
function legalMarkup(legal) {
  return legal
    .map(([label, href]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`)
    .join('');
}

/**
 * Renders the try-on footer.
 * @param {Element} block The try-on-footer block element
 */
export default async function decorate(block) {
  const data = { ...DEFAULTS };

  // page-level override, else the shared /try-on-footer document
  const meta = getMetadata('try-on-footer');
  const path = meta ? new URL(meta, window.location).pathname : '/try-on-footer';
  try {
    const fragment = await loadFragment(path);
    if (fragment) Object.assign(data, parseFragment(fragment));
  } catch {
    // fragment missing or unreadable — defaults carry the full design
  }

  const headingHTML = Array.isArray(data.heading)
    ? data.heading.map(esc).join('<br>')
    : esc(data.heading);
  const legal = Array.isArray(data.legal) && data.legal.length ? data.legal : DEFAULTS.legal;

  block.innerHTML = `
    <div class="footer-inner">
      <div class="footer-top">
        <div class="footer-intro">
          <p class="footer-logo">${esc(data.logo)}</p>
          <h2 class="footer-heading">${headingHTML}</h2>
          <p class="footer-subtext">${esc(data.subtext)}</p>
          <form class="footer-subscribe">
            <label class="footer-sr-only" for="footer-email">Email address</label>
            <input id="footer-email" type="email" name="email" autocomplete="email"
              required placeholder="${esc(data.emailPlaceholder)}" />
            <button type="submit">${esc(data.subscribeLabel)}</button>
          </form>
          <p class="footer-form-status" role="status" aria-live="polite"></p>
          <p class="footer-disclaimer">${esc(data.disclaimer)}</p>
          <ul class="footer-social">${socialMarkup(data.social)}</ul>
        </div>
        <nav class="footer-links" aria-label="Footer">
          ${data.columns.map(columnMarkup).join('')}
        </nav>
      </div>
      <div class="footer-bottom">
        <nav aria-label="Legal">
          <ul class="footer-legal">${legalMarkup(legal)}</ul>
        </nav>
        <p class="footer-copyright">${esc(data.copyright)}</p>
      </div>
    </div>`;

  // authored logo image (keeps the EDS optimised <picture>)
  if (data.logoImg) {
    const logoEl = block.querySelector('.footer-logo');
    logoEl.textContent = '';
    logoEl.classList.add('has-image');
    logoEl.append(data.logoImg);
  }

  // no newsletter backend wired up yet — the browser validates the email (the
  // field is `required` and type=email), and we acknowledge a valid submission
  // through the aria-live status region instead of navigating.
  const form = block.querySelector('.footer-subscribe');
  const status = block.querySelector('.footer-form-status');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (status) status.textContent = 'Thanks for subscribing!';
      form.reset();
    });
  }
}