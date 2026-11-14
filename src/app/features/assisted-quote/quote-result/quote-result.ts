import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, ElementRef, input, output, signal, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CURRENCY_DIGITS } from '@core/money/money';
import { Alert } from '@shared/ui/alert/alert';
import { PriceBreakdown } from '../price-breakdown/price-breakdown';
import { SourceLineage } from '../source-lineage/source-lineage';
import { coverageLabel, productLabel } from '../domain/labels';
import { Quote } from '../domain/models';

type ResultTab = 'quote' | 'lineage';
const TABS: readonly ResultTab[] = ['quote', 'lineage'];

/**
 * Paso 4: la cotización lista para presentarla al cliente. Con un cliente con cuenta, una segunda
 * pestaña muestra el linaje de fuentes de su perfil (HU24); sin cuenta no hay perfil que mostrar.
 */
@Component({
  selector: 'sol-quote-result',
  imports: [CurrencyPipe, DatePipe, Alert, PriceBreakdown, RouterLink, SourceLineage],
  templateUrl: './quote-result.html',
  styleUrl: './quote-result.scss',
})
export class QuoteResult {
  readonly quote = input.required<Quote>();
  /** Cliente con cuenta al que se cotizó; `null` para un prospecto sin cuenta. */
  readonly clientId = input<string | null>(null);
  readonly newQuote = output<void>();

  protected readonly tab = signal<ResultTab>('quote');
  /** El linaje se pide la primera vez que se abre su pestaña y luego se conserva. */
  protected readonly lineageOpened = signal(false);
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  protected readonly digits = CURRENCY_DIGITS;
  protected readonly coverageLabel = coverageLabel;
  protected readonly productLabel = productLabel;

  protected select(tab: ResultTab): void {
    this.tab.set(tab);
    if (tab === 'lineage') this.lineageOpened.set(true);
  }

  /** Patrón de pestañas de WAI-ARIA: flechas, Inicio y Fin mueven la selección y el foco. */
  protected onTabKeydown(event: KeyboardEvent): void {
    const current = TABS.indexOf(this.tab());
    const last = TABS.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (current + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (current - 1 + TABS.length) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    this.select(TABS[next]);
    this.tabButtons()[next]?.nativeElement.focus();
  }
}
