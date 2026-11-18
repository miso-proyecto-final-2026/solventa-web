import { ApiError } from '@core/http/api-error';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AssistedReviewGateway } from '../data-access/assisted-review.gateway';
import {
  DecisionRequest,
  InboxQuery,
  PAGE_SIZE,
  ProfileLevels,
  ReviewDetail,
  ReviewPage,
  ReviewRow,
} from '../domain/models';
import { DETAIL, EXPIRED_ROW, PROFILE, ROW } from './fixtures';

/** Gateway de pruebas: responde al instante, registra las llamadas y puede fallar o quedarse esperando. */
export class FakeAssistedReviewGateway extends AssistedReviewGateway {
  rows: readonly ReviewRow[] = [ROW, EXPIRED_ROW];
  total: number | null = null;
  expiredTotal: number | null = null;
  detail: ReviewDetail = DETAIL;
  /** Lo que `decide` devuelve; por defecto, el mismo detalle. */
  decided: ReviewDetail | null = null;
  profile: ProfileLevels = PROFILE;

  failList: ApiError | null = null;
  failDetail: ApiError | null = null;
  failProfile: ApiError | null = null;
  failDecide: ApiError | null = null;
  /** Si se define, `listReviews` queda esperando (para ver el estado de carga). */
  holdList: Subject<ReviewPage> | null = null;
  /** Si se define, `decide` queda esperando (para probar el doble clic). */
  holdDecide: Subject<ReviewDetail> | null = null;

  readonly queries: InboxQuery[] = [];
  readonly decisions: { id: string; request: DecisionRequest }[] = [];
  detailCalls = 0;

  listReviews(query: InboxQuery): Observable<ReviewPage> {
    this.queries.push(query);
    if (this.holdList) return this.holdList;
    if (this.failList) return throwError(() => this.failList);
    return of({
      items: this.rows,
      total: this.total ?? this.rows.length,
      expiredTotal: this.expiredTotal ?? this.rows.filter((r) => r.quoteExpired).length,
      page: query.page,
      size: PAGE_SIZE,
    });
  }

  getReview(): Observable<ReviewDetail> {
    this.detailCalls++;
    return this.failDetail ? throwError(() => this.failDetail) : of(this.detail);
  }

  getProfile(): Observable<ProfileLevels> {
    return this.failProfile ? throwError(() => this.failProfile) : of(this.profile);
  }

  decide(id: string, request: DecisionRequest): Observable<ReviewDetail> {
    this.decisions.push({ id, request });
    if (this.holdDecide) return this.holdDecide;
    if (this.failDecide) return throwError(() => this.failDecide);
    return of(this.decided ?? this.detail);
  }
}
