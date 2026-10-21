import { Observable } from 'rxjs';
import {
  ClientIdentity,
  DocumentId,
  Product,
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
}
