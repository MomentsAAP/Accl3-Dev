/*
 * Banner block: category banner shown above the Filter / Sort / Products area (PLP).
 */

const DESKTOP_MEDIA = '(width >= 900px)'; // same breakpoint as the PLP layout
const IMAGE_EXT = /\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i;

/** "assets\img\x.png" -> "/assets/img/x.png"; full URLs are kept as they are. */
function toImageUrl(text) {
  const clean = (text || '').trim().replace(/\\/g, '/');
  if (!clean || !IMAGE_EXT.test(clean)) return null;
  if (/^(https?:)?\/\//i.test(clean) || clean.startsWith('/')) return clean;
  return `/${clean.replace(/^\.?\//, '')}`;
}

/** Images in a cell, in authored order: uploaded <img>, image links, or typed paths. */
function readImages(cell) {
  if (!cell) return [];
  const found = [];
  cell.querySelectorAll('img').forEach((img) => {
    found.push({ src: img.getAttribute('src'), alt: img.getAttribute('alt') || '' });
  });
  cell.querySelectorAll('a[href]').forEach((a) => {
    const src = toImageUrl(a.getAttribute('href'));
    if (src && !a.querySelector('img')) found.push({ src, alt: '' });
  });
  if (!found.length) {
    const parts = cell.querySelectorAll('p, li');
    const texts = parts.length ? [...parts].map((p) => p.textContent) : [cell.textContent];
    texts.flatMap((t) => t.split(/\s+/)).map(toImageUrl).filter(Boolean)
      .forEach((src) => found.push({ src, alt: '' }));
  }
  return found;
}

/** Uploaded (media bus) images can be resized by URL; files in /assets/ are served as-is. */
function sized(src, width) {
  if (!src || !src.includes('media_')) return src;
  const url = new URL(src, window.location.href);
  url.searchParams.set('width', width);
  url.searchParams.set('format', 'webply');
  url.searchParams.set('optimize', 'medium');
  return url.pathname + url.search;
}

/** <picture> that swaps between the desktop and mobile image at the 900px breakpoint. */
function buildPicture(desktop, mobile) {
  const wide = desktop || mobile;
  const small = mobile || desktop;
  const picture = document.createElement('picture');

  const source = document.createElement('source');
  source.media = DESKTOP_MEDIA;
  source.srcset = sized(wide.src, '2000');
  picture.append(source);

  const img = document.createElement('img');
  img.src = sized(small.src, '750');
  img.alt = wide.alt;
  img.loading = 'eager';
  img.fetchPriority = 'high';
  img.decoding = 'async';
  img.draggable = false;
  img.addEventListener('error', () => picture.closest('.banner')?.classList.add('no-image'));
  picture.append(img);
  return picture;
}

/** Use case 1: replace every link with its contents, so nothing in the banner navigates. */
function unwrapLinks(root) {
  root.querySelectorAll('a').forEach((a) => a.replaceWith(...a.childNodes));
  root.querySelectorAll('.button-container')
    .forEach((p) => p.classList.remove('button-container'));
  root.querySelectorAll('.button').forEach((el) => el.classList.remove('button', 'primary', 'secondary'));
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  let desktop = null;
  let mobile = null;
  let content = null;

  rows.forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    const key = cells.length > 1 ? cells[0].textContent.trim().toLowerCase() : '';
    if (key === 'mobile' || key === 'desktop') {
      const [image] = readImages(cells[1]);
      if (key === 'mobile') mobile = image || mobile;
      else desktop = image || desktop;
      return;
    }
    
    cells.forEach((cell) => {
      // Check if cell has text elements or images
      const hasHeading = cell.querySelector('h1, h2, h3, h4, h5, h6');
      const hasText = cell.textContent.trim().length > 0;
      const images = (hasHeading || hasText) ? readImages(cell) : [];
      
      if (images.length) {
        desktop = desktop || images[0];
        mobile = mobile || images[1] || null;
      } else if (!content && hasText) {
        content = cell;
      }
    });
  });

  const text = document.createElement('div');
  text.className = 'banner-content';
  
  if (content) {
    unwrapLinks(content);
    
    // Process all children inside content block
    const elements = [...content.children];
    let eyebrowFound = false;

    elements.forEach((el) => {
      const txt = el.textContent.trim();
      if (!txt) {
        el.remove();
        return;
      }

      // If element contains eyebrow text ("AW ...") or is the first element before headings
      if (!eyebrowFound && (txt.includes('AW ') || txt.includes('THANKSGIVING') || el.matches('p, h1, h2, h3, h4, h5, h6'))) {
        el.classList.add('banner-eyebrow');
        eyebrowFound = true;
      } else if (el.matches('h1, h2, h3, h4, h5, h6')) {
        el.classList.add('banner-title');
      } else if (el.tagName === 'P') {
        el.classList.add('banner-text');
      }
    });

    text.append(...content.childNodes);
  }

  const media = document.createElement('div');
  media.className = 'banner-media';
  if (desktop || mobile) media.append(buildPicture(desktop, mobile));
  else block.classList.add('no-image');

  block.replaceChildren(media, text);
  unwrapLinks(block);
}