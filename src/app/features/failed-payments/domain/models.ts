import { Money } from '@core/money/money';

/**
 * Cobro de prima rechazado que gestiona un asesor u operador (HU19). `EXPIRED`: terminó el
 * período de gracia sin recuperarlo y ya se avisó al operador; todavía se puede reintentar.
 */
export type CaseStatus = 'PENDING' | 'EXPIRED' | 'RECOVERED';

/** Urgencia de la gracia. `DUE_SOON`: quedan menos de 24 h (supuesto de HU19, lo decide el backend). */
export type GraceStatus = 'CURRENT' | 'DUE_SOON' | 'OVERDUE';

/** Filtro de la bandeja: los abiertos (pendientes y vencidos) por defecto. */
export type InboxStatusFilter = 'OPEN' | CaseStatus;

export interface InboxQuery {
  readonly status: InboxStatusFilter;
  /** Solo los que vencen en menos de 24 h o ya vencieron. */
  readonly dueSoonOnly: boolean;
  /** Desde 1. */
  readonly page: number;
}

export const PAGE_SIZE = 20;

export interface CardSummary {
  readonly brand: string | null;
  readonly last4: string | null;
}

export interface FailedPaymentCase {
  readonly id: string;
  readonly subscriptionId: string;
  readonly clientId: string;
  readonly status: CaseStatus;
  readonly amount: Money;
  /** Cobros hechos: el original más los reintentos. */
  readonly attempts: number;
  readonly lastAttemptAt: Date;
  readonly declineCode: string | null;
  readonly declineReason: string | null;
  readonly graceUntil: Date;
  /** Nulo cuando el cobro ya se recuperó. */
  readonly grace: GraceStatus | null;
  readonly card: CardSummary;
}

export interface CasePage {
  readonly items: readonly FailedPaymentCase[];
  readonly total: number;
  readonly page: number;
  readonly size: number;
}

export interface GatewayAttempt {
  readonly number: number;
  /** Tal como lo registra Pagos: APROBADO, RECHAZADO, SIN_RESPUESTA, NO_DISPONIBLE… */
  readonly result: string;
  readonly code: string | null;
  readonly reason: string | null;
  readonly at: Date;
}

export interface Charge {
  readonly transactionId: string;
  readonly isRetry: boolean;
  /** PENDIENTE, APROBADA o RECHAZADA. */
  readonly status: string;
  readonly amount: Money;
  readonly createdAt: Date;
  readonly attempts: readonly GatewayAttempt[];
}

export interface CaseNote {
  readonly id: number;
  readonly authorName: string;
  readonly authorRole: string;
  readonly text: string;
  readonly createdAt: Date;
}

export interface CaseDetail extends FailedPaymentCase {
  readonly retries: number;
  readonly operatorNotifiedAt: Date | null;
  readonly resolvedAt: Date | null;
  readonly charges: readonly Charge[];
  readonly notes: readonly CaseNote[];
}

/**
 * Hay un reintento que Pagos todavía no resolvió (la pasarela no estaba disponible o no respondió y
 * lo sigue intentando con la misma clave). Mientras tanto no se ofrece otro: no cobraría dos veces,
 * pero solo repetiría el que ya está en curso.
 */
export function hasPendingRetry(detail: CaseDetail): boolean {
  return detail.charges.some((c) => c.isRetry && c.status === 'PENDIENTE');
}

export type RetryOutcome = 'APPROVED' | 'DECLINED' | 'IN_PROGRESS';

/** Con `IN_PROGRESS`: la pasarela no recibió la orden o no respondió (se concilia). */
export type GatewayDetail = 'UNAVAILABLE' | 'NO_RESPONSE';

export interface RetryResult {
  readonly outcome: RetryOutcome;
  readonly gatewayDetail: GatewayDetail | null;
  readonly declineReason: string | null;
  readonly caseStatus: CaseStatus;
  /** Verdadero si no se cobró otra vez: segundo clic o un reintento que ya estaba en curso. */
  readonly replay: boolean;
}

export const NOTE_MAX_LENGTH = 1000;
