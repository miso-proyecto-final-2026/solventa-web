import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, map } from 'rxjs';
import {
  AssistedSubscription,
  PAGE_SIZE,
  SignRequest,
  SignatureDocument,
  SignatureResult,
  StartRequest,
  SubscriptionPage,
  SubscriptionQuery,
} from '../domain/models';
import { AssistedSubscriptionsGateway } from './assisted-subscriptions.gateway';
import {
  AssistedSubscriptionDto,
  SignatureDocumentDto,
  SignatureDto,
  StartedSubscriptionDto,
  SubscriptionPageDto,
} from './dto/assisted-subscriptions.dto';
import {
  toSignBody,
  toSignatureDocument,
  toSignatureResult,
  toStartBody,
  toSubscription,
  toSubscriptionPage,
} from './mappers/assisted-subscriptions.mapper';

const SUBSCRIPTIONS = `${environment.apiBaseUrl}/suscripcion/v1/suscripciones/asistidas`;

/** El estado de la saga cambia en el servidor: nunca se sirve una copia vieja. */
const NO_CACHE = { 'Cache-Control': 'no-cache' };

/** Adaptador contra MS Suscripción a través del API Gateway, con el token del asesor. */
@Injectable()
export class HttpAssistedSubscriptionsGateway extends AssistedSubscriptionsGateway {
  private readonly http = inject(HttpClient);

  start(request: StartRequest, idempotencyKey: string): Observable<string> {
    return this.http
      .post<StartedSubscriptionDto>(SUBSCRIPTIONS, toStartBody(request), {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      .pipe(map((dto) => dto.id));
  }

  list(query: SubscriptionQuery): Observable<SubscriptionPage> {
    let params = new HttpParams().set('pagina', query.page).set('tamano', PAGE_SIZE);
    if (query.status !== 'ALL') params = params.set('estado', query.status);
    return this.http
      .get<SubscriptionPageDto>(SUBSCRIPTIONS, { params, headers: NO_CACHE })
      .pipe(map(toSubscriptionPage));
  }

  get(id: string): Observable<AssistedSubscription> {
    return this.http
      .get<AssistedSubscriptionDto>(this.url(id), { headers: NO_CACHE })
      .pipe(map(toSubscription));
  }

  getSignatureDocument(id: string): Observable<SignatureDocument> {
    return this.http
      .get<SignatureDocumentDto>(`${this.url(id)}/documento-firma`, { headers: NO_CACHE })
      .pipe(map(toSignatureDocument));
  }

  getSignaturePdf(id: string): Observable<Blob> {
    return this.http.get(`${this.url(id)}/documento-firma/pdf`, {
      responseType: 'blob',
      headers: NO_CACHE,
    });
  }

  requestCode(id: string): Observable<void> {
    return this.http.post<void>(`${this.url(id)}/firma/codigo`, null);
  }

  sign(id: string, request: SignRequest): Observable<SignatureResult> {
    return this.http
      .post<SignatureDto>(`${this.url(id)}/firma`, toSignBody(request), { observe: 'response' })
      .pipe(map((r) => toSignatureResult(r.body!, r.headers.get('Idempotent-Replay') === 'true')));
  }

  downloadSignedPolicy(id: string): Observable<Blob> {
    return this.http.get(`${this.url(id)}/firma/documento`, {
      responseType: 'blob',
      headers: NO_CACHE,
    });
  }

  private url(id: string): string {
    return `${SUBSCRIPTIONS}/${encodeURIComponent(id)}`;
  }
}
