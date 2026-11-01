/** El documento que el cliente firma con el enlace del correo (HU39). */
export interface LinkDocument {
  readonly policyNumber: string;
  /** Hash del PDF; se devuelve al firmar para probar qué se firmó. */
  readonly hash: string;
  readonly state: 'PENDING' | 'SIGNED';
  readonly expiresAt: Date | null;
}
