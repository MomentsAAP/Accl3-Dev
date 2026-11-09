import {
  getProduct, getSelection, setSelection, onSelection, productImage, blockText, el,
} from '../../scripts/product-service.js';

export default async function decorate(block) {
  const text = blockText(block, { label: 'Color:', legend: 'Select color' });
  const product = await getProduct();
  block.replaceChildren();
  // a product without color names in its image files has nothing to choose from
  if (!product?.colors.length || !product.colors[0].name) return;

  if (!getSelection().color) setSelection({ color: product.defaultColor });

  const name = el('strong');
  const label = el('p', 'product-colors-label', `${text.label} `);
  label.setAttribute('aria-live', 'polite');
  label.append(name);

  // plain buttons so Tab reaches every color
  const group = el('div', 'product-colors-options');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', text.legend);
  const buttons = product.colors.map((color) => {
    const button = el('button', 'product-colors-option');
    button.type = 'button';
    button.append(productImage(color.preview, color.name, {
      width: 157, height: 210, eager: true, breakpoints: [{ width: '400' }],
    }));
    button.addEventListener('click', () => setSelection({ color: color.key }));
    group.append(button);
    return [color.key, button];
  });

  const render = ({ color }) => {
    const current = product.colors.find((c) => c.key === color) || product.colors[0];
    name.textContent = current.name;
    buttons.forEach(([key, button]) => button.setAttribute('aria-pressed', key === current.key));
  };
  render(getSelection());
  onSelection(render);
  block.append(label, group);
}
