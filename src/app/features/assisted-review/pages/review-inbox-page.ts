import { CurrencyPipe, DatePipe, formatDate } from '@angular/common';
import { Component, ElementRef, LOCALE_ID, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { CURRENCY_DIGITS } from '@core/money/money';
import { productLabel } from '@shared/models/product-labels';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { AssistedReviewGateway } from '../data-access/assisted-review.gateway';
import {
  categoryLabel,
  decideErrorMessage,
  loadErrorMessage,
  priorityIcon,
  priorityLabel,
  stateLabel,
  decisionResultLabel,
} from '../domain/labels';
import {
  InboxQuery,
  JUSTIFICATION_MAX,
  JUSTIFICATION_MIN,
  ReviewCategory,
  ReviewPage,
  ReviewRow,
  ReviewState,
  justificationLength,
} from '../domain/models';

/**
 * HU16: bandeja de revisión asistida, los casos más antiguos primero (los ordena el backend). La
 * prioridad y la cotización vencida se marcan con icono y texto, no solo con color. Un caso con la
 * cotización vencida solo se puede cerrar: la acción rápida lo rechaza sin salir de la tabla.
 */
@Component({
  selector: 'sol-review-inbox',
  imports: [Alert, Card, CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './review-inbox-page.html',
  styleUrl: './assisted-review.scss',
})
export class ReviewInboxPage {
  private readonly gateway = inject(AssistedReviewGateway);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly locale = inject(LOCALE_ID);

  protected readonly query = signal<InboxQuery>({
    state: 'PENDING',
    category: null,
    mineOnly: false,
    expiredOnly: false,
    page: 1,
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly result = signal<ReviewPage | null>(null);

  /** El caso cuyo panel de cierre está abierto, con el texto sugerido (editable). */
  protected readonly closingId = signal<string | null>(null);
  protected closeText = '';
  protected readonly closing = signal(false);
  protected readonly closeError = signal<string | null>(null);
  /** Región viva: el resultado de cerrar un caso. */
  protected readonly announcement = signal<string | null>(null);

  protected readonly pages = computed(() => {
    const r = this.result();
    return r ? Math.max(1, Math.ceil(r.total / r.size)) : 1;
  });

  protected readonly stateOptions: readonly { value: ReviewState; label: string }[] = [
    { value: 'PENDING', label: $localize`:@@assistedReview.filter.pending:Pendientes` },
    { value: 'DECIDED', label: $localize`:@@assistedReview.filter.decided:Decididos` },
  ];
  protected readonly categoryOptions: readonly { value: ReviewCategory | ''; label: string }[] = [
    { value: '', label: $localize`:@@assistedReview.filter.all-categories:Todas` },
    ...(
      ['RISK_PROFILE_OUT_OF_RANGE', 'AMOUNT_OVER_LIMIT', 'INCOMPLETE_OR_INCONSISTENT_DATA'] as const
    ).map((value) => ({ value, label: categoryLabel(value) })),
  ];

  protected readonly digits = CURRENCY_DIGITS;
  protected readonly justificationMin = JUSTIFICATION_MIN;
  protected readonly justificationMax = JUSTIFICATION_MAX;
  protected readonly priorityText = priorityLabel;
  protected readonly priorityMark = priorityIcon;
  protected readonly categoryText = categoryLabel;
  protected readonly stateText = stateLabel;
  protected readonly resultText = decisionResultLabel;
  protected readonly errorText = loadErrorMessage;
  protected readonly productText = productLabel;
  protected readonly length = justificationLength;

  constructor() {
    effect(() => {
      if (this.session.expired()) {
        void this.router.navigate(['/login'], { queryParams: { returnUrl: '/assisted-review' } });
      }
    });
    this.load();
  }

  protected setState(state: ReviewState): void {
    this.update({ state, expiredOnly: state === 'PENDING' && this.query().expiredOnly });
  }

  protected setCategory(value: ReviewCategory | ''): void {
    this.update({ category: value || null });
  }

  protected setMineOnly(mineOnly: boolean): void {
    this.update({ mineOnly });
  }

  protected setExpiredOnly(expiredOnly: boolean): void {
    this.update({ expiredOnly, state: expiredOnly ? 'PENDING' : this.query().state });
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.pages() || this.loading()) return;
    this.query.update((q) => ({ ...q, page }));
    this.load();
  }

  private update(change: Partial<InboxQuery>): void {
    this.query.update((q) => ({ ...q, ...change, page: 1 }));
    this.closingId.set(null);
    this.load();
  }

  protected openClose(row: ReviewRow): void {
    const until = row.validUntil ? formatDate(row.validUntil, 'mediumDate', this.locale) : '';
    this.closeText = $localize`:@@assistedReview.close.suggested:La cotización venció el ${until}:until: antes de decidir; el cliente debe volver a cotizar.`;
    this.closeError.set(null);
    this.closingId.set(row.id);
  }

  /** El texto accesible de la insignia: lleva la fecha de vencimiento. */
  protected expiredLabel(row: ReviewRow): string {
    const until = row.validUntil ? formatDate(row.validUntil, 'medium', this.locale) : '';
    return $localize`:@@assistedReview.badge.expired-aria:Cotización vencida el ${until}:until:`;
  }

  protected cancelClose(): void {
    this.closingId.set(null);
  }

  protected confirmClose(row: ReviewRow): void {
    const justification = this.closeText.trim();
    if (this.closing()) return;
    if (justification.length < JUSTIFICATION_MIN || justification.length > JUSTIFICATION_MAX) {
      this.closeError.set(
        $localize`:@@assistedReview.close.error.length:La justificación debe tener entre ${JUSTIFICATION_MIN}:min: y ${JUSTIFICATION_MAX}:max: caracteres.`,
      );
      return;
    }
    const index = (this.result()?.items ?? []).findIndex((r) => r.id === row.id);
    this.closing.set(true);
    this.closeError.set(null);
    this.gateway
      .decide(row.id, { decision: 'REJECTED', justification, insuredAmount: null })
      .subscribe({
        next: () => {
          this.closing.set(false);
          this.closingId.set(null);
          this.announcement.set(
            $localize`:@@assistedReview.close.done:El caso se cerró por cotización vencida, sin cobro. Salió de los pendientes.`,
          );
          this.load(index);
        },
        error: (e: unknown) => {
          this.closing.set(false);
          const error = e instanceof ApiError ? e : new ApiError('server', 500);
          this.closeError.set(decideErrorMessage(error));
          // Otro asesor pudo decidirlo primero: el panel ya no aplica.
          if (error.code === 'REVISION_YA_DECIDIDA') {
            this.closingId.set(null);
            this.announcement.set(decideErrorMessage(error));
            this.load(index);
          }
        },
      });
  }

  /** Con `focusIndex`, al terminar la carga el foco pasa al caso que ocupa ese lugar (el siguiente). */
  protected load(focusIndex: number | null = null): void {
    this.loading.set(true);
    this.error.set(null);
    this.gateway.listReviews(this.query()).subscribe({
      next: (page) => {
        this.loading.set(false);
        this.result.set(page);
        if (focusIndex !== null) this.focusRow(focusIndex);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.result.set(null);
        this.error.set(e instanceof ApiError ? e : new ApiError('server', 500));
      },
    });
  }

  private focusRow(index: number): void {
    queueMicrotask(() => {
      const links = this.host.nativeElement.querySelectorAll<HTMLElement>('a.ar__open');
      const target = links[Math.min(index, links.length - 1)];
      (target ?? this.host.nativeElement.querySelector<HTMLElement>('#ar-announcement'))?.focus();
    });
  }
}
