import { money } from '@core/money/money';
import { ClientIdentity, Product, ProfileSummary, Quote } from '../domain/models';

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
