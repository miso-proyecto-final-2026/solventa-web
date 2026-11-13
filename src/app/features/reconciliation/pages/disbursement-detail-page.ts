import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { CURRENCY_DIGITS } from '@core/money/money';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { describedBy } from '@shared/ui/form-field/form-field';
import { ReconciliationGateway } from '../data-access/reconciliation.gateway';
import {
  escalateErrorMessage,
  eventTypeLabel,
  loadErrorMessage,
  magnitudeText,
  paymentStateLabel,
  reconcileErrorMessage,
  reconciliationLabel,
} from '../domain/labels';
import { DisbursementDetail, NOTE_MAX_LENGTH, canEscalate, isPaid } from '../domain/models';

/**
 * HU31: detalle de un desembolso con el evento, la póliza, la validación, el pago y los intentos. El operador lo
 * concilia contra la pasarela y, si el monto no coincidió, lo escala al equipo de pagos con una nota. No muestra
 * la cuenta de destino y el cliente llega enmascarado.
 */
@Component({
  selector: 'sol-disbursement-detail',
  imports: [Alert, Card, CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './disbursement-detail-page.html',
  styleUrl: './reconciliation.scss',
})
export class DisbursementDetailPage {
  private readonly gateway = inject(ReconciliationGateway);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('disbursementId') ?? '';
  private readonly resultBox = viewChild<ElementRef<HTMLElement>>('resultBox');

  protected readonly detail = signal<DisbursementDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<ApiError | null>(null);

  protected readonly reconciling = signal(false);
  /** Qué pasó con la última conciliación: igual al extracto o con diferencia. */
  protected readonly reconcileOutcome = signal<'RECONCILED' | 'WITH_DIFFERENCE' | null>(null);
  protected readonly reconcileError = signal<ApiError | null>(null);

  protected noteText = '';
  protected readonly escalating = signal(false);
  protected readonly noteError = signal<string | null>(null);
  protected readonly escalated = signal(false);

  protected readonly canReconcile = computed(() => {
    const d = this.detail();
    return !!d && isPaid(d) && !this.reconciling();
  });
  protected readonly canEscalate = computed(() => {
    const d = this.detail();
    return !!d && canEscalate(d);
  });

  protected readonly digits = CURRENCY_DIGITS;
  protected readonly maxLength = NOTE_MAX_LENGTH;
  protected readonly statusLabel = reconciliationLabel;
  protected readonly paymentLabel = paymentStateLabel;
  protected readonly typeLabel = eventTypeLabel;
  protected readonly magnitudeOf = magnitudeText;
  protected readonly loadErrorText = loadErrorMessage;
  protected readonly reconcileErrorText = reconcileErrorMessage;
  protected readonly describedBy = describedBy;

  constructor() {
    effect(() => {
      if (this.session.expired()) {
        void this.router.navigate(['/login'], {
          queryParams: { returnUrl: `/reconciliation/${this.id}` },
        });
      }
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.gateway.get(this.id).subscribe({
      next: (d) => {
        this.loading.set(false);
        this.detail.set(d);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.loadError.set(toApiError(e));
      },
    });
  }

  protected reconcile(): void {
    if (!this.canReconcile()) return;
    this.reconciling.set(true);
    this.reconcileOutcome.set(null);
    this.reconcileError.set(null);
    this.escalated.set(false);
    this.gateway.reconcile(this.id).subscribe({
      next: (updated) => {
        this.reconciling.set(false);
        // La respuesta trae el desembolso completo: se mezcla sin volver a pedir los intentos.
        this.detail.update((d) => (d ? { ...d, ...updated } : d));
        this.reconcileOutcome.set(
          updated.reconciliation === 'RECONCILED' ? 'RECONCILED' : 'WITH_DIFFERENCE',
        );
        this.announce();
      },
      error: (e: unknown) => {
        this.reconciling.set(false);
        this.reconcileError.set(toApiError(e));
        this.announce();
      },
    });
  }

  protected escalate(): void {
    const note = this.noteText.trim();
    this.escalated.set(false);
    if (!note || note.length > NOTE_MAX_LENGTH) {
      this.noteError.set(escalateErrorMessage(new ApiError('validation', 422)));
      return;
    }
    if (this.escalating()) return;
    this.escalating.set(true);
    this.noteError.set(null);
    this.gateway.escalate(this.id, note).subscribe({
      next: (updated) => {
        this.escalating.set(false);
        this.noteText = '';
        this.escalated.set(true);
        this.detail.update((d) => (d ? { ...d, ...updated } : d));
      },
      error: (e: unknown) => {
        this.escalating.set(false);
        this.noteError.set(escalateErrorMessage(toApiError(e)));
      },
    });
  }

  /** El resultado recibe el foco: quien usa teclado o lector de pantalla lo escucha enseguida. */
  private announce(): void {
    queueMicrotask(() => this.resultBox()?.nativeElement.focus());
  }
}

function toApiError(e: unknown): ApiError {
  return e instanceof ApiError ? e : new ApiError('server', 500);
}
