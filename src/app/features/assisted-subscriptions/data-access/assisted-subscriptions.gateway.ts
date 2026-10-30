import { Observable } from 'rxjs';
import {
  AssistedSubscription,
  SignRequest,
  SignatureDocument,
  SignatureResult,
  StartRequest,
  SubscriptionPage,
  SubscriptionQuery,
} from '../domain/models';

/**
 * Lo que la venta asistida necesita de MS Suscripción, en términos de la feature. Los fallos llegan
 * como `ApiError` (403 `OTP_INVALIDO`, 409 `FIRMA_VENCIDA`, 409 `COTIZACION_SIN_CUENTA`…).
 */
export abstract class AssistedSubscriptionsGateway {
  /** La misma `idempotencyKey` devuelve la misma saga: dos clics no cobran dos veces. Devuelve su id. */
  abstract start(request: StartRequest, idempotencyKey: string): Observable<string>;
  abstract list(query: SubscriptionQuery): Observable<SubscriptionPage>;
  abstract get(id: string): Observable<AssistedSubscription>;
  abstract getSignatureDocument(id: string): Observable<SignatureDocument>;
  abstract getSignaturePdf(id: string): Observable<Blob>;
  abstract requestCode(id: string): Observable<void>;
  abstract sign(id: string, request: SignRequest): Observable<SignatureResult>;
  abstract downloadSignedPolicy(id: string): Observable<Blob>;
}
