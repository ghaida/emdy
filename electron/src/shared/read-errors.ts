// Main refuses a document over the 10 MB cap with this message. A refusal
// reaches the renderer only as the error's text, so the renderer looks for it
// there to say why a file didn't open.
export const FILE_TOO_LARGE = 'File too large (>10 MB)';
