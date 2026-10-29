import { money } from '@core/money/money';
import { CaseDetail, CaseNote, FailedPaymentCase, RetryResult } from '../domain/models';

export const CASE: FailedPaymentCase = {
  id: 'tx-1',
  subscriptionId: 'sus-1',
  clientId: 'cli-1',
  status: 'PENDING',
  amount: money(55_500),
  attempts: 1,
  lastAttemptAt: new Date('2026-10-28T15:00:00Z'),
  declineCode: 'FONDOS_INSUFICIENTES',
  declineReason: 'Fondos insuficientes',
  graceUntil: new Date('2026-10-31T15:00:00Z'),
  grace: 'CURRENT',
  card: { brand: 'VISA', last4: '4242' },
};

export const DUE_SOON_CASE: FailedPaymentCase = {
  ...CASE,
  id: 'tx-2',
  subscriptionId: 'sus-2',
  grace: 'DUE_SOON',
  graceUntil: new Date('2026-10-29T10:00:00Z'),
};

export const NOTE: CaseNote = {
  id: 1,
  authorName: 'Asesora Demo',
  authorRole: 'ASESOR',
  text: 'Cliente contactado; paga mañana.',
  createdAt: new Date('2026-10-28T16:00:00Z'),
};

export const DETAIL: CaseDetail = {
  ...CASE,
  retries: 0,
  operatorNotifiedAt: null,
  resolvedAt: null,
  charges: [
    {
      transactionId: 'tx-1',
      isRetry: false,
      status: 'RECHAZADA',
      amount: money(55_500),
      createdAt: new Date('2026-10-28T15:00:00Z'),
      attempts: [
        {
          number: 1,
          result: 'RECHAZADO',
          code: 'FONDOS_INSUFICIENTES',
          reason: 'Fondos insuficientes',
          at: new Date('2026-10-28T15:00:00Z'),
        },
      ],
    },
  ],
  notes: [],
};

/** Reintento que Pagos sigue intentando: la pasarela no estaba disponible. */
export const DETAIL_WITH_PENDING_RETRY: CaseDetail = {
  ...DETAIL,
  attempts: 2,
  retries: 1,
  charges: [
    ...DETAIL.charges,
    {
      transactionId: 'tx-1-r1',
      isRetry: true,
      status: 'PENDIENTE',
      amount: money(55_500),
      createdAt: new Date('2026-10-28T17:00:00Z'),
      attempts: [
        {
          number: 1,
          result: 'NO_DISPONIBLE',
          code: null,
          reason: null,
          at: new Date('2026-10-28T17:00:00Z'),
        },
      ],
    },
  ],
};

export const RETRY_APPROVED: RetryResult = {
  outcome: 'APPROVED',
  gatewayDetail: null,
  declineReason: null,
  caseStatus: 'RECOVERED',
  replay: false,
};
