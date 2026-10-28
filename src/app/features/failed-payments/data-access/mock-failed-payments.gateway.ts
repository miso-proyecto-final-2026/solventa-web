import { Injectable } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import { money } from '@core/money/money';
import { Observable, delay, of, throwError } from 'rxjs';
import {
  CaseDetail,
  CaseNote,
  CasePage,
  FailedPaymentCase,
  GraceStatus,
  InboxQuery,
  PAGE_SIZE,
  RetryResult,
} from '../domain/models';
import { FailedPaymentsGateway } from './failed-payments.gateway';

const LATENCY_MS = 150;
const HOUR_MS = 60 * 60 * 1000;
const DUE_SOON_MS = 24 * HOUR_MS;
/** Mismo criterio que el detector del backend: algo con forma de número de tarjeta. */
const LOOKS_LIKE_PAN = /(?:\d[ -]?){12,18}\d/;

interface DemoCase {
  detail: CaseDetail;
  /** Resultado del próximo reintento: así se ve cada mensaje sin backend. */
  readonly nextRetry: 'APPROVED' | 'DECLINED' | 'IN_PROGRESS';
  readonly keys: Map<string, RetryResult>;
}

function grace(until: Date, now: number): GraceStatus {
  const left = until.getTime() - now;
  if (left <= 0) return 'OVERDUE';
  return left < DUE_SOON_MS ? 'DUE_SOON' : 'CURRENT';
}

function demoCase(
  n: number,
  hoursLeft: number,
  reason: string,
  nextRetry: DemoCase['nextRetry'],
): DemoCase {
  const now = Date.now();
  const created = new Date(now - (72 - hoursLeft) * HOUR_MS);
  const graceUntil = new Date(now + hoursLeft * HOUR_MS);
  const id = `00000000-0000-4000-9000-00000000000${n}`;
  const amount = money(48_000 + n * 7_500);
  return {
    nextRetry,
    keys: new Map(),
    detail: {
      id,
      subscriptionId: `sus-demo-${n}`,
      clientId: `cli-demo-${n}`,
      status: hoursLeft <= 0 ? 'EXPIRED' : 'PENDING',
      amount,
      attempts: 1,
      lastAttemptAt: created,
      declineCode: 'FONDOS_INSUFICIENTES',
      declineReason: reason,
      graceUntil,
      grace: grace(graceUntil, now),
      card: { brand: n % 2 ? 'VISA' : 'MASTERCARD', last4: `42${n}${n}`.slice(0, 4) },
      retries: 0,
      operatorNotifiedAt: hoursLeft <= 0 ? graceUntil : null,
      resolvedAt: null,
      charges: [
        {
          transactionId: id,
          isRetry: false,
          status: 'RECHAZADA',
          amount,
          createdAt: created,
          attempts: [
            { number: 1, result: 'RECHAZADO', code: 'FONDOS_INSUFICIENTES', reason, at: created },
          ],
        },
      ],
      notes: [],
    },
  };
}

/** Adaptador simulado para desarrollo sin backend: tres cobros fallidos con distinta urgencia. */
@Injectable()
export class MockFailedPaymentsGateway extends FailedPaymentsGateway {
  private readonly cases: DemoCase[] = [
    demoCase(1, 6, 'Fondos insuficientes', 'APPROVED'),
    demoCase(2, 50, 'Tarjeta rechazada por el banco emisor', 'DECLINED'),
    demoCase(3, -2, 'Fondos insuficientes', 'IN_PROGRESS'),
  ];
  private nextNoteId = 1;

  listCases(query: InboxQuery): Observable<CasePage> {
    const items = this.cases
      .map((c) => c.detail)
      .filter((c) =>
        query.status === 'OPEN' ? c.status !== 'RECOVERED' : c.status === query.status,
      )
      .filter((c) => !query.dueSoonOnly || c.grace === 'DUE_SOON' || c.grace === 'OVERDUE')
      .sort((a, b) => a.graceUntil.getTime() - b.graceUntil.getTime());
    const start = (query.page - 1) * PAGE_SIZE;
    return of({
      items: items.slice(start, start + PAGE_SIZE) as FailedPaymentCase[],
      total: items.length,
      page: query.page,
      size: PAGE_SIZE,
    }).pipe(delay(LATENCY_MS));
  }

  getCase(caseId: string): Observable<CaseDetail> {
    const found = this.find(caseId);
    if (!found) return throwError(() => new ApiError('not-found', 404, 'CASO_NO_ENCONTRADO'));
    return of(found.detail).pipe(delay(LATENCY_MS));
  }

  addNote(caseId: string, text: string): Observable<CaseNote> {
    const found = this.find(caseId);
    if (!found) return throwError(() => new ApiError('not-found', 404, 'CASO_NO_ENCONTRADO'));
    if (LOOKS_LIKE_PAN.test(text)) {
      return throwError(() => new ApiError('validation', 422, 'DATO_DE_TARJETA_NO_PERMITIDO'));
    }
    const note: CaseNote = {
      id: this.nextNoteId++,
      authorName: 'Asesor Demo',
      authorRole: 'ASESOR',
      text,
      createdAt: new Date(),
    };
    found.detail = { ...found.detail, notes: [...found.detail.notes, note] };
    return of(note).pipe(delay(LATENCY_MS));
  }

  retry(caseId: string, idempotencyKey: string): Observable<RetryResult> {
    const found = this.find(caseId);
    if (!found) return throwError(() => new ApiError('not-found', 404, 'CASO_NO_ENCONTRADO'));
    const repeated = found.keys.get(idempotencyKey);
    if (repeated) return of({ ...repeated, replay: true }).pipe(delay(LATENCY_MS));
    if (found.detail.status === 'RECOVERED') {
      return throwError(() => new ApiError('validation', 409, 'CASO_YA_RECUPERADO'));
    }

    const d = found.detail;
    const outcome = found.nextRetry;
    const status = outcome === 'APPROVED' ? 'RECOVERED' : d.status;
    found.detail = {
      ...d,
      status,
      grace: status === 'RECOVERED' ? null : d.grace,
      attempts: d.attempts + 1,
      retries: d.retries + 1,
      lastAttemptAt: new Date(),
      resolvedAt: status === 'RECOVERED' ? new Date() : null,
    };
    const result: RetryResult = {
      outcome,
      gatewayDetail: outcome === 'IN_PROGRESS' ? 'NO_RESPONSE' : null,
      declineReason: outcome === 'DECLINED' ? d.declineReason : null,
      caseStatus: status,
      replay: false,
    };
    found.keys.set(idempotencyKey, result);
    return of(result).pipe(delay(LATENCY_MS));
  }

  private find(caseId: string): DemoCase | undefined {
    return this.cases.find((c) => c.detail.id === caseId);
  }
}
