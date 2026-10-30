import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
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
  sagaStatusLabel,
  signErrorMessage,
  stepLabel,
} from '../domain/labels';
import {
  AssistedSubscription,
  SignatureDocument,
  SignatureResult,
  canDownloadSigned,
  currentStepIndex,
  isAdvancing,
} from '../domain/models';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

/**
 * HU39: el avance de la saga, sus compensaciones y la firma en pantalla con el cliente presente:
 * abrir el PDF, confirmar la revisión, pedir el código y firmar. Al firmarse, la póliza se emite sola.
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
  protected code = '';
  protected readonly signing = signal(false);
  protected readonly signError = signal<ApiError | null>(null);
  protected readonly signResult = signal<SignatureResult | null>(null);
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<ApiError | null>(null);

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

  protected readonly digits = CURRENCY_DIGITS;
  protected readonly statusLabel = sagaStatusLabel;
  protected readonly productText = productLabel;
  protected readonly loadErrorText = loadErrorMessage;
  protected readonly signErrorText = signErrorMessage;
  protected readonly downloadErrorText = downloadErrorMessage;
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
        if (!s.canManageSignature) this.managing.set(false);
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
      },
      error: (e: unknown) => {
        this.requestingCode.set(false);
        this.failSign(e);
      },
    });
  }

  protected sign(): void {
    const d = this.document();
    const code = this.code.trim();
    if (!d || !code || !this.reviewed || this.signing()) return;
    this.signing.set(true);
    this.signError.set(null);
    this.code = '';
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
      },
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
