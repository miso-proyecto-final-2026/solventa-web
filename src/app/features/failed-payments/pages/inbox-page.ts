import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { CURRENCY_DIGITS } from '@core/money/money';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { FailedPaymentsGateway } from '../data-access/failed-payments.gateway';
import { caseStatusLabel, graceLabel, loadErrorMessage } from '../domain/labels';
import { CasePage, InboxQuery, InboxStatusFilter } from '../domain/models';

/**
 * HU19: bandeja de cobros de prima rechazados, los más urgentes primero (los ordena el backend
 * por fin de la gracia). Los que vencen en menos de 24 h se resaltan con texto, no solo color.
 */
@Component({
  selector: 'sol-failed-payments-inbox',
  imports: [Alert, Card, CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './inbox-page.html',
  styleUrl: './failed-payments.scss',
})
export class InboxPage {
  private readonly gateway = inject(FailedPaymentsGateway);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  protected readonly query = signal<InboxQuery>({ status: 'OPEN', dueSoonOnly: false, page: 1 });
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly result = signal<CasePage | null>(null);

  protected readonly pages = computed(() => {
    const r = this.result();
    return r ? Math.max(1, Math.ceil(r.total / r.size)) : 1;
  });

  protected readonly statusOptions: readonly { value: InboxStatusFilter; label: string }[] = [
    { value: 'OPEN', label: $localize`:@@failedPayments.filter.open:Abiertos` },
    { value: 'PENDING', label: caseStatusLabel('PENDING') },
    { value: 'EXPIRED', label: caseStatusLabel('EXPIRED') },
    { value: 'RECOVERED', label: caseStatusLabel('RECOVERED') },
  ];

  protected readonly digits = CURRENCY_DIGITS;
  protected readonly statusLabel = caseStatusLabel;
  protected readonly graceText = graceLabel;
  protected readonly errorText = loadErrorMessage;

  constructor() {
    effect(() => {
      if (this.session.expired()) {
        void this.router.navigate(['/login'], { queryParams: { returnUrl: '/failed-payments' } });
      }
    });
    this.load();
  }

  protected setStatus(status: InboxStatusFilter): void {
    this.query.update((q) => ({ ...q, status, page: 1 }));
    this.load();
  }

  protected setDueSoonOnly(dueSoonOnly: boolean): void {
    this.query.update((q) => ({ ...q, dueSoonOnly, page: 1 }));
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
    this.gateway.listCases(this.query()).subscribe({
      next: (page) => {
        this.loading.set(false);
        this.result.set(page);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.result.set(null);
        this.error.set(e instanceof ApiError ? e : new ApiError('server', 500));
      },
    });
  }
}
