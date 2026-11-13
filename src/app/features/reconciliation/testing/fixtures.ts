import { money } from '@core/money/money';
import { Disbursement, DisbursementDetail, Summary } from '../domain/models';

export const PENDING: Disbursement = {
  id: 'ds-1',
  idempotencyKey: 'evt-1:pol-1',
  eventId: 'evt-1',
  eventType: 'sismo',
  magnitude: { magnitud: 6.4 },
  location: 'bogota',
  eventAt: new Date('2026-11-10T08:30:00Z'),
  policyId: 'pol-1',
  product: 'parametrico_clima',
  client: 'cli***01',
  policyNumber: null,
  insuredAmount: null,
  validation: {
    result: 'CORRESPONDE_PAGO',
    reason: 'condicion_cumplida',
    rule: 'sismo',
    rulesVersion: 'v1',
  },
  paymentState: 'PAID',
  amount: money(5_000_000),
  gatewayReference: 'simpg_abc',
  paidAt: new Date('2026-11-10T08:31:00Z'),
  attempts: 1,
  redeliveries: 2,
  reconciliation: 'PENDING',
  reconciledBy: null,
  reconciledAt: null,
  difference: null,
  escalatedAt: null,
  escalatedBy: null,
  escalationNote: null,
  failureCode: null,
  failureReason: null,
};

export const RECONCILED: Disbursement = {
  ...PENDING,
  id: 'ds-2',
  eventId: 'evt-2',
  idempotencyKey: 'evt-2:pol-2',
  eventType: 'inundacion',
  magnitude: { nivel_rio_cm: 172 },
  reconciliation: 'RECONCILED',
  reconciledBy: 'Olga Operadora',
  reconciledAt: new Date('2026-11-11T10:00:00Z'),
};

export const WITH_DIFFERENCE: Disbursement = {
  ...PENDING,
  id: 'ds-3',
  eventId: 'evt-3',
  idempotencyKey: 'evt-3:pol-3',
  reconciliation: 'WITH_DIFFERENCE',
  reconciledBy: 'Olga Operadora',
  reconciledAt: new Date('2026-11-11T10:00:00Z'),
  difference: {
    recordedAmount: money(5_000_000),
    gatewayAmount: money(4_900_000),
    recordedReference: 'simpg_abc',
    gatewayReference: 'simpg_abc',
  },
};

export const FAILED: Disbursement = {
  ...PENDING,
  id: 'ds-4',
  eventId: 'evt-4',
  idempotencyKey: 'evt-4:pol-4',
  paymentState: 'FAILED',
  gatewayReference: null,
  attempts: 5,
  failureCode: 'INTENTOS_AGOTADOS',
  failureReason: 'La pasarela no respondió tras 5 intentos.',
};

export const DETAIL: DisbursementDetail = {
  ...PENDING,
  paymentAttempts: [
    {
      number: 1,
      result: 'NO_DISPONIBLE',
      code: null,
      reason: null,
      reference: null,
      at: new Date('2026-11-10T08:30:00Z'),
    },
    {
      number: 2,
      result: 'APROBADO',
      code: null,
      reason: null,
      reference: 'simpg_abc',
      at: new Date('2026-11-10T08:31:00Z'),
    },
  ],
};

export const SUMMARY: Summary = {
  disbursements: 3,
  distinctKeys: 3,
  keysWithMultiplePayments: 0,
  paid: 3,
  paidAmount: money(15_000_000),
  byReconciliation: { PENDING: 1, RECONCILED: 1, WITH_DIFFERENCE: 1 },
};
