import { ApiError } from '@core/http/api-error';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AssistedQuoteGateway } from '../data-access/assisted-quote.gateway';
import {
  ClientIdentity,
  DocumentId,
  Product,
  ProfileSummary,
  Quote,
  QuoteRequest,
} from '../domain/models';
import { CATALOG, CLIENT, PROFILE, QUOTE } from './fixtures';

/** Gateway de pruebas: responde al instante, registra las llamadas y puede fallar o quedarse esperando. */
export class FakeAssistedQuoteGateway extends AssistedQuoteGateway {
  client: ClientIdentity | null = CLIENT;
  profile: ProfileSummary = PROFILE;
  catalog: readonly Product[] = CATALOG;
  quote: Quote = QUOTE;
  /** Si se define, la llamada correspondiente falla con este error. */
  failFind: ApiError | null = null;
  failQuote: ApiError | null = null;
  /** Si se define, `requestQuote` queda esperando hasta que se emita aquí (para probar el doble envío). */
  holdQuote: Subject<Quote> | null = null;

  readonly searched: DocumentId[] = [];
  readonly quoted: QuoteRequest[] = [];
  profileCalls = 0;
  catalogCalls = 0;

  findClient(document: DocumentId): Observable<ClientIdentity | null> {
    this.searched.push(document);
    return this.failFind ? throwError(() => this.failFind) : of(this.client);
  }

  getProfile(): Observable<ProfileSummary> {
    this.profileCalls++;
    return of(this.profile);
  }

  getCatalog(): Observable<readonly Product[]> {
    this.catalogCalls++;
    return of(this.catalog);
  }

  requestQuote(request: QuoteRequest): Observable<Quote> {
    this.quoted.push(request);
    if (this.holdQuote) return this.holdQuote;
    return this.failQuote ? throwError(() => this.failQuote) : of(this.quote);
  }
}
