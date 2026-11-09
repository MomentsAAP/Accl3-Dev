import {
  getProduct, blockText, formatPrice, el,
} from '../../scripts/product-service.js';

export default async function decorate(block) {
  const text = blockText(block, { mrp: 'MRP inclusive of all taxes' });
  const product = await getProduct();
  block.replaceChildren();
  if (!product) return;

  if (product.title) {
    block.append(el(document.querySelector('main h1') ? 'h2' : 'h1', 'product-title-price-name', product.title));
  }

  const current = product.salePrice ?? product.price;
  if (current === null) return;
  const row = el('p', 'product-title-price-row');
  row.append(el('strong', 'product-title-price-now', formatPrice(current)));
  if (product.salePrice !== null && product.price !== null) {
    const was = el('del', 'product-title-price-was', formatPrice(product.price));
    was.setAttribute('aria-label', `Original price ${formatPrice(product.price)}`);
    row.append(was);
  }
  block.append(row, el('p', 'product-title-price-mrp', text.mrp));
}
