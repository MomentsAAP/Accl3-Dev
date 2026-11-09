import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// media query match that indicates desktop width
const isDesktop = window.matchMedia('(min-width: 900px)');

/**
 * Reflects the open/closed state of the mobile menu. aria-expanded lives only on
 * the hamburger button (a <nav> landmark does not support aria-expanded, so
 * putting it there trips accessibility audits); the nav carries a plain
 * `data-open` attribute used purely as a styling hook.
 * @param {Element} nav The nav element
 * @param {Element} button The hamburger button
 * @param {boolean} expanded Whether the menu is expanded
 */
function setExpanded(nav, button, expanded) {
  button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  button.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');
  nav.toggleAttribute('data-open', expanded);
  // lock the page behind the overlay menu on mobile only
  document.body.style.overflowY = (expanded && !isDesktop.matches) ? 'hidden' : '';
}

/**
 * Toggles the mobile menu open/closed. When opening on mobile, focus moves into
 * the revealed menu so keyboard and screen-reader users land on the nav links.
 * @param {Element} nav The nav element
 * @param {Element} button The hamburger button
 * @param {boolean|null} force Optional forced state
 */
function toggleMenu(nav, button, force = null) {
  const expanded = force !== null ? force : button.getAttribute('aria-expanded') !== 'true';
  setExpanded(nav, button, expanded);
  if (expanded && !isDesktop.matches) {
    const first = nav.querySelector('.nav-sections a[href], .nav-sections [role="button"]');
    if (first) first.focus();
  }
}

/**
 * Marks the centre-nav link whose pathname matches the current page as active.
 * Only real navigational links qualify: empty, "#", "javascript:" and root ("/")
 * hrefs are ignored, because they resolve to the current page and would
 * otherwise light up every placeholder link on load. Nothing is highlighted
 * until the visitor is actually on (or clicks) a section.
 * @param {Element} navSections The nav-sections landmark
 */
function markActiveLink(navSections) {
  if (!navSections) return;
  const current = window.location.pathname.replace(/\/$/, '') || '/';
  navSections.querySelectorAll('a[href]').forEach((a) => {
    const raw = (a.getAttribute('href') || '').trim();
    if (!raw || raw.startsWith('#') || raw.toLowerCase().startsWith('javascript:')) return;
    let linkPath;
    try {
      linkPath = new URL(a.href).pathname.replace(/\/$/, '') || '/';
    } catch {
      return;
    }
    if (linkPath === '/') return; // the home page is not a "section"
    if (current === linkPath || current.startsWith(`${linkPath}/`)) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
}

// aria-labels for icon-only tool links, keyed by icon name
const TOOL_LABELS = {
  search: 'search',
  'try-on-bag': 'bag',
  bag: 'bag',
  'try-on-heart': 'wishlist',
  heart: 'wishlist',
  'try-on-user': 'account',
  user: 'account',
};

/**
 * Adds accessible labels to icon-only tool links and tags each list item with a
 * `nav-tools-<label>` class so CSS can show/hide individual tools per breakpoint.
 * @param {Element} navTools The nav-tools section
 */
function labelToolLinks(navTools) {
  if (!navTools) return;
  navTools.querySelectorAll('a').forEach((a) => {
    if (a.textContent.trim()) return; // has visible text already
    const icon = a.querySelector('span.icon');
    const name = icon
      ? [...icon.classList].find((c) => c.startsWith('icon-'))?.substring(5)
      : undefined;
    const label = (name && TOOL_LABELS[name]) || 'link';
    a.setAttribute('aria-label', label);
    if (label !== 'link') a.closest('li')?.classList.add(`nav-tools-${label}`);
  });
}

/**
 * Lets an author swap a tool icon for a custom image — e.g. a signed-in user's
 * avatar. When a tool item carries a real image alongside (or instead of) an
 * icon, the avatar wins: the icon is dropped, the stray <p> wrappers da.live
 * emits are collapsed, and the avatar ends up as a single, round, clickable
 * control. Works whether or not the author linked it — an unlinked avatar is
 * wrapped in a link to the account page. Icon-only items are left untouched.
 * @param {Element} navTools The nav-tools section
 */
function foldAvatarTools(navTools) {
  if (!navTools) return;
  navTools.querySelectorAll('li').forEach((li) => {
    const img = [...li.querySelectorAll('img')].find((im) => !im.closest('span.icon'));
    if (!img) return;
    const media = img.closest('picture') || img;

    // keep the chevron; drop any other icon (the generic account glyph)
    const icons = [...li.querySelectorAll('span.icon')];
    const chevron = icons.find((i) => i.classList.contains('icon-chevron-down'));
    icons.forEach((i) => { if (i !== chevron) i.remove(); });

    let link = li.querySelector('a');
    if (!link) {
      link = document.createElement('a');
      link.href = '/account';
    }
    if (!link.getAttribute('aria-label')) link.setAttribute('aria-label', 'account');
    link.classList.add('nav-tools-avatar');
    li.classList.add('nav-tools-account');
    img.setAttribute('alt', img.getAttribute('alt') || '');

    link.prepend(media);
    if (chevron) {
      chevron.classList.add('nav-tools-chevron');
      chevron.setAttribute('aria-hidden', 'true');
      link.append(chevron);
    }
    li.textContent = '';
    li.append(link);
  });
}

/**
 * Adds a count badge to the bag/cart tool link, matching the "2" bubble in the
 * design. The count is never hardcoded: it is read from the `cart-count`
 * metadata or a `data-cart-count` attribute on the block, and can be updated
 * live either by dispatching a `try-on:cart-count` event (`detail.count`) or by
 * calling `window.tryOnHeader.setCartCount(n)`. The badge is hidden whenever the
 * count is zero or absent.
 * @param {Element} navTools The nav-tools section
 * @param {Element} block The block element (source of the authored count)
 */
function decorateCartBadge(navTools, block) {
  if (!navTools) return;

  // locate the bag by its icon name, defensively — the author may not have
  // linked it, so match the icon itself rather than requiring an <a>
  const bagIcon = [...navTools.querySelectorAll('span.icon')].find((icon) => {
    const name = [...icon.classList].find((c) => c.startsWith('icon-'))?.substring(5);
    return name === 'try-on-bag' || name === 'bag';
  });
  if (!bagIcon) return;

  // badge the nearest sensible host so the bubble can sit over the icon:
  // the link if present, else the icon's paragraph wrapper
  const bagHost = bagIcon.closest('a') || bagIcon.closest('p') || bagIcon.parentElement;
  bagHost.classList.add('nav-tools-cart');
  const badge = document.createElement('span');
  badge.className = 'nav-tools-badge';
  badge.setAttribute('aria-hidden', 'true');
  bagHost.append(badge);

  const baseLabel = bagHost.getAttribute('aria-label') || 'bag';

  const setCount = (value) => {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
    bagHost.setAttribute(
      'aria-label',
      count > 0 ? `${baseLabel}, ${count} item${count === 1 ? '' : 's'}` : baseLabel,
    );
  };

  // initial count: authored data attribute wins, then page metadata, else 0
  setCount(block.dataset.cartCount ?? getMetadata('cart-count'));

  // live updates for the running app
  window.addEventListener('try-on:cart-count', (e) => setCount(e.detail?.count));
  window.tryOnHeader = { ...(window.tryOnHeader || {}), setCartCount: setCount };
}

/**
 * Makes the center nav items selectable: clicking one highlights it (accent
 * colour) and clears the rest. Real anchors keep native navigation and get
 * re-highlighted by URL on the next page; plain-text items are exposed as
 * keyboard-operable controls so the selection works without a link.
 * @param {Element} navSections The nav-sections landmark
 */
function setupSectionHighlight(navSections) {
  if (!navSections) return;
  const items = [...navSections.querySelectorAll('li')];

  const activate = (item) => {
    items.forEach((other) => {
      other.classList.remove('active');
      other.removeAttribute('aria-current');
      const otherLink = other.querySelector('a');
      if (otherLink) {
        otherLink.classList.remove('active');
        otherLink.removeAttribute('aria-current');
      }
    });
    item.classList.add('active');
    const link = item.querySelector('a');
    if (link) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      item.setAttribute('aria-current', 'true');
    }
  };

  items.forEach((item) => {
    const link = item.querySelector('a');
    if (!link) {
      // plain text: expose it as an operable control
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
    }
    item.addEventListener('click', () => activate(item));
    item.addEventListener('keydown', (e) => {
      if (!link && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        activate(item);
      }
    });
  });
}

// secondary tools that leave the bar on mobile and move into the opened menu
const MOBILE_MENU_EXTRAS = [
  ['search', 'Search'],
  ['wishlist', 'Wishlist'],
  ['account', 'Account'],
];

/**
 * The mobile bar shows only [☰ logo bag]. So no functionality is lost, the
 * search, wishlist and account links are repeated as text links at the bottom
 * of the opened menu (hidden on desktop by CSS). Hrefs are taken from the
 * authored tool links; a tool without a link is skipped.
 * @param {Element} navSections The nav-sections landmark
 * @param {Element} navTools The nav-tools section
 */
function addMobileMenuExtras(navSections, navTools) {
  const entries = MOBILE_MENU_EXTRAS
    .map(([key, text]) => {
      const href = navTools.querySelector(`.nav-tools-${key} a[href]`)?.getAttribute('href');
      return href ? { text, href } : null;
    })
    .filter(Boolean);
  if (!entries.length) return;

  const list = document.createElement('ul');
  list.className = 'nav-sections-extras';
  entries.forEach(({ text, href }) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    li.append(a);
    list.append(li);
  });
  navSections.append(list);
}

/**
 * Ensures the brand section has a logo wrapped in a link, with a swappable
 * placeholder fallback. Driven defensively so any authored logo works.
 * @param {Element} navBrand The nav-brand section
 */
function decorateBrand(navBrand) {
  if (!navBrand) return;
  const placeholder = `${window.hlx.codeBasePath}/icons/try-on-logo-placeholder.svg`;
  let img = navBrand.querySelector('img');

  // no authored logo: inject the placeholder inside a link to "/"
  if (!img) {
    const link = document.createElement('a');
    link.href = '/';
    link.setAttribute('aria-label', 'Home');
    img = document.createElement('img');
    img.src = placeholder;
    img.alt = 'Home';
    const target = navBrand.querySelector('.default-content-wrapper p')
      || navBrand.querySelector('.default-content-wrapper')
      || navBrand;
    link.append(img);
    target.append(link);
  }

  // keep authored alt, default to "Home"
  if (!img.getAttribute('alt')) img.setAttribute('alt', 'Home');

  // above the fold: prioritise the logo. Only the height is reserved (it is
  // fixed in CSS); a guessed width would distort logos with another aspect
  // ratio, so the width follows the image's intrinsic ratio.
  img.setAttribute('loading', 'eager');
  img.setAttribute('fetchpriority', 'high');
  if (!img.getAttribute('height')) img.setAttribute('height', '32');

  // swap to placeholder if the authored logo fails to load
  img.addEventListener('error', () => {
    if (img.src !== new URL(placeholder, window.location).href) {
      img.src = placeholder;
    }
  }, { once: true });

  // wrap in a link to "/" if not already linked; keep an authored link
  if (!img.closest('a')) {
    const link = document.createElement('a');
    link.href = '/';
    link.setAttribute('aria-label', img.alt || 'Home');
    img.replaceWith(link);
    link.append(img);
  }
}

/**
 * Loads and decorates the try-on header, sourced from a separate /try-on-nav
 * fragment. Fully self-contained; does not touch the existing header block.
 * @param {Element} block The try-on-header block element
 */
export default async function decorate(block) {
  // load nav as a separate fragment, with a page-level override
  const navMeta = getMetadata('try-on-nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/try-on-nav';
  const fragment = await loadFragment(navPath);

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'try-on-nav';
  nav.setAttribute('aria-label', 'Main');
  if (fragment) {
    while (fragment.firstElementChild) nav.append(fragment.firstElementChild);
  }

  // the first section is always the brand/logo; ensure it exists so the header
  // stays visible even when the /try-on-nav fragment is missing or empty
  let navBrand = nav.firstElementChild;
  if (navBrand) {
    navBrand.classList.add('nav-brand');
  } else {
    navBrand = document.createElement('div');
    navBrand.className = 'nav-brand';
    nav.append(navBrand);
  }
  decorateBrand(navBrand);

  // the links and the icon tools may arrive as two sections or bundled into
  // one; classify every list by content and route it to the right landmark so
  // the layout holds regardless of how the author structured the fragment
  const navSections = document.createElement('div');
  navSections.className = 'nav-sections';
  navSections.id = 'try-on-nav-sections';
  const navTools = document.createElement('div');
  navTools.className = 'nav-tools';

  const isIconList = (ul) => {
    const items = [...ul.children];
    return items.length > 0
      && items.every((li) => li.querySelector('.icon, img') && !li.textContent.trim());
  };

  nav.querySelectorAll('ul').forEach((ul) => {
    if (navBrand.contains(ul)) return; // never raid the brand section
    (isIconList(ul) ? navTools : navSections).append(ul);
  });

  // drop the now-empty source wrappers, keeping brand and the new landmarks
  [...nav.children].forEach((child) => {
    if (child !== navBrand && child !== navSections && child !== navTools) {
      child.remove();
    }
  });
  nav.append(navSections, navTools);

  labelToolLinks(navTools);
  foldAvatarTools(navTools);
  decorateCartBadge(navTools, block);
  markActiveLink(navSections);
  setupSectionHighlight(navSections);
  // after the highlight setup so the repeated tool links are not made selectable
  addMobileMenuExtras(navSections, navTools);

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.className = 'nav-hamburger';
  hamburger.innerHTML = `<button type="button" aria-controls="${navSections.id}" aria-label="Open navigation" aria-expanded="false">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  const hamburgerButton = hamburger.querySelector('button');
  hamburgerButton.addEventListener('click', () => toggleMenu(nav, hamburgerButton));
  nav.prepend(hamburger);

  // close the mobile menu on Escape and return focus to the toggle
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !isDesktop.matches && hamburgerButton.getAttribute('aria-expanded') === 'true') {
      toggleMenu(nav, hamburgerButton, false);
      hamburgerButton.focus();
    }
  });

  // reset state when crossing the desktop breakpoint
  isDesktop.addEventListener('change', () => toggleMenu(nav, hamburgerButton, false));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}