import { Component, input } from '@angular/core';

/**
 * Campo de formulario: etiqueta asociada al control por `for`, ayuda y error en línea.
 *
 * El control se proyecta dentro y debe llevar `[id]="fieldId"`. Para que el lector de pantalla
 * lea la ayuda y el error junto al campo, el control usa `[attr.aria-describedby]` con
 * `describedBy(fieldId, hasHint, hasError)` y `[attr.aria-invalid]`.
 */
@Component({
  selector: 'sol-form-field',
  template: `
    <label class="field__label" [attr.for]="fieldId()">{{ label() }}</label>
    <ng-content />
    @if (hint()) {
      <small class="field__hint" [id]="fieldId() + '-hint'">{{ hint() }}</small>
    }
    @if (error()) {
      <small class="field__error" [id]="fieldId() + '-error'">
        <span aria-hidden="true">✕</span> {{ error() }}
      </small>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-1);
    }
    .field__label {
      font-weight: 600;
    }
    .field__hint {
      color: var(--sol-text-muted);
    }
    .field__error {
      font-weight: 600;
      color: var(--sol-danger-text);
    }
  `,
})
export class FormField {
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
}

/** Ids de la ayuda y del error de un campo, para `aria-describedby`; null si no hay ninguno. */
export function describedBy(fieldId: string, hasHint: boolean, hasError: boolean): string | null {
  const ids = [hasHint ? `${fieldId}-hint` : '', hasError ? `${fieldId}-error` : ''].filter(
    Boolean,
  );
  return ids.length ? ids.join(' ') : null;
}
