import { getProduct, blockText, el } from '../../scripts/product-service.js';
import { ICONS } from '../../icons/icons-svg.js';

const WISHLIST_KEY = 'wishlist';

function readWishlist() {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || [];
  } catch (e) {
    return [];
  }
}

export default async function decorate(block) {
  const text = blockText(block, {
    'wishlist-add': 'Add to wishlist',
    'wishlist-remove': 'Remove from wishlist',
  });
  const product = await getProduct();
  block.replaceChildren();
  if (!product) return;

  if (product.discount > 0) {
    const badge = el('span', 'product-discount-badge');
    const visible = el('span', '', `-${product.discount}%`);
    visible.setAttribute('aria-hidden', 'true');
    badge.append(visible, el('span', 'pdp-vh', `${product.discount}% off`));
    block.append(badge);
  }

  // no discount: the title slides up and the heart sits to its right (layout in styles.css)
  block.closest('.section')?.classList.toggle('pdp-no-discount', !(product.discount > 0));

  const heart = el('button', 'product-discount-wish');
  heart.type = 'button';
  heart.innerHTML = ICONS.heart;
  const render = (saved) => {
    heart.setAttribute('aria-pressed', saved);
    heart.setAttribute('aria-label', saved ? text['wishlist-remove'] : text['wishlist-add']);
  };
  render(readWishlist().includes(product.sku));
  heart.addEventListener('click', () => {
    const list = readWishlist();
    // the button is the source of truth, so it still toggles when storage is unavailable
    const saved = heart.getAttribute('aria-pressed') !== 'true';
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(
        saved ? [...list, product.sku] : list.filter((sku) => sku !== product.sku),
      ));
    } catch (e) {
      // storage unavailable: keep the in-page state only
    }
    render(saved);
    heart.dispatchEvent(new CustomEvent('product:wishlist', { bubbles: true, detail: { sku: product.sku, saved } }));
  });
  block.append(heart);
}
