import { Observable } from 'rxjs';
import {
  AssistedSubscription,
  SignRequest,
  SignatureDocument,
  SignatureLink,
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
  /** El certificado de cobertura, en el idioma de la consola. */
  /** Envía o reenvía el enlace de firma. Reenviarlo invalida el anterior. La entrega es asíncrona. */
  abstract sendSignatureLink(id: string): Observable<SignatureLink>;
  abstract getCertificate(id: string): Observable<Blob>;
  /** Pide otro correo de confirmación. La entrega es asíncrona: aceptar no significa que ya llegó. */
  abstract resendConfirmation(id: string): Observable<void>;
}
