import { Money } from '@core/money/money';

/** Urgencia por antigüedad en la bandeja: lo calcula el backend con umbrales configurables. */
export type ReviewPriority = 'HIGH' | 'MEDIUM' | 'LOW';

/** Las tres categorías de motivo de la guía. */
export type ReviewCategory =
  'RISK_PROFILE_OUT_OF_RANGE' | 'AMOUNT_OVER_LIMIT' | 'INCOMPLETE_OR_INCONSISTENT_DATA';

export type ReviewState = 'PENDING' | 'DECIDED';

export type ReviewDecision = 'APPROVED' | 'REJECTED' | 'ADJUSTED';

export interface InboxQuery {
  readonly state: ReviewState;
  readonly category: ReviewCategory | null;
  /** Solo las cotizaciones de este asesor. */
  readonly mineOnly: boolean;
  /** Solo pendientes con la cotización vencida. */
  readonly expiredOnly: boolean;
  /** Desde 1. */
  readonly page: number;
}

export const PAGE_SIZE = 20;

export const JUSTIFICATION_MIN = 20;
export const JUSTIFICATION_MAX = 2000;

/** Apellido solo con la inicial y documento enmascarado (ADR-0008). */
export interface ClientSummary {
  readonly firstName: string;
  readonly lastNameInitial: string;
  readonly documentType: string;
  readonly maskedDocument: string;
}

export interface ReviewRow {
  /** El de la suscripción: la bandeja y el detalle se identifican por la saga. */
  readonly id: string;
  /** Nulo si Identidad no respondió: la fila se muestra sin cliente. */
  readonly client: ClientSummary | null;
  readonly product: string;
  readonly insuredAmount: Money;
  readonly categories: readonly ReviewCategory[];
  readonly reason: string;
  readonly createdAt: Date;
  readonly priority: ReviewPriority;
  readonly state: ReviewState;
  readonly decision: ReviewDecision | null;
  readonly quoteExpired: boolean;
  /** Nulo mientras no se conoce la vigencia: la fila se muestra sin la marca. */
  readonly validUntil: Date | null;
}

export interface ReviewPage {
  readonly items: readonly ReviewRow[];
  readonly total: number;
  /** Pendientes con la cotización vencida, para el aviso de la bandeja. */
  readonly expiredTotal: number;
  readonly page: number;
  readonly size: number;
}

export interface Coverage {
  readonly type: string;
  readonly amount: Money;
  readonly deductible: Money;
}

export interface QuoteSummary {
  readonly quoteId: string;
  readonly product: string;
  readonly insuredAmount: Money;
  readonly monthlyPremium: Money;
  readonly annualPremium: Money;
  readonly paymentPeriod: 'ANNUAL' | 'MONTHLY';
  readonly coverages: readonly Coverage[];
  readonly validUntil: Date | null;
}

export interface ReferralReason {
  readonly category: ReviewCategory;
  readonly text: string;
}

export interface AutomaticOutcome {
  readonly reasons: readonly ReferralReason[];
  readonly rulesVersion: string | null;
  readonly decidedAt: Date | null;
}

export interface Adjustment {
  readonly factor: number;
  readonly originalAmount: number;
  readonly adjustedAmount: number;
  readonly originalMonthlyPremium: number;
  readonly monthlyPremium: number;
  readonly originalAnnualPremium: number;
  readonly annualPremium: number;
}

export interface HumanDecision {
  readonly decision: ReviewDecision;
  readonly justification: string | null;
  readonly advisorName: string | null;
  readonly decidedAt: Date | null;
  readonly adjustment: Adjustment | null;
}

export interface ReviewDetail {
  readonly id: string;
  readonly clientId: string;
  readonly client: ClientSummary | null;
  readonly quote: QuoteSummary;
  readonly automatic: AutomaticOutcome;
  readonly human: HumanDecision | null;
  readonly priority: ReviewPriority;
  readonly state: ReviewState;
  readonly createdAt: Date;
  readonly quoteExpired: boolean;
  /** Lo calcula el backend: la web no copia la regla de qué se puede decidir. */
  readonly canDecide: boolean;
  readonly allowedDecisions: readonly ReviewDecision[];
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ProfileSource = 'REAL' | 'DEFAULT' | 'DEGRADED';

/** Niveles, nunca cifras (ADR-0008 §6). */
export interface ProfileLevels {
  readonly hasConsent: boolean;
  readonly source: ProfileSource;
  readonly completeness: number;
  readonly signals: readonly { readonly name: string; readonly level: RiskLevel }[];
}

export interface DecisionRequest {
  readonly decision: ReviewDecision;
  readonly justification: string;
  /** Solo al ajustar: el nuevo monto asegurado. */
  readonly insuredAmount: number | null;
}

/** La justificación se recorta antes de contar, como en el backend. */
export function justificationLength(text: string): number {
  return text.trim().length;
}
