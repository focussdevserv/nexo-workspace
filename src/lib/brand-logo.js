export const BRAND_LOGO_MAX_INPUT_BYTES = 2 * 1024 * 1024;
export const BRAND_LOGO_MAX_OUTPUT_BYTES = 28 * 1024;
const acceptedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function validateBrandLogoFile(file) {
  if (!file || !acceptedTypes.has(file.type)) throw new Error('Escolha uma imagem PNG, JPEG ou WebP.');
  if (file.size <= 0 || file.size > BRAND_LOGO_MAX_INPUT_BYTES) throw new Error('A imagem precisa ter entre 1 byte e 2 MB.');
}

export async function compressBrandLogo(file) {
  validateBrandLogoFile(file);
  let bitmap;
  try { bitmap = await globalThis.createImageBitmap(file); }
  catch { throw new Error('Não foi possível abrir esta imagem. Exporte-a como PNG, JPEG ou WebP e tente novamente.'); }
  try {
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Este navegador não conseguiu processar a imagem.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob;
    for (const quality of [0.84, 0.7, 0.56, 0.42]) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
      if (blob?.type === 'image/webp' && blob.size <= BRAND_LOGO_MAX_OUTPUT_BYTES) break;
    }
    if (!blob || blob.type !== 'image/webp') throw new Error('Este navegador não oferece compressão WebP para o logotipo.');
    if (blob.size > BRAND_LOGO_MAX_OUTPUT_BYTES) throw new Error('Esta imagem não pôde ser reduzida o suficiente. Escolha um logotipo mais simples.');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Não foi possível preparar o logotipo.'));
      reader.readAsDataURL(blob);
    });
  } finally { bitmap.close?.(); }
}
