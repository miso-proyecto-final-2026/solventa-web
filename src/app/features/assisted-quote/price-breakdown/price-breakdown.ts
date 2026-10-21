import { CurrencyPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { CURRENCY_DIGITS } from '@core/money/money';
import { componentLabel, profileSourceLabel } from '../domain/labels';
import { PriceComponent, ProfileSource } from '../domain/models';

/** Desglose resumido del precio, para que el asesor se lo explique al cliente. */
@Component({
  selector: 'sol-price-breakdown',
  imports: [CurrencyPipe],
  templateUrl: './price-breakdown.html',
  styleUrl: './price-breakdown.scss',
})
export class PriceBreakdown {
  readonly components = input.required<readonly PriceComponent[]>();
  readonly source = input.required<ProfileSource>();

  protected readonly digits = CURRENCY_DIGITS;
  protected readonly label = componentLabel;
  protected readonly sourceLabel = profileSourceLabel;
}
