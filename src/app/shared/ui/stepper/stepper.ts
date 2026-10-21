import { Component, input } from '@angular/core';

/** Paso a paso. El paso actual se marca con `aria-current="step"`; los hechos llevan ✓ y texto oculto. */
@Component({
  selector: 'sol-stepper',
  template: `
    <ol class="stepper" [attr.aria-label]="label()">
      @for (step of steps(); track step; let i = $index) {
        <li
          class="stepper__item"
          [class.stepper__item--done]="i < current()"
          [class.stepper__item--current]="i === current()"
          [attr.aria-current]="i === current() ? 'step' : null"
        >
          @if (i < current()) {
            <span aria-hidden="true">✓</span>
            <span class="sol-visually-hidden">{{ doneLabel() }}:</span>
          }
          {{ step }}
        </li>
      }
    </ol>
  `,
  styles: `
    .stepper {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: var(--sol-space-2);
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .stepper__item {
      padding: var(--sol-space-2) 0;
      font-weight: 600;
      color: var(--sol-text-muted);
      text-align: center;
      border-bottom: 3px solid var(--sol-border);
    }
    .stepper__item--done,
    .stepper__item--current {
      color: var(--sol-teal-700);
      border-bottom-color: var(--sol-teal-600);
    }
  `,
})
export class Stepper {
  readonly steps = input.required<readonly string[]>();
  /** Índice (desde 0) del paso actual. */
  readonly current = input.required<number>();
  readonly label = input.required<string>();
  readonly doneLabel = input.required<string>();
}
