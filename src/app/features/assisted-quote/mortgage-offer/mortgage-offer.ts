import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiError } from '@core/http/api-error';
import { CURRENCY_DIGITS } from '@core/money/money';
import { Alert } from '@shared/ui/alert/alert';
import { describedBy, FormField } from '@shared/ui/form-field/form-field';
import { SourceLineage } from '../source-lineage/source-lineage';
import {
  coverageLabel,
  errorMessage,
  lifeStageLabel,
  offerStepLabel,
  productLabel,
} from '../domain/labels';
import { MortgageOffer } from '../domain/models';

type OfferTab = 'offer' | 'lineage';
const TABS: readonly OfferTab[] = ['offer', 'lineage'];

/** Qué explicar cuando la oferta no se pudo generar. */
type OfferProblem = 'no-consent' | 'unavailable' | 'other';

/**
 * HU26: oferta de vida hipotecario dentro del recorrido. Cotización la pide a Perfilamiento con el
 * perfil enriquecido y la registra como cotización; si el cliente acepta, la suscripción asistida
 * (HU39) arranca con ese `cotizacion_id`. El precio nunca se calcula en el navegador.
 */
@Component({
  selector: 'sol-mortgage-offer',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    Alert,
    FormField,
    SourceLineage,
  ],
  templateUrl: './mortgage-offer.html',
  styleUrl: './mortgage-offer.scss',
})
export class MortgageOfferPanel {
  readonly clientId = input.required<string>();
  readonly offer = input<MortgageOffer | null>(null);
  readonly busy = input(false);
  readonly error = input<ApiError | null>(null);

  readonly recalculate = output<number>();
  readonly retry = output<void>();
  readonly back = output<void>();

  protected readonly tab = signal<OfferTab>('offer');
  protected readonly lineageOpened = signal(false);
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  /** Pesos enteros, sin puntos: los límites los valida Perfilamiento con sus reglas. */
  protected readonly sum = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^[1-9]\d{0,10}$/)],
  });
  protected readonly submitted = signal(false);
  private readonly sumValue = signal('');

  /** El motivo que dio Perfilamiento para la suma (p. ej. sus límites). */
  protected readonly sumServerError = computed(
    () => this.error()?.fields.find((f) => f.field === 'suma_asegurada')?.reason ?? null,
  );
  protected readonly sumError = computed(() => {
    this.sumValue();
    if (this.submitted() && this.sum.invalid) {
      return $localize`:@@mortgageOffer.sum.invalid:Escribe la suma en pesos, sin puntos ni decimales.`;
    }
    return this.sumServerError();
  });
  protected readonly sumLabel = $localize`:@@mortgageOffer.sum.label:Suma asegurada (saldo del crédito)`;
  protected readonly sumHint = $localize`:@@mortgageOffer.sum.hint:Al cambiarla, la prima se recalcula con el mismo perfil del cliente.`;
  protected readonly describedBy = describedBy;

  protected readonly problem = computed<OfferProblem | null>(() => {
    const error = this.error();
    if (!error || this.sumServerError()) return null;
    if (error.code === 'CONSENTIMIENTO_REQUERIDO') return 'no-consent';
    if (['server', 'network', 'not-found'].includes(error.kind)) return 'unavailable';
    return 'other';
  });
  protected readonly otherMessage = computed(() => {
    const error = this.error();
    return error ? errorMessage(error) : '';
  });

  protected readonly digits = CURRENCY_DIGITS;
  protected readonly coverageLabel = coverageLabel;
  protected readonly productLabel = productLabel;
  protected readonly stageLabel = lifeStageLabel;
  protected readonly stepLabel = offerStepLabel;

  constructor() {
    // Cada oferta nueva deja en el campo la suma con la que se calculó.
    effect(() => {
      const offer = this.offer();
      if (offer) {
        this.sum.setValue(String(offer.insuredSum.amount));
        this.submitted.set(false);
      }
    });
    this.sum.valueChanges.subscribe((value) => this.sumValue.set(value));
  }

  protected submitSum(): void {
    this.submitted.set(true);
    if (this.sum.invalid || this.busy()) return;
    this.recalculate.emit(Number(this.sum.value));
  }

  protected select(tab: OfferTab): void {
    this.tab.set(tab);
    if (tab === 'lineage') this.lineageOpened.set(true);
  }

  /** Patrón de pestañas de WAI-ARIA: flechas, Inicio y Fin mueven la selección y el foco. */
  protected onTabKeydown(event: KeyboardEvent): void {
    const current = TABS.indexOf(this.tab());
    const next =
      event.key === 'ArrowRight'
        ? (current + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (current - 1 + TABS.length) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? TABS.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    this.select(TABS[next]);
    this.tabButtons()[next]?.nativeElement.focus();
  }
}
