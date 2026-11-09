import { getProduct, blockText, el } from '../../scripts/product-service.js';

// [sheet column, title key, default title]
const ITEMS = [
  ['details', 'details-title', 'Product Details'],
  ['washCare', 'wash-care-title', 'Wash & Care'],
  ['delivery', 'delivery-title', 'Delivery & Returns'],
  ['moreInfo', 'more-info-title', 'More Information'],
];

export default async function decorate(block) {
  const text = blockText(block, {
    ...Object.fromEntries(ITEMS.map(([, key, title]) => [key, title])),
    open: '',
  });
  const product = await getProduct();
  block.replaceChildren();
  if (!product) return;

  const sections = ITEMS.filter(([col]) => product[col]).map(([col, key]) => {
    const details = el('details', 'product-info-item');
    details.append(el('summary', 'product-info-title', text[key]));
    const body = el('div', 'product-info-body');
    product[col].split(/\n+/).filter(Boolean).forEach((line) => body.append(el('p', '', line)));
    details.append(body);
    details.open = text.open === key.replace(/-title$/, '');
    return details;
  });
  block.append(...sections);

  // only one option is open at a time
  sections.forEach((details) => details.addEventListener('toggle', () => {
    if (!details.open) return;
    sections.forEach((other) => { if (other !== details) other.open = false; });
  }));
}
