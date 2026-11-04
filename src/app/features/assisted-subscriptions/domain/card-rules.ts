/**
 * Reglas de consistencia de la tarjeta (HU39): franquicia, longitud del número, CVC y vencimiento.
 * Son funciones puras; nada de esto sale del navegador (SAQ-A, ADR-0014).
 */
export type CardBrand = 'VISA' | 'MASTERCARD' | 'AMEX' | 'DINERS' | 'UNKNOWN';

export function digitsOnly(card: string): string {
  return card.replace(/[\s-]/g, '');
}

export function detectBrand(card: string): CardBrand {
  const d = digitsOnly(card);
  if (/^3[47]/.test(d)) return 'AMEX';
  if (/^4/.test(d)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'MASTERCARD';
  if (/^(30[0-5]|36|38)/.test(d)) return 'DINERS';
  return 'UNKNOWN';
}

/** AMEX usa 4 dígitos en el código de seguridad; las demás franquicias, 3. */
export function cvcLength(brand: CardBrand): 3 | 4 {
  return brand === 'AMEX' ? 4 : 3;
}

export function isValidCvc(cvc: string, brand: CardBrand): boolean {
  return new RegExp(`^\\d{${cvcLength(brand)}}$`).test(cvc);
}

const PAN_LENGTHS: Readonly<Record<CardBrand, readonly number[]>> = {
  AMEX: [15],
  DINERS: [14],
  VISA: [13, 16, 19],
  MASTERCARD: [16],
  UNKNOWN: [13, 14, 15, 16, 17, 18, 19],
};

export function hasValidPanLength(card: string): boolean {
  return PAN_LENGTHS[detectBrand(card)].includes(digitsOnly(card).length);
}

export type ExpiryError = 'format' | 'past' | 'too-far';

/**
 * `MMAA` (4 dígitos). La tarjeta vale hasta el último día del mes impreso, así que el mes actual
 * todavía es válido. `now` se inyecta para poder probar con fechas fijas.
 */
export function validateExpiry(expiry: string, now: Date = new Date()): ExpiryError | null {
  const m = /^(\d{2})(\d{2})$/.exec(expiry);
  if (!m) return 'format';
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return 'format';
  const current = now.getFullYear() * 12 + now.getMonth();
  const given = year * 12 + (month - 1);
  if (given < current) return 'past';
  if (given > current + 20 * 12) return 'too-far';
  return null;
}
