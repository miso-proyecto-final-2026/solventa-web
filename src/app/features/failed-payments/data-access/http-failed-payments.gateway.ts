import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, map } from 'rxjs';
import {
  CaseDetail,
  CaseNote,
  CasePage,
  InboxQuery,
  PAGE_SIZE,
  RetryResult,
} from '../domain/models';
import { CaseDetailDto, CasePageDto, NoteDto, RetryDto } from './dto/failed-payments.dto';
import { FailedPaymentsGateway } from './failed-payments.gateway';
import {
  toCaseDetail,
  toCasePage,
  toNote,
  toRetryResult,
  toStatusParam,
} from './mappers/failed-payments.mapper';

/** Único prefijo de MS Pagos publicado en el borde (enmienda del ADR-0014). */
const CASES = `${environment.apiBaseUrl}/pagos/v1/pagos/cobros-fallidos`;

/** Adaptador contra MS Pagos a través del API Gateway, con el token del asesor u operador. */
@Injectable()
export class HttpFailedPaymentsGateway extends FailedPaymentsGateway {
  private readonly http = inject(HttpClient);

  listCases(query: InboxQuery): Observable<CasePage> {
    let params = new HttpParams().set('pagina', query.page).set('tamano', PAGE_SIZE);
    const status = toStatusParam(query.status);
    if (status) params = params.set('estado', status);
    if (query.dueSoonOnly) params = params.set('por_vencer', true);
    return this.http
      .get<CasePageDto>(CASES, { params, headers: { 'Cache-Control': 'no-cache' } })
      .pipe(map(toCasePage));
  }

  getCase(caseId: string): Observable<CaseDetail> {
    return this.http
      .get<CaseDetailDto>(`${CASES}/${encodeURIComponent(caseId)}`, {
        // Otro asesor puede haber reintentado o anotado: nunca se sirve una copia vieja.
        headers: { 'Cache-Control': 'no-cache' },
      })
      .pipe(map(toCaseDetail));
  }

  addNote(caseId: string, text: string): Observable<CaseNote> {
    return this.http
      .post<NoteDto>(`${CASES}/${encodeURIComponent(caseId)}/notas`, { texto: text })
      .pipe(map(toNote));
  }

  retry(caseId: string, idempotencyKey: string): Observable<RetryResult> {
    return this.http
      .post<RetryDto>(`${CASES}/${encodeURIComponent(caseId)}/reintentar`, null, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      .pipe(map(toRetryResult));
  }
}
