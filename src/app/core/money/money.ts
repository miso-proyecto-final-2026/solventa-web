/**
 * Monto con su moneda. Se muestra siempre con el `currency` pipe y el `LOCALE_ID` del build
 * (`es-CO` o `en-US`): ningún monto se formatea a mano.
 */
export interface Money {
  readonly amount: number;
  readonly currency: string;
}

export const money = (amount: number, currency = 'COP'): Money => ({ amount, currency });

/** Los montos en COP no llevan decimales. */
export const CURRENCY_DIGITS = '1.0-0';
