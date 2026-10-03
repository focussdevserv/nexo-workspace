export function shouldOpenFileDetailsByDefault(file) {
  return Boolean(file && (file.driveFileId || file.localOnly || !file.url));
}
