import { CurrencyPipe, DatePipe, PercentPipe, formatDate } from '@angular/common';
import {
  Component,
  Injector,
  afterNextRender,
  ElementRef,
  LOCALE_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { CURRENCY_DIGITS } from '@core/money/money';
import { productLabel } from '@shared/models/product-labels';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { ErrorSummary } from '@shared/ui/error-summary/error-summary';
import { FormField, describedBy } from '@shared/ui/form-field/form-field';
import { AssistedReviewGateway } from '../data-access/assisted-review.gateway';
import {
  alreadyDecidedBy,
  categoryLabel,
  coverageLabel,
  decideErrorMessage,
  decisionConsequence,
  decisionLabel,
  decisionResultLabel,
  levelLabel,
  loadErrorMessage,
  priorityIcon,
  priorityLabel,
  profileSourceLabel,
  signalLabel,
} from '../domain/labels';
import {
  JUSTIFICATION_MAX,
  JUSTIFICATION_MIN,
  ProfileLevels,
  ReviewDecision,
  ReviewDetail,
  justificationLength,
} from '../domain/models';

const DECISIONS: readonly ReviewDecision[] = ['APPROVED', 'REJECTED', 'ADJUSTED'];

/**
 * HU16: detalle de un caso derivado y su decisión. Muestra el cliente (enmascarado), la
 * cotización, el perfil por niveles (nunca cifras, ADR-0008 §6) y el motivo. Solo ofrece las
 * decisiones que el backend permite: con la cotización vencida, solo rechazar.
 */
@Component({
  selector: 'sol-review-detail',
  imports: [
    Alert,
    Card,
    CurrencyPipe,
    DatePipe,
    ErrorSummary,
    FormField,
    FormsModule,
    PercentPipe,
    RouterLink,
  ],
  templateUrl: './review-detail-page.html',
  styleUrl: './assisted-review.scss',
})
export class ReviewDetailPage {
  private readonly gateway = inject(AssistedReviewGateway);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly reviewId = inject(ActivatedRoute).snapshot.paramMap.get('reviewId') ?? '';
  private readonly summary = viewChild(ErrorSummary);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly detail = signal<ReviewDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<ApiError | null>(null);
  protected readonly profile = signal<ProfileLevels | null>(null);
  protected readonly profileFailed = signal(false);

  protected readonly decision = signal<ReviewDecision | null>(null);
  protected readonly insuredAmount = signal('');
  protected readonly justification = signal('');
  protected readonly submitted = signal(false);
  protected readonly confirming = signal(false);
  protected readonly saving = signal(false);
  protected readonly decideError = signal<ApiError | null>(null);
  protected readonly decided = signal(false);
  /** Otro asesor decidió primero. */
  protected readonly lostRace = signal<{ advisor: string; decidedAt: Date | null } | null>(null);

  protected readonly allowed = computed(() => this.detail()?.allowedDecisions ?? []);
  protected readonly decisionOptions = DECISIONS.map((value) => ({
    value,
    label: decisionLabel(value),
  }));

  protected readonly decisionError = computed(() =>
    this.submitted() && !this.decision()
      ? $localize`:@@assistedReview.form.error.decision:Elige aprobar, rechazar o ajustar la cobertura.`
      : null,
  );
  protected readonly amountError = computed(() => this.amountProblem());
  protected readonly justificationError = computed(() => this.justificationProblem());
  protected readonly errors = computed(() => {
    if (!this.submitted()) return [];
    const list: { fieldId: string; message: string }[] = [];
    const d = this.decisionError();
    if (d) list.push({ fieldId: 'ar-decision-APPROVED', message: d });
    const a = this.amountError();
    if (a) list.push({ fieldId: 'ar-amount', message: a });
    const j = this.justificationError();
    if (j) list.push({ fieldId: 'ar-justification', message: j });
    return list;
  });

  protected readonly digits = CURRENCY_DIGITS;
  protected readonly justificationMin = JUSTIFICATION_MIN;
  protected readonly justificationMax = JUSTIFICATION_MAX;
  protected readonly priorityText = priorityLabel;
  protected readonly priorityMark = priorityIcon;
  protected readonly categoryText = categoryLabel;
  protected readonly coverageText = coverageLabel;
  protected readonly resultText = decisionResultLabel;
  protected readonly consequenceText = decisionConsequence;
  protected readonly levelText = levelLabel;
  protected readonly sourceText = profileSourceLabel;
  protected readonly signalText = signalLabel;
  protected readonly productText = productLabel;
  protected readonly loadErrorText = loadErrorMessage;
  protected readonly decideErrorText = decideErrorMessage;
  protected readonly describedBy = describedBy;
  protected readonly length = justificationLength;

  constructor() {
    effect(() => {
      if (this.session.expired()) {
        void this.router.navigate(['/login'], {
          queryParams: { returnUrl: `/assisted-review/${this.reviewId}` },
        });
      }
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.gateway.getReview(this.reviewId).subscribe({
      next: (d) => {
        this.loading.set(false);
        this.detail.set(d);
        if (!this.profile()) this.loadProfile(d.clientId);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.loadError.set(e instanceof ApiError ? e : new ApiError('server', 500));
      },
    });
  }

  private loadProfile(clientId: string): void {
    this.profileFailed.set(false);
    this.gateway.getProfile(clientId).subscribe({
      next: (p) => this.profile.set(p),
      // El perfil es un apoyo: sin él, el caso se puede decidir con el resto de la información.
      error: () => this.profileFailed.set(true),
    });
  }

  protected retryProfile(): void {
    const d = this.detail();
    if (d) this.loadProfile(d.clientId);
  }

  protected isAllowed(value: ReviewDecision): boolean {
    return this.allowed().includes(value);
  }

  protected choose(value: ReviewDecision): void {
    if (!this.isAllowed(value)) return;
    this.decision.set(value);
    this.confirming.set(false);
  }

  protected suggestedClosure(d: ReviewDetail): string {
    const until = d.quote.validUntil
      ? formatDate(d.quote.validUntil, 'mediumDate', this.locale)
      : '';
    return $localize`:@@assistedReview.close.suggested:La cotización venció el ${until}:until: antes de decidir; el cliente debe volver a cotizar.`;
  }

  /** El aviso de cotización vencida: deja listo el rechazo con la justificación sugerida, editable. */
  protected closeExpired(d: ReviewDetail): void {
    this.choose('REJECTED');
    this.justification.set(this.suggestedClosure(d));
    this.submitted.set(false);
    queueMicrotask(() =>
      this.host.nativeElement.querySelector<HTMLElement>('#ar-justification')?.focus(),
    );
  }

  private amountProblem(): string | null {
    if (!this.submitted() || this.decision() !== 'ADJUSTED') return null;
    const current = this.detail()?.quote.insuredAmount.amount ?? 0;
    const value = this.parsedAmount();
    if (value === null || value <= 0) {
      return $localize`:@@assistedReview.form.error.amount-required:Escribe el nuevo monto asegurado, un número entero mayor que cero.`;
    }
    if (value >= current) {
      return $localize`:@@assistedReview.form.error.amount-lower:El nuevo monto debe ser menor que el actual.`;
    }
    return null;
  }

  private justificationProblem(): string | null {
    if (!this.submitted()) return null;
    const n = justificationLength(this.justification());
    if (n < JUSTIFICATION_MIN) {
      return $localize`:@@assistedReview.form.error.justification-short:La justificación debe tener al menos ${JUSTIFICATION_MIN}:min: caracteres.`;
    }
    if (n > JUSTIFICATION_MAX) {
      return $localize`:@@assistedReview.form.error.justification-long:La justificación no puede pasar de ${JUSTIFICATION_MAX}:max: caracteres.`;
    }
    return null;
  }

  private parsedAmount(): number | null {
    const text = this.insuredAmount().replace(/[\s.,]/g, '');
    return /^\d+$/.test(text) ? Number(text) : null;
  }

  /** Valida y pasa al paso de confirmación en línea; el resumen de errores recibe el foco. */
  protected review(): void {
    this.submitted.set(true);
    this.decideError.set(null);
    if (this.errors().length > 0) {
      this.confirming.set(false);
      // El resumen se dibuja con este cambio: el foco va cuando ya está en pantalla.
      afterNextRender(() => this.summary()?.focus(), { injector: this.injector });
      return;
    }
    this.confirming.set(true);
  }

  protected cancelConfirm(): void {
    this.confirming.set(false);
  }

  protected confirm(): void {
    const decision = this.decision();
    if (!decision || this.saving() || !this.confirming()) return;
    this.saving.set(true);
    this.decideError.set(null);
    this.gateway
      .decide(this.reviewId, {
        decision,
        justification: this.justification(),
        insuredAmount: decision === 'ADJUSTED' ? this.parsedAmount() : null,
      })
      .subscribe({
        next: (d) => {
          this.saving.set(false);
          this.confirming.set(false);
          this.decided.set(true);
          this.detail.set(d);
        },
        error: (e: unknown) => {
          this.saving.set(false);
          this.confirming.set(false);
          const error = e instanceof ApiError ? e : new ApiError('server', 500);
          if (error.code === 'REVISION_YA_DECIDIDA') this.lostRace.set(alreadyDecidedBy(error));
          else this.decideError.set(error);
          // El estado cambió bajo los pies del asesor (otra decisión, o la cotización venció): se recarga.
          if (error.code === 'REVISION_YA_DECIDIDA' || error.code === 'COTIZACION_VENCIDA') {
            this.decision.set(null);
            this.load();
          }
        },
      });
  }
}
