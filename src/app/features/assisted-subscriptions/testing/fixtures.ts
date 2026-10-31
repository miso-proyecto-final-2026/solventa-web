import { money } from '@core/money/money';
import { AssistedSubscription, SignatureDocument, SignatureResult } from '../domain/models';

export const HASH = 'a'.repeat(64);

export const SUBSCRIPTION: AssistedSubscription = {
  id: 'sus-1',
  quoteId: 'cot-1',
  client: { name: 'Ana', lastNameInitial: 'P', documentType: 'CC', maskedDocument: '******300' },
  productCode: 'microseguro_vida',
  insuredAmount: money(40_000_000),
  paymentFrequency: 'ANUAL',
  status: 'COBRO_REALIZADO',
  step: 'FIRMA',
  steps: ['DECISION', 'COBRO', 'FIRMA', 'EMISION'],
  decision: 'APROBADA',
  chargeStatus: 'APROBADO',
  chargeReason: null,
  signature: { status: 'PENDING', expiresAt: new Date('2026-11-01T12:00:00Z') },
  compensation: null,
  policy: { number: 'SOLV-1', status: 'PENDIENTE_FIRMA', documentStatus: 'GENERADO' },
  canManageSignature: true,
  createdAt: new Date('2026-10-30T12:00:00Z'),
};

export const ISSUED: AssistedSubscription = {
  ...SUBSCRIPTION,
  id: 'sus-2',
  status: 'EMITIDA',
  step: 'EMISION',
  signature: { status: 'SIGNED', expiresAt: null },
  policy: { number: 'SOLV-2', status: 'VIGENTE', documentStatus: 'GENERADO' },
  canManageSignature: false,
};

/** Reembolso pedido: la saga sigue en `COBRO_REALIZADO`, pero la firma ya no se puede gestionar. */
export const COMPENSATING: AssistedSubscription = {
  ...SUBSCRIPTION,
  id: 'sus-3',
  signature: { status: 'FAILED', expiresAt: null },
  compensation: { status: 'SOLICITADA', reason: 'FIRMA_FALLIDA', requestedAt: new Date() },
  canManageSignature: false,
};

export const DOCUMENT: SignatureDocument = {
  policyNumber: 'SOLV-1',
  hash: HASH,
  state: 'PENDING',
  expiresAt: new Date('2026-11-01T12:00:00Z'),
};

export const SIGNED: SignatureResult = {
  status: 'EMITIDA',
  signedAt: new Date('2026-10-30T13:00:00Z'),
  replay: false,
};
