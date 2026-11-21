import { Observable } from 'rxjs';
import {
  ClientIdentity,
  DocumentId,
  MortgageOffer,
  MortgageOfferRequest,
  Product,
  ProfileLineage,
  ProfileSummary,
  Quote,
  QuoteRequest,
} from '../domain/models';

/**
 * Lo que la cotización asistida necesita del backend, en términos de la feature. Errores de
 * red o del servidor llegan como `ApiError`; un documento sin cliente no es un error: `null`.
 */
export abstract class AssistedQuoteGateway {
  abstract findClient(document: DocumentId): Observable<ClientIdentity | null>;
  abstract getProfile(clientId: string): Observable<ProfileSummary>;
  abstract getCatalog(): Observable<readonly Product[]>;
  abstract requestQuote(request: QuoteRequest): Observable<Quote>;
  /** HU24: linaje del último perfil enriquecido; `null` si el cliente no tiene perfil enriquecido. */
  abstract getLineage(clientId: string): Observable<ProfileLineage | null>;
  /**
   * HU26: genera la oferta de vida hipotecario del cliente y la registra como cotización. Sin
   * consentimiento falla con el código `CONSENTIMIENTO_REQUERIDO`.
   */
  abstract requestMortgageOffer(request: MortgageOfferRequest): Observable<MortgageOffer>;
}
