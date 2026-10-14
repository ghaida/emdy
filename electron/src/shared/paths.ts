// Path checks shared by the main process and the renderer. Emdy runs on
// macOS, so paths use '/'.

const TEXT_DOCUMENT = /\.(md|markdown|txt)$/i;

/** True when filePath is inside folderPath, not merely sharing a name prefix. */
export function isInsideFolder(filePath: string, folderPath: string): boolean {
  const folder = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
  return filePath.startsWith(folder);
}

/** Markdown or plain text: the files Emdy opens as documents. */
export function isTextDocument(filePath: string): boolean {
  return TEXT_DOCUMENT.test(filePath);
}
