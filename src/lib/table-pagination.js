export function clampTablePage(page, pageCount) {
  const safePageCount = Math.max(1, Math.floor(Number(pageCount) || 1));
  const safePage = Math.floor(Number(page) || 1);
  return Math.min(Math.max(1, safePage), safePageCount);
}

export function moveTablePage(page, pageCount, delta) {
  const currentPage = clampTablePage(page, pageCount);
  return clampTablePage(currentPage + Math.sign(Number(delta) || 0), pageCount);
}
