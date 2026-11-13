import { Observable } from 'rxjs';
import {
  DecisionRequest,
  InboxQuery,
  ProfileLevels,
  ReviewDetail,
  ReviewPage,
} from '../domain/models';

/**
 * Lo que la revisión asistida necesita de MS Suscripción (y del perfil de MS Cotización), en
 * términos de la feature. Los fallos llegan como `ApiError`: 409 `REVISION_YA_DECIDIDA` y
 * `COTIZACION_VENCIDA`, 422 `AJUSTE_INVALIDO`, 503 `COTIZACION_NO_DISPONIBLE`…
 */
export abstract class AssistedReviewGateway {
  abstract listReviews(query: InboxQuery): Observable<ReviewPage>;
  abstract getReview(id: string): Observable<ReviewDetail>;
  /** Niveles del perfil del cliente, nunca cifras (ADR-0008 §6). */
  abstract getProfile(clientId: string): Observable<ProfileLevels>;
  /** Devuelve el detalle ya decidido. */
  abstract decide(id: string, request: DecisionRequest): Observable<ReviewDetail>;
}
