import {
  Component,
  DestroyRef,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiError } from '@core/http/api-error';
import { Observable } from 'rxjs';
import { CODE_LENGTH, RESEND_WAIT_SECONDS, normalizeCode } from './signature-rules';

export interface SignatureSubmission {
  readonly hash: string;
  readonly reviewed: boolean;
  readonly code: string;
}

/** Lo que cada pantalla le da al componente: la consola usa el JWT del asesor y la página pública, el enlace. */
export interface SignatureActions<R> {
  getPdf(): Observable<Blob>;
  requestCode(): Observable<void>;
  sign(submission: SignatureSubmission): Observable<R>;
}

/**
 * Los pasos de la firma (HU21, HU39): abrir el PDF, confirmar la revisión, pedir el código y firmar.
 * El código solo vive aquí mientras se escribe y se borra al enviarlo.
 */
@Component({
  selector: 'sol-signature-steps',
  imports: [FormsModule],
  templateUrl: './signature-steps.html',
  styleUrl: './signature-steps.scss',
})
export class SignatureSteps<R> {
  private readonly sanitizer = inject(DomSanitizer);

  readonly actions = input.required<SignatureActions<R>>();
  /** Hash del documento que se muestra; se devuelve al firmar para probar qué se firmó. */
  readonly hash = input<string | null>(null);
  /** Aumenta cuando el documento cambió: se debe volver a abrir y revisar. */
  readonly revision = input(0);
  /** En la consola el asesor acompaña al cliente; en la página pública, el cliente está solo. */
  readonly assisted = input(false, { transform: booleanAttribute });

  readonly started = output<void>();
  readonly signed = output<R>();
  /** Falló abrir el documento o pedir el código. */
  readonly failed = output<ApiError>();
  /** Falló la firma: la pantalla decide qué sigue. */
  readonly signFailed = output<ApiError>();

  private pdfObjectUrl: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private seenRevision = 0;

  protected readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  protected readonly openingPdf = signal(false);
  protected reviewed = false;
  protected readonly codeRequested = signal(false);
  protected readonly requestingCode = signal(false);
  protected readonly codeWait = signal(0);
  protected readonly code = signal('');
  protected readonly signing = signal(false);
  protected readonly codeComplete = computed(() => this.code().length === CODE_LENGTH);

  constructor() {
    effect(() => {
      const revision = this.revision();
      untracked(() => {
        if (revision !== this.seenRevision) this.askForNewReview();
        this.seenRevision = revision;
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.releasePdf();
      if (this.timer !== null) clearInterval(this.timer);
    });
  }

  protected openPdf(): void {
    if (this.openingPdf()) return;
    this.openingPdf.set(true);
    this.started.emit();
    this.actions()
      .getPdf()
      .subscribe({
        next: (blob) => {
          this.openingPdf.set(false);
          this.releasePdf();
          this.pdfObjectUrl = URL.createObjectURL(blob);
          this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfObjectUrl));
        },
        error: (e: unknown) => {
          this.openingPdf.set(false);
          this.failed.emit(this.toError(e));
        },
      });
  }

  protected requestCode(): void {
    if (this.requestingCode() || this.codeWait() > 0) return;
    this.requestingCode.set(true);
    this.started.emit();
    this.actions()
      .requestCode()
      .subscribe({
        next: () => {
          this.requestingCode.set(false);
          this.codeRequested.set(true);
          this.startWait();
        },
        error: (e: unknown) => {
          this.requestingCode.set(false);
          this.failed.emit(this.toError(e));
        },
      });
  }

  protected onCodeInput(event: Event): void {
    const field = event.target as HTMLInputElement;
    field.value = normalizeCode(field.value);
    this.code.set(field.value);
  }

  protected sign(): void {
    const hash = this.hash();
    const code = this.code();
    if (!hash || !this.codeComplete() || !this.reviewed || this.signing()) return;
    this.signing.set(true);
    this.started.emit();
    this.code.set('');
    this.actions()
      .sign({ hash, reviewed: true, code })
      .subscribe({
        next: (result) => {
          this.signing.set(false);
          this.signed.emit(result);
        },
        error: (e: unknown) => {
          this.signing.set(false);
          this.signFailed.emit(this.toError(e));
        },
      });
  }

  private askForNewReview(): void {
    this.reviewed = false;
    this.releasePdf();
    this.pdfUrl.set(null);
  }

  private startWait(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.codeWait.set(RESEND_WAIT_SECONDS);
    this.timer = setInterval(() => {
      this.codeWait.update((left) => left - 1);
      if (this.codeWait() <= 0 && this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 1000);
  }

  private releasePdf(): void {
    if (this.pdfObjectUrl) URL.revokeObjectURL(this.pdfObjectUrl);
    this.pdfObjectUrl = null;
  }

  private toError(e: unknown): ApiError {
    return e instanceof ApiError ? e : new ApiError('server', 500);
  }
}
