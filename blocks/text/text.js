/*
 * Text block
 * A section heading with an intro paragraph, and an optional small
 * "eyebrow" line above the heading.
 *
 * Authoring:
 *   | Text                                                         |
 *   | Sale                                 (optional, plain text)  |
 *   | Finish the Fit                       (Heading 2 or plain text) |
 *   | Your new fave piece, meet its bestie. Pick the pieces ...     |
 *
 * Heading and text can also sit in the same cell. Lines above the heading
 * become the eyebrow. If no heading is authored, the first line becomes
 * the heading.
 */
 
export default function decorate(block) {
  const nodes = [...block.querySelectorAll(':scope > div > div')]
    .flatMap((cell) => {
      const children = [...cell.children];
      if (children.length) return children;
      // plain text cell without paragraphs
      const text = cell.textContent.trim();
      if (!text) return [];
      const p = document.createElement('p');
      p.textContent = text;
      return [p];
    })
    .filter((node) => node.textContent.trim() || node.querySelector('img, picture'));
 
  const content = document.createElement('div');
  content.className = 'text-content';
 
  let heading = nodes.find((node) => /^H[1-6]$/.test(node.tagName));
  if (!heading && nodes.length) {
    heading = document.createElement('h2');
    heading.textContent = nodes[0].textContent.trim();
    nodes[0] = heading;
  }
 
  let afterHeading = false;
  nodes.forEach((node) => {
    if (node === heading) {
      node.classList.add('text-title');
      afterHeading = true;
    } else if (node.tagName === 'P') {
      node.classList.add(afterHeading ? 'text-description' : 'text-eyebrow');
    }
    content.append(node);
  });
 
  block.replaceChildren(content);
}