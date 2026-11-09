import { getProduct, blockText, el } from '../../scripts/product-service.js';

export default async function decorate(block) {
  const text = blockText(block, { reviews: 'Reviews', 'rating-label': 'Rated {rating} out of 5' });
  const product = await getProduct();
  block.replaceChildren();
  if (!product || (product.rating === null && product.reviewCount === null)) return;

  if (product.reviewCount !== null) {
    const link = el('a', 'product-revratings-link', text.reviews);
    link.href = product.reviewsUrl;
    link.append(el('span', 'product-revratings-count', ` (${product.reviewCount})`));
    block.append(link);
  }
  if (product.rating !== null) {
    const stars = el('span', 'product-revratings-stars', '★★★★★');
    stars.style.setProperty('--fill', `${Math.min(product.rating, 5) * 20}%`);
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', text['rating-label'].replace('{rating}', product.rating));
    block.append(stars);
  }
}
