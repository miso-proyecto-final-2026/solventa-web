import { Injectable } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import { money } from '@core/money/money';
import { Observable, delay, of, throwError } from 'rxjs';
import {
  AssistedSubscription,
  PAGE_SIZE,
  SagaStatus,
  SagaStep,
  SignRequest,
  SignatureDocument,
  SignatureResult,
  StartRequest,
  SubscriptionPage,
  SubscriptionQuery,
} from '../domain/models';
import { AssistedSubscriptionsGateway } from './assisted-subscriptions.gateway';

const LATENCY_MS = 150;
const HOUR_MS = 60 * 60 * 1000;
const STEPS: readonly SagaStep[] = ['DECISION', 'COBRO', 'FIRMA', 'EMISION'];
const DEMO_OTP = '123456';
const DEMO_HASH = 'a'.repeat(64);
const MAX_CODE_ATTEMPTS = 3;

function demo(n: number, status: SagaStatus, step: SagaStep): AssistedSubscription {
  const now = Date.now();
  const canManage = status === 'COBRO_REALIZADO';
  return {
    id: `00000000-0000-4000-9000-00000000010${n}`,
    quoteId: `cot-demo-${n}`,
    client: {
      name: 'Ana',
      lastNameInitial: 'P',
      documentType: 'CC',
      maskedDocument: `******30${n}`,
    },
    productCode: 'microseguro_vida',
    insuredAmount: money(40_000_000),
    paymentFrequency: 'ANUAL',
    status,
    step,
    steps: STEPS,
    decision: 'APROBADA',
    chargeStatus: 'APROBADO',
    chargeReason: null,
    signature: { status: 'PENDING', expiresAt: new Date(now + 20 * HOUR_MS) },
    compensation: null,
    policy: { number: `SOLV-DEMO-${n}`, status: 'PENDIENTE_FIRMA', documentStatus: 'GENERADO' },
    canManageSignature: canManage,
    createdAt: new Date(now - n * HOUR_MS),
  };
}

/** Adaptador simulado para desarrollo sin backend: el código de firma válido es `123456`. */
@Injectable()
export class MockAssistedSubscriptionsGateway extends AssistedSubscriptionsGateway {
  private subscriptions: AssistedSubscription[] = [
    demo(1, 'COBRO_REALIZADO', 'FIRMA'),
    {
      ...demo(2, 'COMPENSADA', 'FIRMA'),
      compensation: { status: 'COMPLETADA', reason: 'FIRMA_VENCIDA', requestedAt: new Date() },
    },
    demo(3, 'EMITIDA', 'EMISION'),
  ];
  private failedCodes = 0;
  private readonly keys = new Map<string, string>();

  start(request: StartRequest, idempotencyKey: string): Observable<string> {
    const repeated = this.keys.get(idempotencyKey);
    if (repeated) return of(repeated).pipe(delay(LATENCY_MS));
    const created: AssistedSubscription = {
      ...demo(1, 'COBRO_REALIZADO', 'FIRMA'),
      id: crypto.randomUUID(),
      quoteId: request.quoteId,
      paymentFrequency: request.frequency,
    };
    this.subscriptions = [created, ...this.subscriptions];
    this.keys.set(idempotencyKey, created.id);
    return of(created.id).pipe(delay(LATENCY_MS));
  }

  list(query: SubscriptionQuery): Observable<SubscriptionPage> {
    const items = this.subscriptions.filter(
      (s) => query.status === 'ALL' || s.status === query.status,
    );
    const start = (query.page - 1) * PAGE_SIZE;
    return of({
      items: items.slice(start, start + PAGE_SIZE),
      total: items.length,
      page: query.page,
      size: PAGE_SIZE,
    }).pipe(delay(LATENCY_MS));
  }

  get(id: string): Observable<AssistedSubscription> {
    const found = this.find(id);
    return found ? of(found).pipe(delay(LATENCY_MS)) : this.notFound();
  }

  getSignatureDocument(id: string): Observable<SignatureDocument> {
    const found = this.find(id);
    if (!found) return this.notFound();
    return of<SignatureDocument>({
      policyNumber: found.policy?.number ?? '',
      hash: DEMO_HASH,
      state: found.canManageSignature ? 'PENDING' : 'SIGNED',
      expiresAt: found.signature?.expiresAt ?? null,
    }).pipe(delay(LATENCY_MS));
  }

  getSignaturePdf(id: string): Observable<Blob> {
    return this.find(id) ? of(this.pdf()).pipe(delay(LATENCY_MS)) : this.notFound();
  }

  requestCode(id: string): Observable<void> {
    return this.find(id) ? of(undefined).pipe(delay(LATENCY_MS)) : this.notFound();
  }

  sign(id: string, request: SignRequest): Observable<SignatureResult> {
    const found = this.find(id);
    if (!found) return this.notFound();
    if (request.code !== DEMO_OTP) {
      this.failedCodes++;
      const left = MAX_CODE_ATTEMPTS - this.failedCodes;
      return left <= 0
        ? throwError(() => new ApiError('validation', 409, 'FIRMA_FALLIDA'))
        : throwError(
            () =>
              new ApiError('forbidden', 403, 'OTP_INVALIDO', [
                { field: 'codigo', reason: `intentos restantes: ${left}` },
              ]),
          );
    }
    this.subscriptions = this.subscriptions.map((s) =>
      s.id === id
        ? {
            ...s,
            status: 'EMITIDA',
            step: 'EMISION',
            canManageSignature: false,
            signature: { status: 'SIGNED', expiresAt: s.signature?.expiresAt ?? null },
            policy: s.policy && { ...s.policy, status: 'VIGENTE' },
          }
        : s,
    );
    return of<SignatureResult>({ status: 'EMITIDA', signedAt: new Date(), replay: false }).pipe(
      delay(LATENCY_MS),
    );
  }

  downloadSignedPolicy(id: string): Observable<Blob> {
    return this.find(id) ? of(this.pdf()).pipe(delay(LATENCY_MS)) : this.notFound();
  }

  private find(id: string): AssistedSubscription | undefined {
    return this.subscriptions.find((s) => s.id === id);
  }

  private notFound(): Observable<never> {
    return throwError(() => new ApiError('not-found', 404, 'SUSCRIPCION_NO_ENCONTRADA'));
  }

  private pdf(): Blob {
    return new Blob(['%PDF-1.4 demo'], { type: 'application/pdf' });
  }
}
