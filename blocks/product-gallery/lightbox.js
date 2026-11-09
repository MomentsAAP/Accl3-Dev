import { productImage, el } from '../../scripts/product-service.js';
import { ICONS } from '../../icons/icons-svg.js';

let dialog;
let stage;
let prev;
let next;
let close;
let dots;
let state = { images: [], label: '', index: 0 };

function show(index) {
  const { images, label } = state;
  state.index = Math.max(0, Math.min(index, images.length - 1));
  const n = state.index;
  stage.replaceChildren(productImage(images[n], `${label} - image ${n + 1}`, {
    breakpoints: [{ width: '1600' }],
  }));
  dialog.setAttribute('aria-label', `${label} - image ${n + 1} of ${images.length}`);

  // first image: Previous is off, last image: Next is off (no wrap-around)
  prev.disabled = n === 0;
  next.disabled = n === images.length - 1;
  [...dots.children].forEach((dot, i) => {
    if (i === n) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });
  // a disabled button cannot keep focus, so hand it to the arrow that still works
  if (document.activeElement?.disabled || document.activeElement === document.body) {
    (n === 0 ? next : prev).focus();
  }
}

function iconButton(className, label, icon) {
  const button = el('button', `product-gallery-lightbox-btn ${className}`);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.innerHTML = ICONS[icon];
  return button;
}

function build() {
  dialog = el('dialog', 'product-gallery-lightbox');
  stage = el('div', 'product-gallery-lightbox-stage');
  dots = el('div', 'product-gallery-lightbox-dots');
  dots.setAttribute('aria-hidden', 'true');
  close = iconButton('product-gallery-lightbox-close', 'Close', 'close');
  prev = iconButton('product-gallery-lightbox-prev', 'Previous image', 'chevron');
  next = iconButton('product-gallery-lightbox-next', 'Next image', 'chevron');
  close.autofocus = true;
  dialog.append(stage, prev, next, dots, close);

  close.addEventListener('click', () => dialog.close());
  prev.addEventListener('click', () => show(state.index - 1));
  next.addEventListener('click', () => show(state.index + 1));
  // a click on the blurred background (anything that is not the image or a button) closes it
  dialog.addEventListener('click', (e) => {
    if (!e.target.closest('img, button')) dialog.close();
  });
  // Esc is handled natively by the dialog
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(state.index - 1);
    if (e.key === 'ArrowRight') show(state.index + 1);
  });
  dialog.addEventListener('close', () => document.documentElement.classList.remove('product-gallery-locked'));
  document.body.append(dialog);
}

/** Opens the lightbox on images[index]; focus returns to the opener when it closes. */
export default function openLightbox(images, label, index) {
  if (!dialog) build();
  state = { images, label, index };
  const single = images.length < 2;
  prev.hidden = single;
  next.hidden = single;
  dots.hidden = single;
  dots.replaceChildren(...images.map(() => el('span', 'product-gallery-lightbox-dot')));
  document.documentElement.classList.add('product-gallery-locked');
  dialog.showModal();
  show(index);
}
