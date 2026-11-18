import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { CURRENCY_DIGITS } from '@core/money/money';
import { FileSaver } from '@shared/download';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { ReconciliationGateway } from '../data-access/reconciliation.gateway';
import {
  eventTypeLabel,
  exportErrorMessage,
  loadErrorMessage,
  magnitudeText,
  paymentStateLabel,
  reconciliationLabel,
} from '../domain/labels';
import {
  DisbursementFilters,
  DisbursementPage,
  DisbursementQuery,
  EVENT_TYPES,
  ExportFormat,
  NO_FILTERS,
  filtersOf,
  ReconciliationStatus,
  Summary,
} from '../domain/models';

/**
 * HU31: los desembolsos de indemnizaciones con el evento, la póliza, la validación y el pago, para que
 * operaciones los concilie contra la pasarela. Filtra por fecha, tipo de evento y estado de
 * conciliación, muestra el resumen con la comprobación de pagos duplicados y exporta el reporte.
 * El cliente llega enmascarado y nunca se muestra la cuenta de destino.
 */
@Component({
  selector: 'sol-reconciliation',
  imports: [Alert, Card, CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './reconciliation-page.html',
  styleUrl: './reconciliation.scss',
})
export class ReconciliationPage {
  private readonly gateway = inject(ReconciliationGateway);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly files = inject(FileSaver);

  protected readonly query = signal<DisbursementQuery>({ ...NO_FILTERS, page: 1 });
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly result = signal<DisbursementPage | null>(null);
  protected readonly summary = signal<Summary | null>(null);

  protected readonly exporting = signal<ExportFormat | null>(null);
  protected readonly exportError = signal<ApiError | null>(null);
  protected readonly exported = signal<ExportFormat | null>(null);

  protected readonly pages = computed(() => {
    const r = this.result();
    return r ? Math.max(1, Math.ceil(r.total / r.size)) : 1;
  });
  protected readonly hasFilters = computed(() => {
    const q = this.query();
    return !!(q.from || q.to || q.eventType || q.reconciliation !== 'ALL');
  });

  protected readonly eventTypeOptions = EVENT_TYPES.map((value) => ({
    value,
    label: eventTypeLabel(value),
  }));
  protected readonly statusOptions: readonly {
    value: ReconciliationStatus | 'ALL';
    label: string;
  }[] = [
    { value: 'ALL', label: $localize`:@@reconciliation.filter.all:Todos` },
    { value: 'PENDING', label: reconciliationLabel('PENDING') },
    { value: 'RECONCILED', label: reconciliationLabel('RECONCILED') },
    { value: 'WITH_DIFFERENCE', label: reconciliationLabel('WITH_DIFFERENCE') },
  ];

  protected readonly digits = CURRENCY_DIGITS;
  protected readonly statusLabel = reconciliationLabel;
  protected readonly paymentLabel = paymentStateLabel;
  protected readonly typeLabel = eventTypeLabel;
  protected readonly magnitudeOf = magnitudeText;
  protected readonly errorText = loadErrorMessage;
  protected readonly exportErrorText = exportErrorMessage;

  constructor() {
    effect(() => {
      if (this.session.expired()) {
        void this.router.navigate(['/login'], { queryParams: { returnUrl: '/reconciliation' } });
      }
    });
    this.load();
  }

  protected setFilter<K extends keyof DisbursementFilters>(
    key: K,
    value: DisbursementFilters[K],
  ): void {
    this.query.update((q) => ({ ...q, [key]: value, page: 1 }));
    this.load();
  }

  protected clearFilters(): void {
    this.query.set({ ...NO_FILTERS, page: 1 });
    this.load();
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.pages() || this.loading()) return;
    this.query.update((q) => ({ ...q, page }));
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    const query = this.query();
    this.gateway.list(query).subscribe({
      next: (page) => {
        this.loading.set(false);
        this.result.set(page);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.result.set(null);
        this.error.set(toApiError(e));
      },
    });
    // El resumen sigue los mismos filtros; si falla, la lista se ve igual y el resumen no se muestra.
    this.gateway.summary(filtersOf(query)).subscribe({
      next: (s) => this.summary.set(s),
      error: () => this.summary.set(null),
    });
  }

  protected export(format: ExportFormat): void {
    if (this.exporting()) return;
    this.exporting.set(format);
    this.exportError.set(null);
    this.exported.set(null);
    this.gateway.export(filtersOf(this.query()), format).subscribe({
      next: (blob) => {
        this.exporting.set(null);
        this.files.save(blob, `conciliacion-desembolsos.${format}`);
        this.exported.set(format);
      },
      error: (e: unknown) => {
        this.exporting.set(null);
        this.exportError.set(toApiError(e));
      },
    });
  }

  protected badge(status: ReconciliationStatus): string {
    return status === 'RECONCILED'
      ? 'success'
      : status === 'WITH_DIFFERENCE'
        ? 'danger'
        : 'warning';
  }
}

function toApiError(e: unknown): ApiError {
  return e instanceof ApiError ? e : new ApiError('server', 500);
}
