import { Component, ElementRef, input, viewChild } from '@angular/core';

export interface SummaryError {
  /** Id del control con el problema, para llevar el foco hasta él. */
  readonly fieldId: string;
  readonly message: string;
}

/**
 * Resumen de errores de un formulario. Al enviar con errores, quien lo usa llama a `focus()`:
 * el lector de pantalla lo anuncia y cada enlace lleva el foco al campo con el problema.
 */
@Component({
  selector: 'sol-error-summary',
  template: `
    @if (errors().length) {
      <div class="summary" role="alert">
        <h2 class="summary__title" #title tabindex="-1">{{ heading() }}</h2>
        <ul>
          @for (e of errors(); track e.fieldId) {
            <li>
              <a [href]="'#' + e.fieldId" (click)="goTo($event, e.fieldId)">{{ e.message }}</a>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: `
    .summary {
      padding: var(--sol-space-3) var(--sol-space-4);
      color: var(--sol-danger-text);
      background: var(--sol-danger-bg);
      border: 1px solid var(--sol-danger-border);
      border-radius: var(--sol-radius-sm);
    }
    .summary__title {
      font-size: 1rem;
    }
    ul {
      padding-left: var(--sol-space-5);
      margin: var(--sol-space-2) 0 0;
    }
  `,
})
export class ErrorSummary {
  readonly errors = input.required<readonly SummaryError[]>();
  readonly heading = input.required<string>();

  private readonly title = viewChild<ElementRef<HTMLElement>>('title');

  focus(): void {
    this.title()?.nativeElement.focus();
  }

  protected goTo(event: Event, fieldId: string): void {
    event.preventDefault();
    document.getElementById(fieldId)?.focus();
  }
}
