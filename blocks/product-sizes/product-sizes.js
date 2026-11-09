import {
  getProduct, getSelection, setSelection, onSelection, blockText, el,
} from '../../scripts/product-service.js';

const LOOKS_LIKE_URL = /^(https?:\/\/|\/|#)/;

export default async function decorate(block) {
  const text = blockText(block, {
    legend: 'Select size',
    'size-guide': 'Size Guide',
    'size-guide-url': '',
  });
  const product = await getProduct();
  block.replaceChildren();
  if (!product?.sizes.length) return;

  // plain buttons so Tab reaches every size
  const group = el('div', 'product-sizes-options');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', text.legend);
  const buttons = product.sizes.map((size) => {
    const button = el('button', 'product-sizes-option', size);
    button.type = 'button';
    button.disabled = product.outOfStock.includes(size);
    button.addEventListener('click', () => setSelection({ size }));
    group.append(button);
    return [size, button];
  });
  block.append(group);

  // a link typed into the label row works too
  const labelIsUrl = LOOKS_LIKE_URL.test(text['size-guide']);
  const url = "#";
  if (url) {
    const guide = el('a', 'product-sizes-guide', labelIsUrl ? 'Size Guide' : text['size-guide']);
    guide.href = url;
    block.append(guide);
  }

  const render = ({ size }) => buttons.forEach(([s, b]) => b.setAttribute('aria-pressed', s === size));
  render(getSelection());
  onSelection(render);
}
