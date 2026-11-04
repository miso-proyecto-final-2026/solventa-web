import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { describedBy } from '@shared/ui/form-field/form-field';
import { AssistedSubscriptionsGateway } from '../data-access/assisted-subscriptions.gateway';
import {
  ExpiryError,
  cvcLength,
  detectBrand,
  isValidCvc,
  validateExpiry,
} from '../domain/card-rules';
import { startErrorMessage } from '../domain/labels';
import { PaymentFrequency } from '../domain/models';
import { isValidCardNumber, tokenizeSimulated } from '../domain/simulated-payment';

/**
 * HU39: el asesor inicia la suscripción de su cotización, con el cliente presente. El número de la
 * tarjeta, el CVC y el vencimiento los digita el cliente y no salen del navegador: el número se
 * convierte en un token y los tres campos se limpian al enviar. CVC y vencimiento van enmascarados
 * (`type="password"`) para que el asesor no los lea. Nunca se guardan en borradores ni en
 * `sessionStorage`.
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
  protected readonly card = signal('');
  protected readonly cvc = signal('');
  protected readonly expiry = signal('');
  protected accepted = false;

  protected readonly submitted = signal(false);
  protected readonly brand = computed(() => detectBrand(this.card()));
  protected readonly cvcMax = computed(() => cvcLength(this.brand()));
  protected readonly cardInvalid = signal(false);
  protected readonly cvcInvalid = signal(false);
  protected readonly expiryError = signal<ExpiryError | null>(null);
  protected readonly acceptedMissing = signal(false);
  protected readonly starting = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly errorText = startErrorMessage;
  protected readonly describedBy = describedBy;
  protected readonly expiryErrorText = expiryErrorMessage;

  constructor() {
    effect(() => {
      if (this.session.expired()) {
        void this.router.navigate(['/login'], {
          queryParams: { returnUrl: `/subscriptions/new/${this.quoteId}` },
        });
      }
    });
  }

  /** Solo dígitos: evita letras pegadas y espacios en los campos enmascarados. */
  protected onlyDigits(value: string, max: number): string {
    return value.replace(/\D/g, '').slice(0, max);
  }

  /** Si cambia la franquicia (p. ej. a AMEX) se revalida el CVC ya escrito, sin borrarlo. */
  protected onCardChange(value: string): void {
    this.card.set(value);
    if (this.submitted() && this.cvc()) this.cvcInvalid.set(!isValidCvc(this.cvc(), this.brand()));
  }

  private clearSensitive(): void {
    this.card.set('');
    this.cvc.set('');
    this.expiry.set('');
  }

  protected start(): void {
    if (this.starting()) return;
    this.submitted.set(true);
    this.cardInvalid.set(!isValidCardNumber(this.card()));
    this.cvcInvalid.set(!isValidCvc(this.cvc(), this.brand()));
    this.expiryError.set(validateExpiry(this.expiry()));
    this.acceptedMissing.set(!this.accepted);
    if (this.cardInvalid() || this.cvcInvalid() || this.expiryError() || this.acceptedMissing())
      return;

    const paymentToken = tokenizeSimulated(this.card());
    this.clearSensitive();
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

function expiryErrorMessage(error: ExpiryError): string {
  switch (error) {
    case 'format':
      return $localize`:@@subscriptions.start.expiry-error-format:Escribe mes y año, por ejemplo 1128.`;
    case 'past':
      return $localize`:@@subscriptions.start.expiry-error-past:La tarjeta está vencida.`;
    case 'too-far':
      return $localize`:@@subscriptions.start.expiry-error-far:La fecha de vencimiento es demasiado lejana.`;
  }
}
