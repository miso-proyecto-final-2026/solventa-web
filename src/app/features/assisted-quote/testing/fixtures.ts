import { money } from '@core/money/money';
import {
  ClientIdentity,
  MortgageOffer,
  Product,
  ProfileLineage,
  ProfileSummary,
  Quote,
} from '../domain/models';

export const CLIENT: ClientIdentity = {
  id: '00000000-0000-4000-8000-0000000000a1',
  firstName: 'Ana',
  lastNameInitial: 'F.',
  document: { type: 'CC', number: '1000000001' },
  kycStatus: 'VERIFICADO',
  consent: { state: 'GRANTED', grantedAt: new Date('2026-10-01T10:00:00Z') },
};

export const PROFILE: ProfileSummary = {
  clientId: CLIENT.id,
  hasConsent: true,
  source: 'REAL',
  completeness: 1,
  signals: [
    { name: 'ratio_endeudamiento', level: 'LOW' },
    { name: 'reportes_negativos', level: 'LOW' },
    { name: 'ingresos_mensuales_cop', level: 'MEDIUM' },
  ],
};

export const CATALOG: readonly Product[] = [
  {
    code: 'microseguro_vida',
    name: 'Microseguro de vida',
    fields: [
      { name: 'edad', kind: 'integer', required: true, min: 18, max: 65, options: null },
      {
        name: 'suma_asegurada',
        kind: 'integer',
        required: true,
        min: 5_000_000,
        max: 100_000_000,
        options: null,
      },
    ],
  },
  {
    code: 'proteccion_dispositivos',
    name: 'Protección de dispositivos',
    fields: [
      {
        name: 'tipo_dispositivo',
        kind: 'text',
        required: true,
        min: null,
        max: null,
        options: ['celular', 'portatil', 'tableta'],
      },
      {
        name: 'valor_dispositivo',
        kind: 'integer',
        required: true,
        min: 300_000,
        max: 15_000_000,
        options: null,
      },
    ],
  },
];

export const QUOTE: Quote = {
  id: 'q-1',
  productCode: 'microseguro_vida',
  annualPremium: money(157_938),
  monthlyPremium: money(13_162),
  coverages: [
    { type: 'muerte', amount: money(50_000_000), deductible: money(0) },
    { type: 'incapacidad_total', amount: money(25_000_000), deductible: money(0) },
  ],
  validUntil: new Date('2026-11-19T15:00:00Z'),
  estimated: false,
  profileSource: 'REAL',
  withoutAccount: false,
  components: [
    { concept: 'prima_base', amount: money(175_000) },
    { concept: 'ajuste_datos', amount: money(0) },
    { concept: 'ajuste_riesgo', amount: money(-17_062) },
    { concept: 'recargo_degradado', amount: money(0) },
  ],
};

/** HU24: Open Finance en vivo y Open Data caído (valor por defecto), con sus campos ausentes. */
export const LINEAGE: ProfileLineage = {
  profileId: '6a1f0c4e-2b7d-4e9a-8c3f-1d2e3f4a5b6c',
  createdAt: new Date('2026-11-14T15:00:00Z'),
  entries: [
    {
      source: 'open_finance',
      dataType: 'FINANCIAL',
      fields: ['ingresos_mensuales_cop', 'ratio_endeudamiento', 'score_crediticio'],
      fetchedAt: new Date('2026-11-14T15:00:00Z'),
      ttlSeconds: 3600,
      origin: 'LIVE',
      consentGranted: true,
    },
    {
      source: 'open_data',
      dataType: 'SOCIOECONOMIC',
      fields: [],
      fetchedAt: null,
      ttlSeconds: 86400,
      origin: 'DEFAULT',
      consentGranted: true,
    },
  ],
  missing: [
    { field: 'estrato', reason: 'sin_datos' },
    { field: 'zona_riesgo', reason: 'sin_datos' },
  ],
  conflicts: [],
};

/** HU26: oferta de 200 millones, etapa «consolidación», con una señal sin dato. */
export const OFFER: MortgageOffer = {
  quoteId: 'cot-vh-1',
  offerId: 'oferta-1',
  clientId: CLIENT.id,
  insuredSum: money(200_000_000),
  annualPremium: money(421_200),
  monthlyPremium: money(35_100),
  lifeStage: 'consolidacion',
  rulesVersion: '2026.11.1-prototipo',
  profileCreatedAt: new Date('2026-11-20T15:00:00Z'),
  degraded: false,
  coverages: [
    { type: 'muerte', amount: money(200_000_000), deductible: money(0) },
    {
      type: 'incapacidad_total_permanente',
      amount: money(200_000_000),
      deductible: money(20_000_000),
    },
  ],
  steps: [
    {
      kind: 'BASE',
      name: '0.0018 sobre la suma asegurada',
      factor: null,
      adjustment: money(360_000),
      accumulated: money(360_000),
      missingData: false,
    },
    {
      kind: 'LIFE_STAGE',
      name: 'consolidacion',
      factor: 1.3,
      adjustment: money(108_000),
      accumulated: money(468_000),
      missingData: false,
    },
    {
      kind: 'SIGNAL',
      name: 'ratio_endeudamiento',
      factor: 0.9,
      adjustment: money(-46_800),
      accumulated: money(421_200),
      missingData: false,
    },
    {
      kind: 'SIGNAL',
      name: 'score_crediticio',
      factor: 1,
      adjustment: money(0),
      accumulated: money(421_200),
      missingData: true,
    },
  ],
  validUntil: new Date('2026-12-20T15:00:00Z'),
};
