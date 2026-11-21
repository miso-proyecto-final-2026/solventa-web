import { Money } from '@core/money/money';

/** Estado del pago que MS Pagos hizo por la indemnización (HU29). */
export type PaymentState = 'PENDING' | 'PAID' | 'FAILED';

/** Conciliación contra el extracto de la pasarela (HU31). `WITH_DIFFERENCE`: el monto no coincidió. */
export type ReconciliationStatus = 'PENDING' | 'RECONCILED' | 'WITH_DIFFERENCE';

export type ExportFormat = 'csv' | 'pdf';

/** Tipos de evento paramétrico que acepta MS Siniestros (`reglas/parametricas.yaml`). */
export const EVENT_TYPES = [
  'sismo',
  'inundacion',
  'sequia',
  'tormenta',
  'vuelo_retrasado',
  'vuelo_cancelado',
] as const;

export interface DisbursementFilters {
  /** Fecha `yyyy-MM-dd` del input de fecha; vacío = sin límite. */
  readonly from: string;
  readonly to: string;
  /** Vacío = todos los tipos. */
  readonly eventType: string;
  readonly reconciliation: ReconciliationStatus | 'ALL';
}

export interface DisbursementQuery extends DisbursementFilters {
  /** Desde 1. */
  readonly page: number;
}

/** Los filtros de una consulta, sin la página: el resumen y el reporte no se paginan. */
export function filtersOf(query: DisbursementQuery): DisbursementFilters {
  return {
    from: query.from,
    to: query.to,
    eventType: query.eventType,
    reconciliation: query.reconciliation,
  };
}

export const NO_FILTERS: DisbursementFilters = {
  from: '',
  to: '',
  eventType: '',
  reconciliation: 'ALL',
};

export const PAGE_SIZE = 25;
export const NOTE_MAX_LENGTH = 500;

export interface Validation {
  readonly result: string;
  readonly reason: string | null;
  readonly rule: string | null;
  readonly rulesVersion: string | null;
}

/** Lo que dijo la pasarela cuando el monto no coincidió con el desembolso registrado. */
export interface Difference {
  readonly recordedAmount: Money;
  readonly gatewayAmount: Money;
  readonly recordedReference: string | null;
  readonly gatewayReference: string | null;
}

export interface Disbursement {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly eventId: string;
  readonly eventType: string | null;
  /** Lo que se comparó contra el umbral, por nombre de campo (p. ej. `magnitud`). */
  readonly magnitude: Readonly<Record<string, number | string>> | null;
  readonly location: string | null;
  readonly eventAt: Date | null;
  readonly policyId: string;
  readonly product: string | null;
  /** Enmascarado por el backend; nunca el identificador completo. */
  readonly client: string | null;
  readonly policyNumber: string | null;
  readonly insuredAmount: Money | null;
  readonly validation: Validation | null;
  readonly paymentState: PaymentState;
  readonly amount: Money;
  readonly gatewayReference: string | null;
  readonly paidAt: Date | null;
  readonly attempts: number;
  /** Veces que llegó el mismo comando después del primero: ninguna volvió a pagar. */
  readonly redeliveries: number;
  readonly reconciliation: ReconciliationStatus;
  readonly reconciledBy: string | null;
  readonly reconciledAt: Date | null;
  readonly difference: Difference | null;
  readonly escalatedAt: Date | null;
  readonly escalatedBy: string | null;
  readonly escalationNote: string | null;
  readonly failureCode: string | null;
  readonly failureReason: string | null;
}

export interface GatewayAttempt {
  readonly number: number;
  /** Tal como lo registra Pagos: APROBADO, RECHAZADO, SIN_RESPUESTA, CONCILIADO… */
  readonly result: string;
  readonly code: string | null;
  readonly reason: string | null;
  readonly reference: string | null;
  readonly at: Date;
}

export interface DisbursementDetail extends Disbursement {
  readonly paymentAttempts: readonly GatewayAttempt[];
}

export interface DisbursementPage {
  readonly items: readonly Disbursement[];
  readonly total: number;
  readonly page: number;
  readonly size: number;
}

/** Totales y comprobación de duplicados. `keysWithMultiplePayments` debe ser 0. */
export interface Summary {
  readonly disbursements: number;
  readonly distinctKeys: number;
  readonly keysWithMultiplePayments: number;
  readonly paid: number;
  readonly paidAmount: Money;
  readonly byReconciliation: Readonly<Record<ReconciliationStatus, number>>;
}

export const isPaid = (d: Disbursement): boolean => d.paymentState === 'PAID';
/** Se puede escalar solo lo que quedó con diferencia. */
export const canEscalate = (d: Disbursement): boolean => d.reconciliation === 'WITH_DIFFERENCE';
