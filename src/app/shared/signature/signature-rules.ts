export const CODE_LENGTH = 6;

/** Segundos entre dos envíos del mismo código o correo. El backend vuelve a validar los correos. */
export const RESEND_WAIT_SECONDS = 60;

/** Solo dígitos: pegar `123 456` no debe gastar un intento, porque tres errores devuelven el cobro. */
export function normalizeCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
}
