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
import { FailedPaymentsGateway } from '../data-access/failed-payments.gateway';
import {
  caseStatusLabel,
  graceLabel,
  loadErrorMessage,
  noteErrorMessage,
  retryErrorMessage,
  retryResultKind,
  retryResultMessage,
} from '../domain/labels';
import { CaseDetail, NOTE_MAX_LENGTH, RetryResult } from '../domain/models';

/**
 * HU19: detalle de un cobro fallido. Muestra el historial de intentos con el motivo y el código
 * de la pasarela, permite reintentar con el método de pago registrado y dejar notas. No muestra
 * datos de contacto del cliente (ADR-0008) ni el token de la tarjeta.
 */
@Component({
  selector: 'sol-failed-payment-detail',
  imports: [Alert, Card, CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './case-detail-page.html',
  styleUrl: './failed-payments.scss',
})
export class CaseDetailPage {
  private readonly gateway = inject(FailedPaymentsGateway);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly caseId = inject(ActivatedRoute).snapshot.paramMap.get('caseId') ?? '';
  private readonly retryStatus = viewChild<ElementRef<HTMLElement>>('retryStatus');

  protected readonly detail = signal<CaseDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<ApiError | null>(null);

  protected readonly retrying = signal(false);
  protected readonly retryResult = signal<RetryResult | null>(null);
  protected readonly retryError = signal<ApiError | null>(null);
  /**
   * Clave del reintento en curso. Se conserva si la respuesta no llegó (red o servidor), así que
   * volver a pulsar repite el mismo reintento en lugar de cobrar otra vez.
   */
  private retryKey: string | null = null;

  protected noteText = '';
  protected readonly savingNote = signal(false);
  protected readonly noteError = signal<string | null>(null);
  protected readonly noteSaved = signal(false);

  protected readonly canRetry = computed(
    () => !!this.detail() && this.detail()!.status !== 'RECOVERED' && !this.retrying(),
  );

  protected readonly digits = CURRENCY_DIGITS;
  protected readonly maxLength = NOTE_MAX_LENGTH;
  protected readonly statusLabel = caseStatusLabel;
  protected readonly graceText = graceLabel;
  protected readonly loadErrorText = loadErrorMessage;
  protected readonly retryErrorText = retryErrorMessage;
  protected readonly retryText = retryResultMessage;
  protected readonly retryKind = retryResultKind;
  protected readonly describedBy = describedBy;

  constructor() {
    effect(() => {
      if (this.session.expired()) {
        void this.router.navigate(['/login'], {
          queryParams: { returnUrl: `/failed-payments/${this.caseId}` },
        });
      }
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.gateway.getCase(this.caseId).subscribe({
      next: (d) => {
        this.loading.set(false);
        this.detail.set(d);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.loadError.set(e instanceof ApiError ? e : new ApiError('server', 500));
      },
    });
  }

  protected retry(): void {
    if (!this.canRetry()) return;
    this.retrying.set(true);
    this.retryResult.set(null);
    this.retryError.set(null);
    this.retryKey ??= crypto.randomUUID();
    this.gateway.retry(this.caseId, this.retryKey).subscribe({
      next: (result) => {
        this.retrying.set(false);
        this.retryKey = null;
        this.retryResult.set(result);
        this.announceRetry();
        this.load();
      },
      error: (e: unknown) => {
        this.retrying.set(false);
        const error = e instanceof ApiError ? e : new ApiError('server', 500);
        // Sin respuesta cierta se guarda la clave; con una respuesta del negocio, el próximo clic es otro reintento.
        if (error.kind !== 'network' && error.kind !== 'server') this.retryKey = null;
        this.retryError.set(error);
        this.announceRetry();
        if (error.code === 'CASO_YA_RECUPERADO') this.load();
      },
    });
  }

  protected saveNote(): void {
    const text = this.noteText.trim();
    this.noteSaved.set(false);
    if (!text || text.length > NOTE_MAX_LENGTH) {
      this.noteError.set(noteErrorMessage(new ApiError('validation', 422)));
      return;
    }
    if (this.savingNote()) return;
    this.savingNote.set(true);
    this.noteError.set(null);
    this.gateway.addNote(this.caseId, text).subscribe({
      next: (note) => {
        this.savingNote.set(false);
        this.noteText = '';
        this.noteSaved.set(true);
        this.detail.update((d) => (d ? { ...d, notes: [...d.notes, note] } : d));
      },
      error: (e: unknown) => {
        this.savingNote.set(false);
        this.noteError.set(
          noteErrorMessage(e instanceof ApiError ? e : new ApiError('server', 500)),
        );
      },
    });
  }

  /** El resultado recibe el foco: quien usa teclado o lector de pantalla lo escucha enseguida. */
  private announceRetry(): void {
    queueMicrotask(() => this.retryStatus()?.nativeElement.focus());
  }
}
