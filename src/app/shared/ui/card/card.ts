import { Component } from '@angular/core';

/** Superficie blanca con borde y sombra. Muestra el contenido que se ponga dentro. */
@Component({
  selector: 'sol-card',
  template: '<ng-content />',
  styles: `
    :host {
      display: block;
      padding: var(--sol-space-5);
      background: var(--sol-surface);
      border: 1px solid var(--sol-border);
      border-radius: var(--sol-radius-md);
      box-shadow: var(--sol-shadow-card);
    }
  `,
})
export class Card {}
