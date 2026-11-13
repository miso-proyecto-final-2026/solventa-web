import { Observable } from 'rxjs';
import {
  Disbursement,
  DisbursementDetail,
  DisbursementFilters,
  DisbursementPage,
  DisbursementQuery,
  ExportFormat,
  Summary,
} from '../domain/models';

/**
 * Lo que la conciliación de desembolsos necesita de MS Pagos, en términos de la feature. Los
 * fallos llegan como `ApiError` (409 `EXTRACTO_SIN_PAGO`, 409 `DESEMBOLSO_SIN_DIFERENCIA`…).
 */
export abstract class ReconciliationGateway {
  abstract list(query: DisbursementQuery): Observable<DisbursementPage>;
  abstract summary(filters: DisbursementFilters): Observable<Summary>;
  abstract get(id: string): Observable<DisbursementDetail>;
  /** Compara con el extracto de la pasarela: queda conciliado o con diferencia, y quién lo hizo. */
  abstract reconcile(id: string): Observable<Disbursement>;
  /** Solo con diferencia y con una nota. */
  abstract escalate(id: string, note: string): Observable<Disbursement>;
  /** El reporte con los mismos filtros de la vista. */
  abstract export(filters: DisbursementFilters, format: ExportFormat): Observable<Blob>;
}
