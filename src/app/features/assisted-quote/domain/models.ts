import { Money } from '@core/money/money';

export const DOCUMENT_TYPES = ['CC', 'CE', 'PASAPORTE'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Formato que acepta el backend para el número de documento. */
export const DOCUMENT_NUMBER_PATTERN = /^[A-Za-z0-9]{5,15}$/;

export interface DocumentId {
  readonly type: DocumentType;
  readonly number: string;
}

export type ConsentState = 'GRANTED' | 'REVOKED' | 'NOT_GRANTED';

export interface ClientIdentity {
  readonly id: string;
  readonly firstName: string;
  readonly lastNameInitial: string;
  readonly document: DocumentId;
  readonly kycStatus: string;
  readonly consent: { readonly state: ConsentState; readonly grantedAt: Date | null };
}

/** Qué perfil sustentó el precio: el real del cliente, el de por defecto o uno degradado. */
export type ProfileSource = 'REAL' | 'DEFAULT' | 'DEGRADED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ProfileSignal {
  readonly name: string;
  readonly level: RiskLevel;
}

export interface ProfileSummary {
  readonly clientId: string;
  readonly hasConsent: boolean;
  readonly source: ProfileSource;
  readonly completeness: number;
  readonly signals: readonly ProfileSignal[];
}

export type FieldKind = 'integer' | 'text';

export interface FieldSpec {
  readonly name: string;
  readonly kind: FieldKind;
  readonly required: boolean;
  readonly min: number | null;
  readonly max: number | null;
  readonly options: readonly string[] | null;
}

export interface Product {
  readonly code: string;
  readonly name: string;
  readonly fields: readonly FieldSpec[];
}

/** A quién se cotiza: un cliente con cuenta o un prospecto que solo tiene documento. */
export type QuoteSubject =
  | { readonly kind: 'client'; readonly clientId: string }
  | { readonly kind: 'prospect'; readonly document: DocumentId };

export type QuoteData = Readonly<Record<string, number | string>>;

export interface QuoteRequest {
  readonly subject: QuoteSubject;
  readonly productCode: string;
  readonly data: QuoteData;
}

export interface Coverage {
  readonly type: string;
  readonly amount: Money;
  readonly deductible: Money;
}

export interface PriceComponent {
  readonly concept: string;
  readonly amount: Money;
}

export interface Quote {
  readonly id: string;
  readonly productCode: string;
  readonly annualPremium: Money;
  readonly monthlyPremium: Money;
  readonly coverages: readonly Coverage[];
  readonly validUntil: Date;
  /** Precio estimado: se calculó con el perfil por defecto o con uno degradado. */
  readonly estimated: boolean;
  readonly profileSource: ProfileSource;
  readonly withoutAccount: boolean;
  readonly components: readonly PriceComponent[];
}

/** Lo que el asesor ya escribió y se guarda para no perderlo si la sesión vence o se recarga. */
export interface QuoteDraft {
  readonly documentType: DocumentType;
  readonly documentNumber: string;
  readonly productCode: string | null;
  readonly data: Record<string, string>;
}

/** `datos.edad` → `edad`: el backend antepone `datos.` a los campos del seguro en sus errores. */
export const toFieldName = (backendField: string): string => backendField.replace(/^datos\./, '');
