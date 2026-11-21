import { money } from '@core/money/money';
import { ProfileLevels, ReviewDetail, ReviewRow } from '../domain/models';

export const CLIENT = {
  firstName: 'Ana María',
  lastNameInitial: 'P',
  documentType: 'CC',
  maskedDocument: '******300',
};

export const ROW: ReviewRow = {
  id: 'sus-1',
  client: CLIENT,
  product: 'microseguro_vida',
  insuredAmount: money(40_000_000),
  categories: ['INCOMPLETE_OR_INCONSISTENT_DATA'],
  reason: 'El perfil del cliente no está disponible (Perfilamiento no responde.).',
  createdAt: new Date('2026-11-09T08:00:00Z'),
  priority: 'HIGH',
  state: 'PENDING',
  decision: null,
  quoteExpired: false,
  validUntil: new Date('2026-11-20T12:00:00Z'),
};

export const EXPIRED_ROW: ReviewRow = {
  ...ROW,
  id: 'sus-2',
  priority: 'MEDIUM',
  categories: ['AMOUNT_OVER_LIMIT'],
  quoteExpired: true,
  validUntil: new Date('2026-11-08T12:00:00Z'),
};

export const DETAIL: ReviewDetail = {
  id: 'sus-1',
  clientId: 'cli-1',
  client: CLIENT,
  quote: {
    quoteId: 'cot-1',
    product: 'microseguro_vida',
    insuredAmount: money(40_000_000),
    monthlyPremium: money(14_583),
    annualPremium: money(175_000),
    paymentPeriod: 'ANNUAL',
    coverages: [
      { type: 'muerte', amount: money(40_000_000), deductible: money(0) },
      { type: 'incapacidad_total', amount: money(20_000_000), deductible: money(0) },
    ],
    validUntil: new Date('2026-11-20T12:00:00Z'),
  },
  automatic: {
    reasons: [
      {
        category: 'INCOMPLETE_OR_INCONSISTENT_DATA',
        text: 'El perfil del cliente no está disponible (Perfilamiento no responde.).',
      },
    ],
    rulesVersion: '2026.10.1-provisional',
    decidedAt: new Date('2026-11-09T08:00:05Z'),
  },
  human: null,
  priority: 'HIGH',
  state: 'PENDING',
  createdAt: new Date('2026-11-09T08:00:00Z'),
  quoteExpired: false,
  canDecide: true,
  allowedDecisions: ['APPROVED', 'REJECTED', 'ADJUSTED'],
};

export const EXPIRED_DETAIL: ReviewDetail = {
  ...DETAIL,
  id: 'sus-2',
  quote: { ...DETAIL.quote, validUntil: new Date('2026-11-08T12:00:00Z') },
  quoteExpired: true,
  allowedDecisions: ['REJECTED'],
};

export const DECIDED_DETAIL: ReviewDetail = {
  ...DETAIL,
  state: 'DECIDED',
  canDecide: false,
  allowedDecisions: [],
  human: {
    decision: 'ADJUSTED',
    justification: 'Se ajustó el monto por el nivel de ingresos soportado.',
    advisorName: 'Laura Gómez',
    decidedAt: new Date('2026-11-10T09:30:00Z'),
    adjustment: {
      factor: 0.75,
      originalAmount: 40_000_000,
      adjustedAmount: 30_000_000,
      originalMonthlyPremium: 14_583,
      monthlyPremium: 10_937,
      originalAnnualPremium: 175_000,
      annualPremium: 131_250,
    },
  },
};

export const PROFILE: ProfileLevels = {
  hasConsent: true,
  source: 'REAL',
  completeness: 0.9,
  signals: [
    { name: 'ratio_endeudamiento', level: 'MEDIUM' },
    { name: 'reportes_negativos', level: 'LOW' },
  ],
};

export const JUSTIFICATION = 'Se revisaron los soportes de ingresos del cliente.';
