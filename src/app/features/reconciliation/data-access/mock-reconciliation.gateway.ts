import { Injectable } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import { money } from '@core/money/money';
import { Observable, delay, of, throwError } from 'rxjs';
import {
  Disbursement,
  DisbursementDetail,
  DisbursementFilters,
  DisbursementPage,
  DisbursementQuery,
  ExportFormat,
  GatewayAttempt,
  NOTE_MAX_LENGTH,
  PAGE_SIZE,
  Summary,
} from '../domain/models';
import { fromParam, toParam } from './mappers/reconciliation.mapper';
import { ReconciliationGateway } from './reconciliation.gateway';

const LATENCY_MS = 150;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Qué responde el extracto simulado al conciliar cada desembolso: así se ve cada caso sin backend. */
type StatementBehavior = 'MATCHES' | 'DIFFERS' | 'MISSING';

interface DemoDisbursement {
  data: Disbursement;
  readonly statement: StatementBehavior;
}

const NOW = Date.now();

function demo(
  n: number,
  overrides: Partial<Disbursement>,
  statement: StatementBehavior = 'MATCHES',
): DemoDisbursement {
  const eventAt = new Date(NOW - (n + 1) * DAY_MS);
  const paidAt = new Date(eventAt.getTime() + 60_000);
  const amount = money(1_000_000 + n * 500_000);
  return {
    statement,
    data: {
      id: `00000000-0000-4000-a000-00000000000${n}`,
      idempotencyKey: `evt-demo-${n}:pol-demo-${n}`,
      eventId: `evt-demo-${n}`,
      eventType: 'sismo',
      magnitude: { magnitud: 6.4 },
      location: 'bogota',
      eventAt,
      policyId: `pol-demo-${n}`,
      product: 'parametrico_clima',
      client: `cli***0${n}`,
      policyNumber: null,
      insuredAmount: null,
      validation: {
        result: 'CORRESPONDE_PAGO',
        reason: 'condicion_cumplida',
        rule: 'sismo',
        rulesVersion: 'v1',
      },
      paymentState: 'PAID',
      amount,
      gatewayReference: `simpg_demo${n}`,
      paidAt,
      attempts: 1,
      redeliveries: n % 3,
      reconciliation: 'PENDING',
      reconciledBy: null,
      reconciledAt: null,
      difference: null,
      escalatedAt: null,
      escalatedBy: null,
      escalationNote: null,
      failureCode: null,
      failureReason: null,
      ...overrides,
    },
  };
}

const DEMO_OPERATOR = 'Operador demo';

function seed(): DemoDisbursement[] {
  return [
    demo(1, {}),
    demo(
      2,
      { eventType: 'inundacion', magnitude: { nivel_rio_cm: 172 }, location: 'cali' },
      'DIFFERS',
    ),
    demo(3, {
      eventType: 'tormenta',
      magnitude: { viento_kmh: 104 },
      location: 'barranquilla',
      reconciliation: 'RECONCILED',
      reconciledBy: DEMO_OPERATOR,
      reconciledAt: new Date(NOW - DAY_MS),
    }),
    demo(
      4,
      { eventType: 'vuelo_retrasado', magnitude: { retraso_minutos: 215 }, location: null },
      'MISSING',
    ),
    demo(5, {
      eventType: 'sequia',
      magnitude: { precipitacion_mm_30d: 12 },
      paymentState: 'FAILED',
      gatewayReference: null,
      failureCode: 'INTENTOS_AGOTADOS',
      failureReason: 'La pasarela no respondió tras 5 intentos.',
      attempts: 5,
    }),
    demo(6, {
      eventType: 'vuelo_cancelado',
      magnitude: { retraso_minutos: 0 },
      reconciliation: 'WITH_DIFFERENCE',
      reconciledBy: DEMO_OPERATOR,
      reconciledAt: new Date(NOW - DAY_MS),
      difference: {
        recordedAmount: money(4_000_000),
        gatewayAmount: money(3_900_000),
        recordedReference: 'simpg_demo6',
        gatewayReference: 'simpg_demo6',
      },
    }),
  ];
}

/** Datos simulados para desarrollar la pantalla sin backend. El estado se conserva mientras la página siga abierta. */
@Injectable()
export class MockReconciliationGateway extends ReconciliationGateway {
  private readonly rows = seed();

  list(query: DisbursementQuery): Observable<DisbursementPage> {
    const filtered = this.filtered(query);
    const start = (query.page - 1) * PAGE_SIZE;
    return of({
      items: filtered.slice(start, start + PAGE_SIZE),
      total: filtered.length,
      page: query.page,
      size: PAGE_SIZE,
    }).pipe(delay(LATENCY_MS));
  }

  summary(filters: DisbursementFilters): Observable<Summary> {
    const rows = this.filtered(filters);
    const paid = rows.filter((r) => r.paymentState === 'PAID');
    const count = (s: Disbursement['reconciliation']) =>
      rows.filter((r) => r.reconciliation === s).length;
    return of({
      disbursements: rows.length,
      distinctKeys: new Set(rows.map((r) => r.idempotencyKey)).size,
      keysWithMultiplePayments: 0,
      paid: paid.length,
      paidAmount: money(paid.reduce((sum, r) => sum + r.amount.amount, 0)),
      byReconciliation: {
        PENDING: count('PENDING'),
        RECONCILED: count('RECONCILED'),
        WITH_DIFFERENCE: count('WITH_DIFFERENCE'),
      },
    }).pipe(delay(LATENCY_MS));
  }

  get(id: string): Observable<DisbursementDetail> {
    const row = this.find(id);
    if (!row) return this.notFound();
    const attempts: GatewayAttempt[] = Array.from({ length: row.data.attempts }, (_, i) => {
      const last = i === row.data.attempts - 1;
      const paid = row.data.paymentState === 'PAID';
      return {
        number: i + 1,
        result: last && paid ? 'APROBADO' : 'NO_DISPONIBLE',
        code: null,
        reason: null,
        reference: last && paid ? row.data.gatewayReference : null,
        at: new Date((row.data.paidAt ?? new Date(NOW)).getTime() + i * 5_000),
      };
    });
    return of({ ...row.data, paymentAttempts: attempts }).pipe(delay(LATENCY_MS));
  }

  reconcile(id: string): Observable<Disbursement> {
    const row = this.find(id);
    if (!row) return this.notFound();
    if (row.data.paymentState !== 'PAID') {
      return throwError(() => new ApiError('validation', 409, 'DESEMBOLSO_NO_CONCILIABLE'));
    }
    if (row.statement === 'MISSING') {
      return throwError(() => new ApiError('validation', 409, 'EXTRACTO_SIN_PAGO'));
    }
    const matches = row.statement === 'MATCHES';
    row.data = {
      ...row.data,
      reconciliation: matches ? 'RECONCILED' : 'WITH_DIFFERENCE',
      reconciledBy: DEMO_OPERATOR,
      reconciledAt: new Date(),
      difference: matches
        ? null
        : {
            recordedAmount: row.data.amount,
            gatewayAmount: money(row.data.amount.amount - 100_000),
            recordedReference: row.data.gatewayReference,
            gatewayReference: row.data.gatewayReference,
          },
      escalatedAt: matches ? null : row.data.escalatedAt,
      escalatedBy: matches ? null : row.data.escalatedBy,
      escalationNote: matches ? null : row.data.escalationNote,
    };
    return of(row.data).pipe(delay(LATENCY_MS));
  }

  escalate(id: string, note: string): Observable<Disbursement> {
    const row = this.find(id);
    if (!row) return this.notFound();
    const text = note.trim();
    if (!text || text.length > NOTE_MAX_LENGTH) {
      return throwError(() => new ApiError('validation', 422, 'VALIDATION_ERROR'));
    }
    if (row.data.reconciliation !== 'WITH_DIFFERENCE') {
      return throwError(() => new ApiError('validation', 409, 'DESEMBOLSO_SIN_DIFERENCIA'));
    }
    row.data = {
      ...row.data,
      escalatedAt: new Date(),
      escalatedBy: DEMO_OPERATOR,
      escalationNote: text,
    };
    return of(row.data).pipe(delay(LATENCY_MS));
  }

  export(filters: DisbursementFilters, format: ExportFormat): Observable<Blob> {
    if (format === 'pdf') {
      return of(new Blob(['%PDF-1.4\n% reporte simulado'], { type: 'application/pdf' })).pipe(
        delay(LATENCY_MS),
      );
    }
    const header = 'Evento,Tipo de evento,Póliza,Monto,Conciliación';
    const lines = this.filtered(filters).map(
      (r) =>
        `${r.eventId},${r.eventType ?? ''},${r.policyId},${r.amount.amount},${r.reconciliation}`,
    );
    return of(new Blob(['﻿' + [header, ...lines].join('\n')], { type: 'text/csv' })).pipe(
      delay(LATENCY_MS),
    );
  }

  private find(id: string): DemoDisbursement | undefined {
    return this.rows.find((r) => r.data.id === id);
  }

  private notFound(): Observable<never> {
    return throwError(() => new ApiError('not-found', 404, 'DESEMBOLSO_NO_ENCONTRADO'));
  }

  /** Los mismos filtros que aplica el backend: fecha del pago (o del evento si aún no hay), tipo y conciliación. */
  private filtered(f: DisbursementFilters): Disbursement[] {
    const from = fromParam(f.from);
    const to = toParam(f.to);
    return this.rows
      .map((r) => r.data)
      .filter((r) => {
        const at = (r.paidAt ?? r.eventAt ?? new Date(NOW)).getTime();
        return (
          (!from || at >= new Date(from).getTime()) &&
          (!to || at <= new Date(to).getTime()) &&
          (!f.eventType || r.eventType === f.eventType) &&
          (f.reconciliation === 'ALL' || r.reconciliation === f.reconciliation)
        );
      })
      .sort(
        (a, b) => (b.paidAt ?? b.eventAt ?? 0).valueOf() - (a.paidAt ?? a.eventAt ?? 0).valueOf(),
      );
  }
}
