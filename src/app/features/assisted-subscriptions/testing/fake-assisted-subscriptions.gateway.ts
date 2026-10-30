import { ApiError } from '@core/http/api-error';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AssistedSubscriptionsGateway } from '../data-access/assisted-subscriptions.gateway';
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
import { DOCUMENT, ISSUED, SIGNED, SUBSCRIPTION } from './fixtures';

/** Gateway de pruebas: responde al instante, registra las llamadas y puede fallar o quedarse esperando. */
export class FakeAssistedSubscriptionsGateway extends AssistedSubscriptionsGateway {
  items: readonly AssistedSubscription[] = [SUBSCRIPTION, ISSUED];
  total: number | null = null;
  detail: AssistedSubscription = SUBSCRIPTION;
  document: SignatureDocument = DOCUMENT;
  signResult: SignatureResult = SIGNED;
  startedId = 'sus-nueva';
  failList: ApiError | null = null;
  failDetail: ApiError | null = null;
  failStart: ApiError | null = null;
  failDocument: ApiError | null = null;
  failPdf: ApiError | null = null;
  failCode: ApiError | null = null;
  failSign: ApiError | null = null;
  failDownload: ApiError | null = null;
  /** Si se define, `list` queda esperando (para ver el estado de carga). */
  holdList: Subject<SubscriptionPage> | null = null;
  /** Si se define, `start` queda esperando (para probar el doble clic). */
  holdStart: Subject<string> | null = null;

  readonly queries: SubscriptionQuery[] = [];
  readonly starts: { request: StartRequest; key: string }[] = [];
  readonly signs: { id: string; request: SignRequest }[] = [];
  detailCalls = 0;
  codeCalls = 0;
  downloads = 0;

  start(request: StartRequest, key: string): Observable<string> {
    this.starts.push({ request, key });
    if (this.holdStart) return this.holdStart;
    return this.failStart ? throwError(() => this.failStart) : of(this.startedId);
  }

  list(query: SubscriptionQuery): Observable<SubscriptionPage> {
    this.queries.push(query);
    if (this.holdList) return this.holdList;
    if (this.failList) return throwError(() => this.failList);
    return of({
      items: this.items,
      total: this.total ?? this.items.length,
      page: query.page,
      size: PAGE_SIZE,
    });
  }

  get(): Observable<AssistedSubscription> {
    this.detailCalls++;
    return this.failDetail ? throwError(() => this.failDetail) : of(this.detail);
  }

  getSignatureDocument(): Observable<SignatureDocument> {
    return this.failDocument ? throwError(() => this.failDocument) : of(this.document);
  }

  getSignaturePdf(): Observable<Blob> {
    return this.failPdf
      ? throwError(() => this.failPdf)
      : of(new Blob(['%PDF'], { type: 'application/pdf' }));
  }

  requestCode(): Observable<void> {
    this.codeCalls++;
    return this.failCode ? throwError(() => this.failCode) : of(undefined);
  }

  sign(id: string, request: SignRequest): Observable<SignatureResult> {
    this.signs.push({ id, request });
    return this.failSign ? throwError(() => this.failSign) : of(this.signResult);
  }

  downloadSignedPolicy(): Observable<Blob> {
    this.downloads++;
    return this.failDownload
      ? throwError(() => this.failDownload)
      : of(new Blob(['%PDF'], { type: 'application/pdf' }));
  }
}
