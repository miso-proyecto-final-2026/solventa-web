import { Money } from '@core/money/money';

/** Estados de la saga tal como los expone MS Suscripción. */
export type SagaStatus =
  | 'EN_PROGRESO'
  | 'APROBADA'
  | 'COBRO_REALIZADO'
  | 'FIRMADA'
  | 'EMITIDA'
  | 'RECHAZADA'
  | 'COMPENSADA';

export type SagaStep = 'DECISION' | 'COBRO' | 'FIRMA' | 'EMISION';

export type StatusFilter = 'ALL' | SagaStatus;

export interface SubscriptionQuery {
  readonly status: StatusFilter;
  /** Desde 1. */
  readonly page: number;
}

export const PAGE_SIZE = 20;

/** Lo mínimo para identificar al cliente (ADR-0008). Nulo si MS Identidad no responde. */
export interface ClientSummary {
  readonly name: string;
  readonly lastNameInitial: string;
  readonly documentType: string;
  readonly maskedDocument: string;
}

/** El cobro se devuelve porque la firma venció o falló. */
export interface Compensation {
  /** `SOLICITADA` mientras MS Pagos reembolsa; `COMPLETADA` al confirmarlo. */
  readonly status: string;
  readonly reason: string | null;
  readonly requestedAt: Date | null;
}

export interface PolicySummary {
  readonly number: string;
  readonly status: string;
  readonly documentStatus: string;
}

export type SignatureStatus = 'PENDING' | 'SIGNED' | 'EXPIRED' | 'FAILED';

export interface SignatureSummary {
  readonly status: SignatureStatus;
  readonly expiresAt: Date | null;
}

export interface AssistedSubscription {
  readonly id: string;
  readonly quoteId: string;
  readonly client: ClientSummary | null;
  readonly productCode: string;
  readonly insuredAmount: Money;
  readonly paymentFrequency: string;
  readonly status: SagaStatus;
  readonly step: SagaStep;
  readonly steps: readonly SagaStep[];
  readonly decision: string | null;
  readonly chargeStatus: string | null;
  readonly chargeReason: string | null;
  readonly signature: SignatureSummary | null;
  readonly compensation: Compensation | null;
  readonly policy: PolicySummary | null;
  /** Lo decide el backend: el estado no basta porque con un reembolso pedido sigue en `COBRO_REALIZADO`. */
  readonly canManageSignature: boolean;
  readonly createdAt: Date;
}

export interface SubscriptionPage {
  readonly items: readonly AssistedSubscription[];
  readonly total: number;
  readonly page: number;
  readonly size: number;
}

export type PaymentFrequency = 'ANUAL' | 'MENSUAL';

export interface StartRequest {
  readonly quoteId: string;
  /** Token de la pasarela: el número de la tarjeta nunca sale del navegador. */
  readonly paymentToken: string;
  readonly frequency: PaymentFrequency;
  /** El asesor declara que el cliente está al tanto de la transacción y aceptó los términos. */
  readonly termsAccepted: boolean;
}

export interface SignatureDocument {
  readonly policyNumber: string;
  /** Hash del PDF; se devuelve al firmar para probar qué se firmó. */
  readonly hash: string;
  readonly state: 'PENDING' | 'SIGNED';
  readonly expiresAt: Date | null;
}

export interface SignRequest {
  readonly hash: string;
  readonly reviewed: boolean;
  readonly code: string;
}

export interface SignatureResult {
  readonly status: SagaStatus;
  readonly signedAt: Date;
  /** Verdadero si ya estaba firmada, por ejemplo, por el cliente desde su canal. */
  readonly replay: boolean;
}

/**
 * Índice del paso actual para el `Stepper`. Con la saga emitida, todos están hechos. Lo que no
 * terminó bien se queda en el paso donde falló y la pantalla lo explica aparte.
 */
export function currentStepIndex(s: AssistedSubscription): number {
  return s.status === 'EMITIDA' ? s.steps.length : Math.max(0, s.steps.indexOf(s.step));
}

/** La saga sigue avanzando sola (decisión o cobro): la pantalla vuelve a consultar. */
export function isAdvancing(s: AssistedSubscription): boolean {
  // Un caso derivado espera a una persona: consultar otra vez no lo hace avanzar.
  if (s.decision === 'DERIVADA') return false;
  return s.status === 'EN_PROGRESO' || (s.status === 'APROBADA' && s.chargeStatus === null);
}

export function canDownloadSigned(s: AssistedSubscription): boolean {
  return s.status === 'FIRMADA' || s.status === 'EMITIDA';
}
