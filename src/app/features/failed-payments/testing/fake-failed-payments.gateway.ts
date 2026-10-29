import { ApiError } from '@core/http/api-error';
import { Observable, Subject, of, throwError } from 'rxjs';
import { FailedPaymentsGateway } from '../data-access/failed-payments.gateway';
import {
  CaseDetail,
  CaseNote,
  CasePage,
  FailedPaymentCase,
  InboxQuery,
  PAGE_SIZE,
  RetryResult,
} from '../domain/models';
import { CASE, DETAIL, DUE_SOON_CASE, NOTE, RETRY_APPROVED } from './fixtures';

/** Gateway de pruebas: responde al instante, registra las llamadas y puede fallar o quedarse esperando. */
export class FakeFailedPaymentsGateway extends FailedPaymentsGateway {
  cases: readonly FailedPaymentCase[] = [DUE_SOON_CASE, CASE];
  total: number | null = null;
  detail: CaseDetail = DETAIL;
  note: CaseNote = NOTE;
  retryResult: RetryResult = RETRY_APPROVED;
  /** Si se define, la llamada correspondiente falla con este error. */
  failList: ApiError | null = null;
  failDetail: ApiError | null = null;
  failNote: ApiError | null = null;
  failRetry: ApiError | null = null;
  /** Si se define, `retry` queda esperando hasta que se emita aquí (para probar el doble clic). */
  holdRetry: Subject<RetryResult> | null = null;
  /** Si se define, `listCases` queda esperando (para ver el estado de carga). */
  holdList: Subject<CasePage> | null = null;

  readonly queries: InboxQuery[] = [];
  readonly notes: { caseId: string; text: string }[] = [];
  readonly retries: { caseId: string; key: string }[] = [];
  detailCalls = 0;

  listCases(query: InboxQuery): Observable<CasePage> {
    this.queries.push(query);
    if (this.holdList) return this.holdList;
    if (this.failList) return throwError(() => this.failList);
    return of({
      items: this.cases,
      total: this.total ?? this.cases.length,
      page: query.page,
      size: PAGE_SIZE,
    });
  }

  getCase(): Observable<CaseDetail> {
    this.detailCalls++;
    return this.failDetail ? throwError(() => this.failDetail) : of(this.detail);
  }

  addNote(caseId: string, text: string): Observable<CaseNote> {
    this.notes.push({ caseId, text });
    return this.failNote ? throwError(() => this.failNote) : of({ ...this.note, text });
  }

  retry(caseId: string, key: string): Observable<RetryResult> {
    this.retries.push({ caseId, key });
    if (this.holdRetry) return this.holdRetry;
    return this.failRetry ? throwError(() => this.failRetry) : of(this.retryResult);
  }
}
