import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, map } from 'rxjs';
import {
  DecisionRequest,
  InboxQuery,
  PAGE_SIZE,
  ProfileLevels,
  ReviewDetail,
  ReviewPage,
} from '../domain/models';
import { AssistedReviewGateway } from './assisted-review.gateway';
import { ProfileDto, ReviewDetailDto, ReviewPageDto } from './dto/assisted-review.dto';
import {
  toDecisionRequestDto,
  toListParams,
  toProfileLevels,
  toReviewDetail,
  toReviewPage,
} from './mappers/assisted-review.mapper';

const REVISIONES = `${environment.apiBaseUrl}/suscripcion/v1/suscripciones/revisiones`;
const COTIZACION = `${environment.apiBaseUrl}/cotizacion`;

/** Adaptador contra MS Suscripción a través del API Gateway, con el token del asesor. */
@Injectable()
export class HttpAssistedReviewGateway extends AssistedReviewGateway {
  private readonly http = inject(HttpClient);

  listReviews(query: InboxQuery): Observable<ReviewPage> {
    const params = new HttpParams({ fromObject: toListParams(query, PAGE_SIZE) });
    // Otro asesor puede haber decidido: nunca se sirve una copia vieja.
    return this.http
      .get<ReviewPageDto>(REVISIONES, { params, headers: { 'Cache-Control': 'no-cache' } })
      .pipe(map(toReviewPage));
  }

  getReview(id: string): Observable<ReviewDetail> {
    return this.http
      .get<ReviewDetailDto>(`${REVISIONES}/${encodeURIComponent(id)}`, {
        headers: { 'Cache-Control': 'no-cache' },
      })
      .pipe(map(toReviewDetail));
  }

  getProfile(clientId: string): Observable<ProfileLevels> {
    return this.http
      .get<ProfileDto>(`${COTIZACION}/v1/asesor/clientes/${encodeURIComponent(clientId)}/perfil`)
      .pipe(map(toProfileLevels));
  }

  decide(id: string, request: DecisionRequest): Observable<ReviewDetail> {
    return this.http
      .post<ReviewDetailDto>(
        `${REVISIONES}/${encodeURIComponent(id)}/decision`,
        toDecisionRequestDto(request),
      )
      .pipe(map(toReviewDetail));
  }
}
