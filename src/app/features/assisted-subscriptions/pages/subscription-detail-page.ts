import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { CURRENCY_DIGITS } from '@core/money/money';
import { productLabel } from '@shared/models/product-labels';
import { RESEND_WAIT_SECONDS } from '@shared/signature/signature-rules';
import { SignatureActions, SignatureSteps } from '@shared/signature/signature-steps';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { Stepper } from '@shared/ui/stepper/stepper';
import { AssistedSubscriptionsGateway } from '../data-access/assisted-subscriptions.gateway';
import {
  compensationMessage,
  downloadErrorMessage,
  linkErrorMessage,
  loadErrorMessage,
  resendErrorMessage,
  sagaStatusLabel,
  signErrorMessage,
  stepLabel,
} from '../domain/labels';
import {
  AssistedSubscription,
  SignatureDocument,
  SignatureResult,
  canDownloadSigned,
  canGetCertificate,
  currentStepIndex,
  isAdvancing,
} from '../domain/models';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

/**
 * HU39: el avance de la saga, sus compensaciones y la firma en pantalla con el cliente presente:
 * abrir el PDF, confirmar la revisión, pedir el código y firmar; o el envío del enlace por correo para
 * que firme el cliente. Al firmarse, la póliza se emite sola,
 * el cliente recibe la confirmación por correo y el asesor puede ver el certificado y reenviar ese correo.
 */
@Component({
  selector: 'sol-subscription-detail',
  imports: [Alert, Card, CurrencyPipe, DatePipe, RouterLink, SignatureSteps, Stepper],
  templateUrl: './subscription-detail-page.html',
  styleUrl: './subscriptions.scss',
})
export class SubscriptionDetailPage {
  private readonly gateway = inject(AssistedSubscriptionsGateway);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  private readonly resultFocus = viewChild<ElementRef<HTMLElement>>('signStatus');

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private polls = 0;
  private certificateObjectUrl: string | null = null;
  private readonly countdowns = new Set<ReturnType<typeof setInterval>>();

  protected readonly subscription = signal<AssistedSubscription | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<ApiError | null>(null);

  protected readonly managing = signal(false);
  protected readonly document = signal<SignatureDocument | null>(null);
  protected readonly documentRevision = signal(0);
  protected readonly sendingLink = signal(false);
  protected readonly linkWait = signal(0);
  protected readonly confirmingLink = signal(false);
  protected readonly linkError = signal<ApiError | null>(null);
  protected readonly signError = signal<ApiError | null>(null);
  protected readonly signResult = signal<SignatureResult | null>(null);
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<ApiError | null>(null);
  protected readonly certificateUrl = signal<SafeResourceUrl | null>(null);
  protected readonly openingCertificate = signal(false);
  protected readonly downloadingCertificate = signal(false);
  protected readonly certificateError = signal<ApiError | null>(null);
  protected readonly resending = signal(false);
  protected readonly resendWait = signal(0);
  protected readonly resendDone = signal(false);
  protected readonly resendError = signal<ApiError | null>(null);

  protected readonly stepNames = computed(() =>
    (this.subscription()?.steps ?? []).map((s) => stepLabel(s)),
  );
  protected readonly currentStep = computed(() => {
    const s = this.subscription();
    return s ? currentStepIndex(s) : 0;
  });
  protected readonly canDownload = computed(() => {
    const s = this.subscription();
    return !!s && canDownloadSigned(s);
  });
  protected readonly hasCertificate = computed(() => {
    const s = this.subscription();
    return !!s && canGetCertificate(s);
  });

  protected readonly digits = CURRENCY_DIGITS;
  protected readonly statusLabel = sagaStatusLabel;
  protected readonly productText = productLabel;
  protected readonly loadErrorText = loadErrorMessage;
  protected readonly signErrorText = signErrorMessage;
  protected readonly downloadErrorText = downloadErrorMessage;
  protected readonly resendErrorText = resendErrorMessage;
  protected readonly linkErrorText = linkErrorMessage;
  protected readonly signatureActions: SignatureActions<SignatureResult> = {
    getPdf: () => this.gateway.getSignaturePdf(this.id),
    requestCode: () => this.gateway.requestCode(this.id),
    sign: (submission) => this.gateway.sign(this.id, submission),
  };
  protected readonly compensationText = compensationMessage;
  protected readonly stepperLabel = $localize`:@@subscriptions.detail.stepper:Avance de la suscripción`;
  protected readonly doneLabel = $localize`:@@subscriptions.detail.step-done:Completado`;

  constructor() {
    effect(() => {
      if (this.session.expired()) {
        void this.router.navigate(['/login'], {
          queryParams: { returnUrl: `/subscriptions/${this.id}` },
        });
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.stopPolling();
      this.releaseCertificate();
      this.countdowns.forEach((timer) => clearInterval(timer));
    });
    this.load();
  }

  protected load(): void {
    this.stopPolling();
    this.loading.set(true);
    this.loadError.set(null);
    this.gateway.get(this.id).subscribe({
      next: (s) => {
        this.loading.set(false);
        this.subscription.set(s);
        if (!s.canManageSignature) {
          this.managing.set(false);
          // Se perdió la respuesta al firmar, pero la firma sí quedó: la pantalla ya muestra cómo terminó.
          if (this.isConnectionError(this.signError()) && canDownloadSigned(s)) {
            this.signError.set(null);
          }
        }
        this.schedulePoll(s);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.loadError.set(e instanceof ApiError ? e : new ApiError('server', 500));
      },
    });
  }

  protected manage(): void {
    this.managing.set(true);
    this.signError.set(null);
    this.gateway.getSignatureDocument(this.id).subscribe({
      next: (d) => this.document.set(d),
      error: (e: unknown) => this.failSign(e),
    });
  }

  protected onSigned(result: SignatureResult): void {
    this.signResult.set(result);
    this.managing.set(false);
    this.announceResult();
    this.load();
  }

  protected onSignFailed(error: ApiError): void {
    this.failSign(error);
    if (error.code === 'DOCUMENTO_ALTERADO') this.reloadDocument();
    // No se sabe si la firma llegó: se consulta antes de pedirle otro código al cliente.
    if (this.isConnectionError(error)) this.load();
  }

  /** Con un enlace activo, enviar otro invalida el anterior: se pide confirmar. */
  protected sendLink(): void {
    if (this.sendingLink() || this.linkWait() > 0) return;
    if (this.subscription()?.signatureLink?.status === 'ACTIVO' && !this.confirmingLink()) {
      this.confirmingLink.set(true);
      return;
    }
    this.confirmingLink.set(false);
    this.sendingLink.set(true);
    this.linkError.set(null);
    this.gateway.sendSignatureLink(this.id).subscribe({
      next: () => {
        this.sendingLink.set(false);
        this.startCountdown(this.linkWait);
        this.load();
      },
      error: (e: unknown) => {
        this.sendingLink.set(false);
        const error = e instanceof ApiError ? e : new ApiError('server', 500);
        this.linkError.set(error);
        if (error.code === 'CORREO_MUY_SEGUIDO') this.startCountdown(this.linkWait);
        if (error.code === 'FIRMA_NO_DISPONIBLE') this.load();
      },
    });
  }

  /** El PDF cambió: hash nuevo y el cliente lo revisa de nuevo. No gastó ningún intento. */
  private reloadDocument(): void {
    this.gateway.getSignatureDocument(this.id).subscribe({
      next: (d) => {
        this.document.set(d);
        this.documentRevision.update((r) => r + 1);
      },
      error: (e: unknown) => this.failSign(e),
    });
  }

  protected downloadSigned(): void {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.downloadError.set(null);
    this.gateway.downloadSignedPolicy(this.id).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        this.saveFile(blob, `poliza-${this.subscription()?.policy?.number ?? this.id}-firmada.pdf`);
      },
      error: (e: unknown) => {
        this.downloading.set(false);
        this.downloadError.set(e instanceof ApiError ? e : new ApiError('server', 500));
      },
    });
  }

  protected openCertificate(): void {
    if (this.openingCertificate()) return;
    this.openingCertificate.set(true);
    this.certificateError.set(null);
    this.gateway.getCertificate(this.id).subscribe({
      next: (blob) => {
        this.openingCertificate.set(false);
        this.releaseCertificate();
        this.certificateObjectUrl = URL.createObjectURL(blob);
        this.certificateUrl.set(
          this.sanitizer.bypassSecurityTrustResourceUrl(this.certificateObjectUrl),
        );
      },
      error: (e: unknown) => {
        this.openingCertificate.set(false);
        this.certificateError.set(e instanceof ApiError ? e : new ApiError('server', 500));
      },
    });
  }

  protected downloadCertificate(): void {
    if (this.downloadingCertificate()) return;
    this.downloadingCertificate.set(true);
    this.certificateError.set(null);
    this.gateway.getCertificate(this.id).subscribe({
      next: (blob) => {
        this.downloadingCertificate.set(false);
        this.saveFile(blob, `certificado-${this.subscription()?.policy?.number ?? this.id}.pdf`);
      },
      error: (e: unknown) => {
        this.downloadingCertificate.set(false);
        this.certificateError.set(e instanceof ApiError ? e : new ApiError('server', 500));
      },
    });
  }

  protected resendConfirmation(): void {
    if (this.resending() || this.resendWait() > 0) return;
    this.resending.set(true);
    this.resendDone.set(false);
    this.resendError.set(null);
    this.gateway.resendConfirmation(this.id).subscribe({
      next: () => {
        this.resending.set(false);
        this.resendDone.set(true);
        this.startCountdown(this.resendWait);
      },
      error: (e: unknown) => {
        this.resending.set(false);
        const error = e instanceof ApiError ? e : new ApiError('server', 500);
        this.resendError.set(error);
        if (error.code === 'CORREO_MUY_SEGUIDO') this.startCountdown(this.resendWait);
      },
    });
  }

  private isConnectionError(error: ApiError | null): boolean {
    return error?.kind === 'network' || error?.kind === 'server';
  }

  private startCountdown(seconds: WritableSignal<number>): void {
    seconds.set(RESEND_WAIT_SECONDS);
    const timer = setInterval(() => {
      seconds.update((left) => left - 1);
      if (seconds() <= 0) {
        clearInterval(timer);
        this.countdowns.delete(timer);
      }
    }, 1000);
    this.countdowns.add(timer);
  }

  protected failSign(e: unknown): void {
    const error = e instanceof ApiError ? e : new ApiError('server', 500);
    this.signError.set(error);
    this.announceResult();
    // La firma se cerró o cambió de estado: se muestra cómo quedó la saga.
    if (error.code === 'FIRMA_VENCIDA' || error.code === 'FIRMA_FALLIDA') this.load();
    if (error.code === 'FIRMA_NO_DISPONIBLE') this.load();
  }

  private schedulePoll(s: AssistedSubscription): void {
    if (!isAdvancing(s) || this.polls >= MAX_POLLS) return;
    this.polls++;
    this.pollTimer = setTimeout(() => this.load(), POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  private releaseCertificate(): void {
    if (this.certificateObjectUrl) URL.revokeObjectURL(this.certificateObjectUrl);
    this.certificateObjectUrl = null;
  }

  private saveFile(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** El resultado recibe el foco: quien usa teclado o lector de pantalla lo escucha enseguida. */
  private announceResult(): void {
    queueMicrotask(() => this.resultFocus()?.nativeElement.focus());
  }
}
