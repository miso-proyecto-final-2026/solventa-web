import { ApiError } from '@core/http/api-error';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ReconciliationGateway } from '../data-access/reconciliation.gateway';
import {
  Disbursement,
  DisbursementDetail,
  DisbursementFilters,
  DisbursementPage,
  DisbursementQuery,
  ExportFormat,
  PAGE_SIZE,
  Summary,
} from '../domain/models';
import { DETAIL, PENDING, RECONCILED, SUMMARY, WITH_DIFFERENCE } from './fixtures';

/** Gateway de pruebas: responde al instante, registra las llamadas y puede fallar o quedarse esperando. */
export class FakeReconciliationGateway extends ReconciliationGateway {
  items: readonly Disbursement[] = [PENDING, RECONCILED, WITH_DIFFERENCE];
  total: number | null = null;
  summaryResult: Summary = SUMMARY;
  detail: DisbursementDetail = DETAIL;
  reconcileResult: Disbursement = { ...RECONCILED, id: PENDING.id };
  escalateResult: Disbursement = {
    ...WITH_DIFFERENCE,
    escalationNote: 'revisar',
    escalatedBy: 'op-1',
  };
  blob = new Blob(['x'], { type: 'text/csv' });
  /** Si se define, la llamada correspondiente falla con este error. */
  failList: ApiError | null = null;
  failSummary: ApiError | null = null;
  failDetail: ApiError | null = null;
  failReconcile: ApiError | null = null;
  failEscalate: ApiError | null = null;
  failExport: ApiError | null = null;
  /** Si se define, `list` queda esperando (para ver el estado de carga). */
  holdList: Subject<DisbursementPage> | null = null;
  holdExport: Subject<Blob> | null = null;

  readonly queries: DisbursementQuery[] = [];
  readonly summaryFilters: DisbursementFilters[] = [];
  readonly reconciled: string[] = [];
  readonly escalated: { id: string; note: string }[] = [];
  readonly exports: { filters: DisbursementFilters; format: ExportFormat }[] = [];
  detailCalls = 0;

  list(query: DisbursementQuery): Observable<DisbursementPage> {
    this.queries.push(query);
    if (this.holdList) return this.holdList;
    if (this.failList) return throwError(() => this.failList);
    return of({
      items: this.items,
      total: this.total ?? this.items.length,
      page: query.page,
      size: PAGE_SIZE,
    });
  }

  summary(filters: DisbursementFilters): Observable<Summary> {
    this.summaryFilters.push(filters);
    return this.failSummary ? throwError(() => this.failSummary) : of(this.summaryResult);
  }

  get(): Observable<DisbursementDetail> {
    this.detailCalls++;
    return this.failDetail ? throwError(() => this.failDetail) : of(this.detail);
  }

  reconcile(id: string): Observable<Disbursement> {
    this.reconciled.push(id);
    return this.failReconcile ? throwError(() => this.failReconcile) : of(this.reconcileResult);
  }

  escalate(id: string, note: string): Observable<Disbursement> {
    this.escalated.push({ id, note });
    return this.failEscalate ? throwError(() => this.failEscalate) : of(this.escalateResult);
  }

  export(filters: DisbursementFilters, format: ExportFormat): Observable<Blob> {
    this.exports.push({ filters, format });
    if (this.holdExport) return this.holdExport;
    return this.failExport ? throwError(() => this.failExport) : of(this.blob);
  }
}
