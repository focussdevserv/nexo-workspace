import { parseCatalogPrice } from './catalog-price.js';

const amountPattern = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:[,.]\d{1,2})?$/;

export function commercialServicePricingInput(value) {
  let input = String(value ?? '').trim();
  input = input.replace(/^a partir de\s*/i, '').replace(/^r\$\s*/i, '').trim();
  if (!input || /^(?:a combinar|a definir)$/i.test(input)) return '';
  return input;
}

export function validateCommercialServicePricing(price, cost) {
  for (const [label, value] of [
    ['Preço base', price],
    ['Custo estimado', cost],
  ]) {
    const input = commercialServicePricingInput(value);
    if (!input) continue;
    if (!amountPattern.test(input)) return { error: `${label}: informe um valor numérico, por exemplo 1.250,50.` };

    const amount = parseCatalogPrice(input);
    if (!Number.isFinite(amount) || amount < 0) {
      return { error: `${label}: informe um valor igual ou maior que zero.` };
    }
  }
  return { price: commercialServicePricingInput(price), cost: commercialServicePricingInput(cost) };
}
