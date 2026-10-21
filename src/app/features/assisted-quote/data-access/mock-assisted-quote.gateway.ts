import { Injectable } from '@angular/core';
import { ApiError, FieldError } from '@core/http/api-error';
import { money } from '@core/money/money';
import { Observable, delay, of, throwError } from 'rxjs';
import {
  ClientIdentity,
  ConsentState,
  DocumentId,
  Product,
  ProfileSource,
  ProfileSummary,
  Quote,
  QuoteRequest,
  RiskLevel,
} from '../domain/models';
import { AssistedQuoteGateway } from './assisted-quote.gateway';

const LATENCY_MS = 150;
const DAY_MS = 24 * 60 * 60 * 1000;

interface DemoClient {
  readonly id: string;
  readonly firstName: string;
  readonly lastNameInitial: string;
  readonly consent: ConsentState;
  readonly levels: readonly [RiskLevel, RiskLevel, RiskLevel] | null;
  /** Factor de riesgo que el motor aplicaría con ese perfil. */
  readonly factor: number;
}

/** Los mismos cinco clientes que siembra `solventa-backend/services/identidad/scripts/sembrar_demo.py`. */
const DEMO_CLIENTS: Readonly<Record<string, DemoClient>> = {
  '1000000001': {
    id: '00000000-0000-4000-8000-0000000000a1',
    firstName: 'Ana',
    lastNameInitial: 'F.',
    consent: 'GRANTED',
    levels: ['LOW', 'LOW', 'LOW'],
    factor: 0.9025,
  },
  '1000000002': {
    id: '00000000-0000-4000-8000-0000000000b2',
    firstName: 'Bruno',
    lastNameInitial: 'R.',
    consent: 'GRANTED',
    levels: ['HIGH', 'MEDIUM', 'HIGH'],
    factor: 1.58125,
  },
  '1000000003': {
    id: '00000000-0000-4000-8000-0000000000c3',
    firstName: 'Carla',
    lastNameInitial: 'N.',
    consent: 'GRANTED',
    levels: ['LOW', 'LOW', 'MEDIUM'],
    factor: 1,
  },
  '1000000004': {
    id: '00000000-0000-4000-8000-0000000000d4',
    firstName: 'Diego',
    lastNameInitial: 'R.',
    consent: 'REVOKED',
    levels: null,
    factor: 1,
  },
  '1000000005': {
    id: '00000000-0000-4000-8000-0000000000e5',
    firstName: 'Elena',
    lastNameInitial: 'S.',
    consent: 'NOT_GRANTED',
    levels: null,
    factor: 1,
  },
};

const SIGNAL_NAMES = [
  'ratio_endeudamiento',
  'reportes_negativos',
  'ingresos_mensuales_cop',
] as const;

const CATALOG: readonly Product[] = [
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
      { name: 'antiguedad_meses', kind: 'integer', required: true, min: 0, max: 36, options: null },
    ],
  },
];

/** Adaptador simulado para desarrollo sin backend y para Cypress. Replica la matriz demo del backend. */
@Injectable()
export class MockAssistedQuoteGateway extends AssistedQuoteGateway {
  findClient(document: DocumentId): Observable<ClientIdentity | null> {
    const demo = DEMO_CLIENTS[document.number];
    if (!demo) return of(null).pipe(delay(LATENCY_MS));
    return of({
      id: demo.id,
      firstName: demo.firstName,
      lastNameInitial: demo.lastNameInitial,
      document,
      kycStatus: 'VERIFICADO',
      consent: {
        state: demo.consent,
        grantedAt: demo.consent === 'NOT_GRANTED' ? null : new Date(),
      },
    }).pipe(delay(LATENCY_MS));
  }

  getProfile(clientId: string): Observable<ProfileSummary> {
    const demo = this.byId(clientId);
    const hasConsent = demo?.consent === 'GRANTED';
    const source: ProfileSource = hasConsent ? 'REAL' : 'DEFAULT';
    const signals =
      hasConsent && demo?.levels
        ? SIGNAL_NAMES.map((name, i) => ({ name, level: (demo.levels as readonly RiskLevel[])[i] }))
        : [];
    return of({
      clientId,
      hasConsent,
      source,
      completeness: hasConsent ? 1 : 0,
      signals,
    }).pipe(delay(LATENCY_MS));
  }

  getCatalog(): Observable<readonly Product[]> {
    return of(CATALOG).pipe(delay(LATENCY_MS));
  }

  requestQuote(request: QuoteRequest): Observable<Quote> {
    const product = CATALOG.find((p) => p.code === request.productCode);
    if (!product) {
      return throwError(
        () =>
          new ApiError('validation', 422, 'VALIDATION_ERROR', [
            { field: 'producto', reason: 'producto no existe' },
          ]),
      );
    }
    const fieldErrors = this.validate(product, request);
    if (fieldErrors.length) {
      return throwError(() => new ApiError('validation', 422, 'VALIDATION_ERROR', fieldErrors));
    }

    const demo =
      request.subject.kind === 'client' ? this.byId(request.subject.clientId) : undefined;
    const real = demo?.consent === 'GRANTED';
    const factor = real ? (demo?.factor ?? 1) : 1;
    const value = Number(request.data['suma_asegurada'] ?? request.data['valor_dispositivo']);
    const base = Math.max(
      Math.round(value * (product.code === 'microseguro_vida' ? 0.0035 : 0.045)),
      40_000,
    );
    const annual = Math.round(base * factor);

    return of({
      id: crypto.randomUUID(),
      productCode: product.code,
      annualPremium: money(annual),
      monthlyPremium: money(Math.round(annual / 12)),
      coverages:
        product.code === 'microseguro_vida'
          ? [
              { type: 'muerte', amount: money(value), deductible: money(0) },
              {
                type: 'incapacidad_total',
                amount: money(Math.round(value / 2)),
                deductible: money(0),
              },
            ]
          : [
              {
                type: 'dano_accidental',
                amount: money(value),
                deductible: money(Math.round(value * 0.1)),
              },
              { type: 'robo', amount: money(value), deductible: money(Math.round(value * 0.2)) },
            ],
      validUntil: new Date(Date.now() + 30 * DAY_MS),
      estimated: !real,
      profileSource: real ? 'REAL' : 'DEFAULT',
      withoutAccount: request.subject.kind === 'prospect',
      components: [
        { concept: 'prima_base', amount: money(base) },
        { concept: 'ajuste_datos', amount: money(0) },
        { concept: 'ajuste_riesgo', amount: money(annual - base) },
        { concept: 'recargo_degradado', amount: money(0) },
      ],
    } satisfies Quote).pipe(delay(LATENCY_MS));
  }

  private byId(clientId: string): DemoClient | undefined {
    return Object.values(DEMO_CLIENTS).find((c) => c.id === clientId);
  }

  private validate(product: Product, request: QuoteRequest): FieldError[] {
    const errors: FieldError[] = [];
    for (const field of product.fields) {
      const raw = request.data[field.name];
      if (raw === undefined || raw === '') {
        errors.push({ field: `datos.${field.name}`, reason: 'es obligatorio' });
      } else if (field.kind === 'integer' && field.min !== null && Number(raw) < field.min) {
        errors.push({
          field: `datos.${field.name}`,
          reason: `debe ser mayor o igual a ${field.min}`,
        });
      } else if (field.kind === 'integer' && field.max !== null && Number(raw) > field.max) {
        errors.push({
          field: `datos.${field.name}`,
          reason: `debe ser menor o igual a ${field.max}`,
        });
      }
    }
    return errors;
  }
}
