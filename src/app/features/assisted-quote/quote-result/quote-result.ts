import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CURRENCY_DIGITS } from '@core/money/money';
import { Alert } from '@shared/ui/alert/alert';
import { PriceBreakdown } from '../price-breakdown/price-breakdown';
import { coverageLabel, productLabel } from '../domain/labels';
import { Quote } from '../domain/models';

/** Paso 4: la cotización lista para presentarla al cliente. */
@Component({
  selector: 'sol-quote-result',
  imports: [CurrencyPipe, DatePipe, Alert, PriceBreakdown, RouterLink],
  templateUrl: './quote-result.html',
  styleUrl: './quote-result.scss',
})
export class QuoteResult {
  readonly quote = input.required<Quote>();
  readonly newQuote = output<void>();

  protected readonly digits = CURRENCY_DIGITS;
  protected readonly coverageLabel = coverageLabel;
  protected readonly productLabel = productLabel;
}
