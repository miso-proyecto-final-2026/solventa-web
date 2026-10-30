import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { productLabel } from '@shared/models/product-labels';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { AssistedSubscriptionsGateway } from '../data-access/assisted-subscriptions.gateway';
import { loadErrorMessage, sagaStatusLabel, stepLabel } from '../domain/labels';
import { StatusFilter, SubscriptionPage, SubscriptionQuery } from '../domain/models';

/** HU39: las suscripciones de las cotizaciones del asesor, con el estado de la saga. */
@Component({
  selector: 'sol-subscription-list',
  imports: [Alert, Card, DatePipe, FormsModule, RouterLink],
  templateUrl: './subscription-list-page.html',
  styleUrl: './subscriptions.scss',
})
export class SubscriptionListPage {
  private readonly gateway = inject(AssistedSubscriptionsGateway);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  protected readonly query = signal<SubscriptionQuery>({ status: 'ALL', page: 1 });
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly result = signal<SubscriptionPage | null>(null);

  protected readonly pages = computed(() => {
    const r = this.result();
    return r ? Math.max(1, Math.ceil(r.total / r.size)) : 1;
  });

  protected readonly statusOptions: readonly { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: $localize`:@@subscriptions.filter.all:Todas` },
    ...(
      [
        'EN_PROGRESO',
        'APROBADA',
        'COBRO_REALIZADO',
        'FIRMADA',
        'EMITIDA',
        'RECHAZADA',
        'COMPENSADA',
      ] as const
    ).map((value) => ({ value, label: sagaStatusLabel(value) })),
  ];

  protected readonly statusLabel = sagaStatusLabel;
  protected readonly stepText = stepLabel;
  protected readonly productText = productLabel;
  protected readonly errorText = loadErrorMessage;

  constructor() {
    effect(() => {
      if (this.session.expired()) {
        void this.router.navigate(['/login'], { queryParams: { returnUrl: '/subscriptions' } });
      }
    });
    this.load();
  }

  protected setStatus(status: StatusFilter): void {
    this.query.set({ status, page: 1 });
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
    this.gateway.list(this.query()).subscribe({
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
