import { describe, it, expect } from 'vitest';

// Pure helper function representing the safe price coercion logic in BookingModal.jsx
export function getSafeNumericPrice(professional, isNurse = false) {
  const rawPrice = professional?.price ?? professional?.consultationFee ?? (isNurse ? 130 : 250);
  const parsed = typeof rawPrice === 'number' ? rawPrice : parseFloat(rawPrice);
  return isNaN(parsed) ? (isNurse ? 130 : 250) : parsed;
}

describe('BookingModal - Conversão Segura de Preço', () => {
  it('deve formatar preço numérico corretamente', () => {
    const price = getSafeNumericPrice({ price: 250 });
    expect(price).toBe(250);
    expect(price.toFixed(2)).toBe('250.00');
  });

  it('deve aceitar preço formatado como string inteira sem lançar erro', () => {
    const price = getSafeNumericPrice({ price: '250' });
    expect(price).toBe(250);
    expect(price.toFixed(2)).toBe('250.00');
  });

  it('deve aceitar preço formatado como string decimal sem lançar erro', () => {
    const price = getSafeNumericPrice({ price: '150.50' });
    expect(price).toBe(150.50);
    expect(price.toFixed(2)).toBe('150.50');
  });

  it('deve utilizar o valor padrão quando preço for nulo ou inválido', () => {
    const priceDoctor = getSafeNumericPrice({ price: null });
    expect(priceDoctor.toFixed(2)).toBe('250.00');

    const priceNurse = getSafeNumericPrice({ price: undefined }, true);
    expect(priceNurse.toFixed(2)).toBe('130.00');
  });
});
