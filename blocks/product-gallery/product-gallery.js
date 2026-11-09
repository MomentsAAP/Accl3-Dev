import {
  getProduct, getSelection, setSelection, onSelection, productImage, blockText, el,
} from '../../scripts/product-service.js';
import openLightbox from './lightbox.js';

const PRIMARY = { width: 772, height: 982 };
const OTHER = { width: 382, height: 491 };

export default async function decorate(block) {
  const text = blockText(block, { label: 'Product images', 'image-label': 'Show image' });
  const product = await getProduct();
  block.replaceChildren();
  if (!product?.colors.length) return;

  if (!getSelection().color) setSelection({ color: product.defaultColor });

  block.setAttribute('role', 'region');
  block.setAttribute('aria-label', text.label);
  const list = el('ul', 'product-gallery-list');
  const dots = el('div', 'product-gallery-dots');
  block.append(list, dots);

  let items = [];
  const step = () => (items[1] ? items[1].offsetLeft - items[0].offsetLeft : list.clientWidth) || 1;
  const index = () => Math.round(list.scrollLeft / step());

  const markActive = () => {
    const current = Math.min(index(), items.length - 1);
    [...dots.children].forEach((dot, i) => {
      if (i === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };

  // the strip only scrolls on phone, so only then does it need to be keyboard focusable
  const syncFocus = () => { list.tabIndex = list.scrollWidth > list.clientWidth + 1 ? 0 : -1; };

  const render = ({ color }) => {
    const group = product.colors.find((c) => c.key === color) || product.colors[0];
    const label = [product.title, group.name].filter(Boolean).join(' - ');
    list.scrollLeft = 0;
    items = group.images.map((src, i) => {
      const li = el('li', i === 0 ? 'product-gallery-item product-gallery-primary' : 'product-gallery-item');
      const size = i === 0 ? PRIMARY : OTHER;
      const zoom = el('button', 'product-gallery-zoom');
      zoom.type = 'button';
      zoom.setAttribute('aria-label', `Enlarge image ${i + 1} of ${group.images.length}`);
      zoom.append(productImage(src, `${label} - image ${i + 1}`, {
        ...size,
        eager: i === 0,
        breakpoints: i === 0
          ? [{ media: '(min-width: 600px)', width: '1200' }, { width: '750' }]
          : [{ media: '(min-width: 600px)', width: '800' }, { width: '750' }],
      }));
      zoom.addEventListener('click', () => openLightbox(group.images, label, i));
      li.append(zoom);
      return li;
    });
    list.replaceChildren(...items);

    dots.replaceChildren(...(items.length > 1 ? items.map((li, i) => {
      const dot = el('button', 'product-gallery-dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', `${text['image-label']} ${i + 1} of ${items.length}`);
      dot.addEventListener('click', () => list.scrollTo({ left: li.offsetLeft - items[0].offsetLeft, behavior: 'smooth' }));
      return dot;
    }) : []));
    markActive();
    syncFocus();
  };

  list.addEventListener('scroll', markActive, { passive: true });
  new ResizeObserver(syncFocus).observe(list);
  render(getSelection());
  let shown = getSelection().color;
  onSelection((sel) => {
    if (sel.color !== shown) {
      shown = sel.color;
      render(sel);
    }
  });
}
