import { Injectable } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import { money } from '@core/money/money';
import { Observable, delay, of, throwError } from 'rxjs';
import {
  DecisionRequest,
  InboxQuery,
  PAGE_SIZE,
  ProfileLevels,
  ReferralReason,
  ReviewCategory,
  ReviewDetail,
  ReviewPage,
  ReviewPriority,
  ReviewRow,
} from '../domain/models';
import { AssistedReviewGateway } from './assisted-review.gateway';

const LATENCY_MS = 150;
const HOUR_MS = 60 * 60 * 1000;

function priorityOf(createdAt: Date): ReviewPriority {
  const hours = (Date.now() - createdAt.getTime()) / HOUR_MS;
  return hours >= 24 ? 'HIGH' : hours >= 4 ? 'MEDIUM' : 'LOW';
}

function demoCase(
  n: number,
  hoursAgo: number,
  validForHours: number,
  category: ReviewCategory,
  reason: string,
  amount: number,
): ReviewDetail {
  const now = Date.now();
  const createdAt = new Date(now - hoursAgo * HOUR_MS);
  const validUntil = new Date(now + validForHours * HOUR_MS);
  const expired = validForHours <= 0;
  const reasons: ReferralReason[] = [{ category, text: reason }];
  return {
    id: `00000000-0000-4000-a000-00000000000${n}`,
    clientId: `cli-demo-${n}`,
    client: {
      firstName: ['Ana María', 'Carlos', 'Luisa'][n - 1] ?? 'Cliente',
      lastNameInitial: ['P', 'R', 'M'][n - 1] ?? 'D',
      documentType: 'CC',
      maskedDocument: `******${n}00`,
    },
    quote: {
      quoteId: `cot-demo-${n}`,
      product: 'microseguro_vida',
      insuredAmount: money(amount),
      monthlyPremium: money(Math.round(amount * 0.000365)),
      annualPremium: money(Math.round(amount * 0.004375)),
      paymentPeriod: 'ANNUAL',
      coverages: [
        { type: 'muerte', amount: money(amount), deductible: money(0) },
        { type: 'incapacidad_total', amount: money(amount / 2), deductible: money(0) },
      ],
      validUntil,
    },
    automatic: { reasons, rulesVersion: '2026.10.1-provisional', decidedAt: createdAt },
    human: null,
    priority: priorityOf(createdAt),
    state: 'PENDING',
    createdAt,
    quoteExpired: expired,
    canDecide: true,
    allowedDecisions: expired ? ['REJECTED'] : ['APPROVED', 'REJECTED', 'ADJUSTED'],
  };
}

function toRow(d: ReviewDetail): ReviewRow {
  return {
    id: d.id,
    client: d.client,
    product: d.quote.product,
    insuredAmount: d.quote.insuredAmount,
    categories: [...new Set(d.automatic.reasons.map((r) => r.category))],
    reason: d.automatic.reasons.map((r) => r.text).join('; '),
    createdAt: d.createdAt,
    priority: d.priority,
    state: d.state,
    decision: d.human?.decision ?? null,
    quoteExpired: d.quoteExpired,
    validUntil: d.quote.validUntil,
  };
}

/** Adaptador simulado para desarrollo sin backend: tres casos derivados, uno con la cotización vencida. */
@Injectable()
export class MockAssistedReviewGateway extends AssistedReviewGateway {
  private cases: ReviewDetail[] = [
    demoCase(
      1,
      30,
      72,
      'INCOMPLETE_OR_INCONSISTENT_DATA',
      'El perfil del cliente no está disponible (Perfilamiento no responde.).',
      40_000_000,
    ),
    demoCase(
      2,
      6,
      -2,
      'AMOUNT_OVER_LIMIT',
      'El monto asegurado ($90.000.000) supera el límite de aprobación automática ($80.000.000).',
      90_000_000,
    ),
    demoCase(
      3,
      1,
      96,
      'RISK_PROFILE_OUT_OF_RANGE',
      'Registra 1 reporte(s) negativo(s): sale del rango estándar y lo revisa una persona.',
      30_000_000,
    ),
  ];

  listReviews(query: InboxQuery): Observable<ReviewPage> {
    const state = query.state;
    const items = this.cases
      .filter((c) => c.state === state)
      .filter(
        (c) => !query.category || c.automatic.reasons.some((r) => r.category === query.category),
      )
      .filter((c) => !query.expiredOnly || c.quoteExpired)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const start = (query.page - 1) * PAGE_SIZE;
    return of({
      items: items.slice(start, start + PAGE_SIZE).map(toRow),
      total: items.length,
      expiredTotal: this.cases.filter((c) => c.state === 'PENDING' && c.quoteExpired).length,
      page: query.page,
      size: PAGE_SIZE,
    }).pipe(delay(LATENCY_MS));
  }

  getReview(id: string): Observable<ReviewDetail> {
    const found = this.find(id);
    if (!found) return throwError(() => new ApiError('not-found', 404, 'REVISION_NO_ENCONTRADA'));
    return of(found).pipe(delay(LATENCY_MS));
  }

  getProfile(): Observable<ProfileLevels> {
    return of<ProfileLevels>({
      hasConsent: true,
      source: 'REAL',
      completeness: 0.9,
      signals: [
        { name: 'ratio_endeudamiento', level: 'MEDIUM' },
        { name: 'reportes_negativos', level: 'LOW' },
      ],
    }).pipe(delay(LATENCY_MS));
  }

  decide(id: string, request: DecisionRequest): Observable<ReviewDetail> {
    const found = this.find(id);
    if (!found) return throwError(() => new ApiError('not-found', 404, 'REVISION_NO_ENCONTRADA'));
    if (found.state === 'DECIDED') {
      return throwError(
        () =>
          new ApiError('validation', 409, 'REVISION_YA_DECIDIDA', [
            { field: 'decision', reason: 'APROBADA' },
            { field: 'asesor', reason: 'Laura Gómez' },
            { field: 'decidido_en', reason: new Date().toISOString() },
          ]),
      );
    }
    if (request.decision !== 'REJECTED' && found.quoteExpired) {
      return throwError(() => new ApiError('validation', 409, 'COTIZACION_VENCIDA'));
    }
    let adjustment = null;
    if (request.decision === 'ADJUSTED') {
      const current = found.quote.insuredAmount.amount;
      const next = request.insuredAmount ?? 0;
      if (next <= 0 || next >= current) {
        return throwError(() => new ApiError('validation', 422, 'AJUSTE_INVALIDO'));
      }
      const factor = next / current;
      adjustment = {
        factor,
        originalAmount: current,
        adjustedAmount: next,
        originalMonthlyPremium: found.quote.monthlyPremium.amount,
        monthlyPremium: Math.round(found.quote.monthlyPremium.amount * factor),
        originalAnnualPremium: found.quote.annualPremium.amount,
        annualPremium: Math.round(found.quote.annualPremium.amount * factor),
      };
    }
    const decided: ReviewDetail = {
      ...found,
      state: 'DECIDED',
      canDecide: false,
      allowedDecisions: [],
      human: {
        decision: request.decision,
        justification: request.justification.trim(),
        advisorName: 'Asesor Demo',
        decidedAt: new Date(),
        adjustment,
      },
    };
    this.cases = this.cases.map((c) => (c.id === id ? decided : c));
    return of(decided).pipe(delay(LATENCY_MS));
  }

  private find(id: string): ReviewDetail | undefined {
    return this.cases.find((c) => c.id === id);
  }
}
