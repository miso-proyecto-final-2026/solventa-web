/** Nombre de cada producto: lo usan la cotización asistida (HU38) y las suscripciones (HU39). */
const PRODUCTS: Record<string, string> = {
  microseguro_vida: $localize`:@@assistedQuote.product.microseguro_vida:Microseguro de vida`,
  proteccion_dispositivos: $localize`:@@assistedQuote.product.proteccion_dispositivos:Protección de dispositivos`,
};

export const productLabel = (code: string, fallback?: string): string =>
  PRODUCTS[code] ?? fallback ?? code;
