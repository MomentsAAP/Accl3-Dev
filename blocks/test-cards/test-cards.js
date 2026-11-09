/**
 * test-cards block: a SIMPLE card list only for checking the Filter block.
 * Not the real product cards. Delete it when the real block is ready.
 *
 * DA.live table:  | Test Cards |                    |
 *                 | Source     | /products.json     |
 */
import {
  loadProducts, filterProducts, getCurrentFilters, onFiltersChanged,
} from '../filter/filter.js';

export default async function decorate(block) {
  const sourceRow = [...block.children].find((row) => row.children[0]?.textContent.trim().toLowerCase() === 'source');
  const source = sourceRow?.children[1]?.textContent.trim() || undefined;
  block.textContent = '';

  const summary = document.createElement('p');
  summary.className = 'test-cards-summary';
  const list = document.createElement('ul');
  list.className = 'test-cards-list';
  block.append(summary, list);

  let products = [];
  let filters = getCurrentFilters(); // in case the filter already ran

  function render() {
    const results = filterProducts(products, filters);
    list.replaceChildren(...results.map((product) => {
      const item = document.createElement('li');
      item.className = 'test-card';
      item.innerHTML = `
        <strong></strong>
        <span class="test-card-price"></span>
        <span class="test-card-meta"></span>`;
      item.querySelector('strong').textContent = product.name;
      item.querySelector('.test-card-price').textContent = `$${product.price}`;
      item.querySelector('.test-card-meta').textContent = `${product.category} | ${product.size.join(', ')} | ${product.color.join(', ')}`;
      return item;
    }));
    summary.textContent = results.length
      ? `Showing ${results.length} of ${products.length} products`
      : 'No products match these filters.';
  }

  onFiltersChanged((next) => { // runs every time the Filter block publishes
    filters = next;
    render();
  });

  try {
    products = await loadProducts(source);
    render();
  } catch (error) {
    summary.textContent = `Could not load products: ${error.message}`;
  }
}