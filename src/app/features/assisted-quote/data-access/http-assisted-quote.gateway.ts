import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import { environment } from '@env/environment';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import {
  ClientIdentity,
  DocumentId,
  Product,
  ProfileSummary,
  Quote,
  QuoteRequest,
} from '../domain/models';
import { AssistedQuoteGateway } from './assisted-quote.gateway';
import { CatalogDto, ClientSearchDto, ProfileDto, QuoteDto } from './dto/assisted-quote.dto';
import {
  toCatalog,
  toClient,
  toProfile,
  toQuote,
  toQuoteRequestDto,
} from './mappers/assisted-quote.mapper';

const IDENTIDAD = `${environment.apiBaseUrl}/identidad`;
const COTIZACION = `${environment.apiBaseUrl}/cotizacion`;

/** Adaptador contra MS Identidad y MS Cotización a través del API Gateway. */
@Injectable()
export class HttpAssistedQuoteGateway extends AssistedQuoteGateway {
  private readonly http = inject(HttpClient);

  findClient(document: DocumentId): Observable<ClientIdentity | null> {
    const params = new HttpParams()
      .set('tipo_documento', document.type)
      .set('numero_documento', document.number);
    return this.http.get<ClientSearchDto>(`${IDENTIDAD}/v1/clientes/busqueda`, { params }).pipe(
      map(toClient),
      // Un documento que no existe no es un fallo: la pantalla ofrece cotizar sin cuenta.
      catchError((error: unknown) =>
        error instanceof ApiError && error.kind === 'not-found'
          ? of(null)
          : throwError(() => error),
      ),
    );
  }

  getProfile(clientId: string): Observable<ProfileSummary> {
    return this.http
      .get<ProfileDto>(`${COTIZACION}/v1/asesor/clientes/${encodeURIComponent(clientId)}/perfil`)
      .pipe(map(toProfile));
  }

  getCatalog(): Observable<readonly Product[]> {
    return this.http.get<CatalogDto>(`${COTIZACION}/v1/productos`).pipe(map(toCatalog));
  }

  requestQuote(request: QuoteRequest): Observable<Quote> {
    return this.http
      .post<QuoteDto>(`${COTIZACION}/v1/asesor/cotizaciones`, toQuoteRequestDto(request))
      .pipe(map(toQuote));
  }
}
