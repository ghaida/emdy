// HTML comments are notes for whoever edits a file, or for a tool, so a reader
// leaves them out. Other raw HTML is untouched, and comment syntax inside code
// is text, not an `html` node, so it stays.

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
}

const COMMENTS_ONLY = /^\s*(?:<!--(?:(?!-->)[\s\S])*-->\s*)+$/;

function removeComments(node: MarkdownNode): void {
  if (!node.children) return;
  node.children = node.children.filter((child) => !(child.type === 'html' && COMMENTS_ONLY.test(child.value ?? '')));
  node.children.forEach(removeComments);
}

export function remarkHideComments() {
  return (tree: MarkdownNode) => removeComments(tree);
}
