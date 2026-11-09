import {
  getProduct, blockText, el,
} from '../../scripts/product-service.js';
import { ICONS } from '../../icons/icons-svg.js';

// the icon comes in two sizes; css shows the 24 on phone and the 32 on desktop
function withIcons(node, label) {
  const small = el('span', 'product-add-cart-icon product-add-cart-icon-small');
  small.innerHTML = ICONS.bag24;
  const large = el('span', 'product-add-cart-icon product-add-cart-icon-large');
  large.innerHTML = ICONS.bag32;
  node.append(small, large, el('span', '', label));
  return node;
}

export default async function decorate(block) {
  const text = blockText(block, {
    'add-to-bag': 'Add to Bag',
  });
  
  const product = await getProduct();
  block.replaceChildren();
  if (!product) return;

  // Add to Bag intentionally does nothing yet
  const add = withIcons(el('button', 'product-add-cart-btn'), text['add-to-bag']);
  add.type = 'button';
  block.append(add);
}