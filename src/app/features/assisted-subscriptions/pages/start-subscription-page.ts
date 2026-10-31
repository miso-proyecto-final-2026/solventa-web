import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { describedBy } from '@shared/ui/form-field/form-field';
import { AssistedSubscriptionsGateway } from '../data-access/assisted-subscriptions.gateway';
import { startErrorMessage } from '../domain/labels';
import { PaymentFrequency } from '../domain/models';
import { isValidCardNumber, tokenizeSimulated } from '../domain/simulated-payment';

/**
 * HU39: el asesor inicia la suscripción de su cotización, con el cliente presente. El número de la
 * tarjeta lo digita el cliente y no sale del navegador: se convierte en un token y el campo se
 * limpia al enviar. Nunca se guarda en borradores ni en `sessionStorage`.
 */
@Component({
  selector: 'sol-start-subscription',
  imports: [Alert, Card, FormsModule, RouterLink],
  templateUrl: './start-subscription-page.html',
  styleUrl: './subscriptions.scss',
})
export class StartSubscriptionPage {
  private readonly gateway = inject(AssistedSubscriptionsGateway);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly quoteId = inject(ActivatedRoute).snapshot.paramMap.get('quoteId') ?? '';
  /**
   * Clave del inicio. Se conserva si la respuesta no llegó (red o servidor): volver a enviar repite
   * la misma saga en lugar de crear otro cobro.
   */
  private idempotencyKey: string | null = null;

  protected frequency: PaymentFrequency = 'ANUAL';
  protected card = '';
  protected accepted = false;

  protected readonly submitted = signal(false);
  protected readonly cardInvalid = signal(false);
  protected readonly acceptedMissing = signal(false);
  protected readonly starting = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly errorText = startErrorMessage;
  protected readonly describedBy = describedBy;

  constructor() {
    effect(() => {
      if (this.session.expired()) {
        void this.router.navigate(['/login'], {
          queryParams: { returnUrl: `/subscriptions/new/${this.quoteId}` },
        });
      }
    });
  }

  protected start(): void {
    if (this.starting()) return;
    this.submitted.set(true);
    this.cardInvalid.set(!isValidCardNumber(this.card));
    this.acceptedMissing.set(!this.accepted);
    if (this.cardInvalid() || this.acceptedMissing()) return;

    const paymentToken = tokenizeSimulated(this.card);
    this.card = '';
    this.submitted.set(false);
    this.starting.set(true);
    this.error.set(null);
    this.idempotencyKey ??= crypto.randomUUID();
    this.gateway
      .start(
        {
          quoteId: this.quoteId,
          paymentToken,
          frequency: this.frequency,
          termsAccepted: this.accepted,
        },
        this.idempotencyKey,
      )
      .subscribe({
        next: (id) => {
          this.starting.set(false);
          void this.router.navigate(['/subscriptions', id]);
        },
        error: (e: unknown) => {
          this.starting.set(false);
          const error = e instanceof ApiError ? e : new ApiError('server', 500);
          // Sin respuesta cierta se guarda la clave; con una respuesta del negocio, el próximo envío es otro.
          if (error.kind !== 'network' && error.kind !== 'server') this.idempotencyKey = null;
          this.error.set(error);
        },
      });
  }
}
