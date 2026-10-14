// Print, Export as PDF and Copy take a clone of the live document, which
// carries markup only the view uses: find's highlights, the source line
// palette picks look for (data-line), the hast node react-markdown hands its
// overrides (it reaches the DOM as node="[object Object]"), and the tabindex
// a followed footnote gets.

import { clearMatches } from './find-walker';

const VIEW_ONLY_ATTRIBUTES = ['data-line', 'node', 'tabindex'];

/** Remove the view's own markup from `root`, a detached clone of the document. */
export function stripLiveMarkup(root: HTMLElement): void {
  clearMatches(root);
  for (const name of VIEW_ONLY_ATTRIBUTES) {
    root.querySelectorAll(`[${name}]`).forEach((el) => el.removeAttribute(name));
  }
}
