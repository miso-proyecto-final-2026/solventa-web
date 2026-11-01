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
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { CURRENCY_DIGITS } from '@core/money/money';
import { productLabel } from '@shared/models/product-labels';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { Stepper } from '@shared/ui/stepper/stepper';
import { AssistedSubscriptionsGateway } from '../data-access/assisted-subscriptions.gateway';
import {
  compensationMessage,
  downloadErrorMessage,
  loadErrorMessage,
  resendErrorMessage,
  sagaStatusLabel,
  signErrorMessage,
  stepLabel,
} from '../domain/labels';
import {
  AssistedSubscription,
  CODE_LENGTH,
  RESEND_WAIT_SECONDS,
  SignatureDocument,
  SignatureResult,
  canDownloadSigned,
  canGetCertificate,
  currentStepIndex,
  isAdvancing,
  normalizeCode,
} from '../domain/models';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

/**
 * HU39: el avance de la saga, sus compensaciones y la firma en pantalla con el cliente presente:
 * abrir el PDF, confirmar la revisión, pedir el código y firmar. Al firmarse, la póliza se emite sola,
 * el cliente recibe la confirmación por correo y el asesor puede ver el certificado y reenviar ese correo.
 */
@Component({
  selector: 'sol-subscription-detail',
  imports: [Alert, Card, CurrencyPipe, DatePipe, FormsModule, RouterLink, Stepper],
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
  private pdfObjectUrl: string | null = null;
  private certificateObjectUrl: string | null = null;
  private readonly countdowns = new Set<ReturnType<typeof setInterval>>();

  protected readonly subscription = signal<AssistedSubscription | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<ApiError | null>(null);

  protected readonly managing = signal(false);
  protected readonly document = signal<SignatureDocument | null>(null);
  protected readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  protected readonly openingPdf = signal(false);
  protected reviewed = false;
  protected readonly codeRequested = signal(false);
  protected readonly requestingCode = signal(false);
  protected readonly codeWait = signal(0);
  protected readonly code = signal('');
  protected readonly codeLength = CODE_LENGTH;
  protected readonly signing = signal(false);
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
      this.releasePdf();
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

  protected openPdf(): void {
    if (this.openingPdf()) return;
    this.openingPdf.set(true);
    this.signError.set(null);
    this.gateway.getSignaturePdf(this.id).subscribe({
      next: (blob) => {
        this.openingPdf.set(false);
        this.releasePdf();
        this.pdfObjectUrl = URL.createObjectURL(blob);
        this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfObjectUrl));
      },
      error: (e: unknown) => {
        this.openingPdf.set(false);
        this.failSign(e);
      },
    });
  }

  protected requestCode(): void {
    if (this.requestingCode()) return;
    this.requestingCode.set(true);
    this.signError.set(null);
    this.gateway.requestCode(this.id).subscribe({
      next: () => {
        this.requestingCode.set(false);
        this.codeRequested.set(true);
        this.startCountdown(this.codeWait);
      },
      error: (e: unknown) => {
        this.requestingCode.set(false);
        this.failSign(e);
      },
    });
  }

  protected onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = normalizeCode(input.value);
    this.code.set(input.value);
  }

  protected sign(): void {
    const d = this.document();
    const code = this.code();
    if (!d || code.length !== CODE_LENGTH || !this.reviewed || this.signing()) return;
    this.signing.set(true);
    this.signError.set(null);
    this.code.set('');
    this.gateway.sign(this.id, { hash: d.hash, reviewed: true, code }).subscribe({
      next: (result) => {
        this.signing.set(false);
        this.signResult.set(result);
        this.managing.set(false);
        this.announceResult();
        this.load();
      },
      error: (e: unknown) => {
        this.signing.set(false);
        this.failSign(e);
        const error = this.signError();
        if (error?.code === 'DOCUMENTO_ALTERADO') this.reloadDocument();
        // No se sabe si la firma llegó: se consulta antes de pedirle otro código al cliente.
        if (this.isConnectionError(error)) this.load();
      },
    });
  }

  /** El PDF cambió: hash nuevo y el cliente lo revisa de nuevo. No gastó ningún intento. */
  private reloadDocument(): void {
    this.reviewed = false;
    this.releasePdf();
    this.pdfUrl.set(null);
    this.gateway.getSignatureDocument(this.id).subscribe({
      next: (d) => this.document.set(d),
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

  private failSign(e: unknown): void {
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

  private releasePdf(): void {
    if (this.pdfObjectUrl) URL.revokeObjectURL(this.pdfObjectUrl);
    this.pdfObjectUrl = null;
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
