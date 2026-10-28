import { Observable } from 'rxjs';
import { CaseDetail, CaseNote, CasePage, InboxQuery, RetryResult } from '../domain/models';

/**
 * Lo que la gestión de cobros fallidos necesita de MS Pagos, en términos de la feature. Los
 * fallos llegan como `ApiError` (409 `CASO_YA_RECUPERADO`, 422 `DATO_DE_TARJETA_NO_PERMITIDO`…).
 */
export abstract class FailedPaymentsGateway {
  abstract listCases(query: InboxQuery): Observable<CasePage>;
  abstract getCase(caseId: string): Observable<CaseDetail>;
  abstract addNote(caseId: string, text: string): Observable<CaseNote>;
  /** La misma `idempotencyKey` devuelve el mismo reintento: dos clics no cobran dos veces. */
  abstract retry(caseId: string, idempotencyKey: string): Observable<RetryResult>;
}
