import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, map } from 'rxjs';
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
import {
  DisbursementDetailDto,
  DisbursementDto,
  DisbursementPageDto,
  SummaryDto,
} from './dto/reconciliation.dto';
import {
  fromParam,
  toDisbursement,
  toDisbursementDetail,
  toDisbursementPage,
  toParam,
  toReconciliationParam,
  toSummary,
} from './mappers/reconciliation.mapper';
import { ReconciliationGateway } from './reconciliation.gateway';

const DISBURSEMENTS = `${environment.apiBaseUrl}/pagos/v1/pagos/conciliacion/desembolsos`;

/** Otro operador puede haber conciliado o escalado: nunca se sirve una copia vieja. */
const NO_CACHE = { 'Cache-Control': 'no-cache' };

/** Adaptador contra MS Pagos a través del API Gateway, con el token del operador. */
@Injectable()
export class HttpReconciliationGateway extends ReconciliationGateway {
  private readonly http = inject(HttpClient);

  list(query: DisbursementQuery): Observable<DisbursementPage> {
    const params = this.filters(query).set('pagina', query.page).set('tamano', PAGE_SIZE);
    return this.http
      .get<DisbursementPageDto>(DISBURSEMENTS, { params, headers: NO_CACHE })
      .pipe(map(toDisbursementPage));
  }

  summary(filters: DisbursementFilters): Observable<Summary> {
    return this.http
      .get<SummaryDto>(`${DISBURSEMENTS}/resumen`, {
        params: this.filters(filters),
        headers: NO_CACHE,
      })
      .pipe(map(toSummary));
  }

  get(id: string): Observable<DisbursementDetail> {
    return this.http
      .get<DisbursementDetailDto>(`${DISBURSEMENTS}/${encodeURIComponent(id)}`, {
        headers: NO_CACHE,
      })
      .pipe(map(toDisbursementDetail));
  }

  reconcile(id: string): Observable<Disbursement> {
    return this.http
      .post<DisbursementDto>(`${DISBURSEMENTS}/${encodeURIComponent(id)}/conciliar`, null)
      .pipe(map(toDisbursement));
  }

  escalate(id: string, note: string): Observable<Disbursement> {
    return this.http
      .post<DisbursementDto>(`${DISBURSEMENTS}/${encodeURIComponent(id)}/escalar`, { nota: note })
      .pipe(map(toDisbursement));
  }

  export(filters: DisbursementFilters, format: ExportFormat): Observable<Blob> {
    const params = this.filters(filters).set('formato', format);
    return this.http.get(`${DISBURSEMENTS}/exportar`, { params, responseType: 'blob' });
  }

  private filters(f: DisbursementFilters): HttpParams {
    let params = new HttpParams();
    const entries: [string, string | null][] = [
      ['desde', fromParam(f.from)],
      ['hasta', toParam(f.to)],
      ['tipo_evento', f.eventType || null],
      ['estado_conciliacion', toReconciliationParam(f.reconciliation)],
    ];
    for (const [name, value] of entries) if (value) params = params.set(name, value);
    return params;
  }
}
