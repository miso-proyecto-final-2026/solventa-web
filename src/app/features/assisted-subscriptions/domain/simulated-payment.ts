/**
 * Pasarela simulada (T4), igual que `TokenizadorSimulado` de la app móvil: el token no contiene ni
 * deriva nada de la tarjeta, salvo el modo de la pasarela simulada de MS Pagos, que se elige por el
 * prefijo. El número se queda en el navegador (SAQ-A, ADR-0014). Con un proveedor real, este archivo
 * y el campo del formulario se reemplazan por su formulario alojado (ADR-0020).
 */
const TEST_MODES: Readonly<Record<string, string>> = {
  '4000000000000002': 'rechazar',
  '4000000000000119': 'perder',
  '4000000000000259': 'tardar',
};

export function digitsOnly(card: string): string {
  return card.replace(/[\s-]/g, '');
}

export function isValidCardNumber(card: string): boolean {
  return /^\d{13,19}$/.test(digitsOnly(card));
}

export function tokenizeSimulated(
  card: string,
  generate: () => string = () => crypto.randomUUID(),
): string {
  const mode = TEST_MODES[digitsOnly(card)];
  return mode ? `tok_sim_${mode}_${generate()}` : `tok_sim_${generate()}`;
}
