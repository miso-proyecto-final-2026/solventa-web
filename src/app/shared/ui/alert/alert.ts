import { Component, computed, input } from '@angular/core';

export type AlertKind = 'info' | 'success' | 'warning' | 'error';

/**
 * Mensaje de estado. Los errores se anuncian de inmediato (`role="alert"`); el resto, con
 * cortesía (`role="status"`). El color nunca es lo único que lo distingue: cada tipo trae un ícono.
 */
@Component({
  selector: 'sol-alert',
  template: `
    <div class="alert" [class]="'alert alert--' + kind()" [attr.role]="role()">
      <span class="alert__icon" aria-hidden="true">{{ icon() }}</span>
      <div class="alert__body"><ng-content /></div>
    </div>
  `,
  styles: `
    .alert {
      display: flex;
      gap: var(--sol-space-3);
      padding: var(--sol-space-3) var(--sol-space-4);
      border: 1px solid;
      border-radius: var(--sol-radius-sm);
    }
    .alert__body {
      flex: 1;
    }
    .alert--info {
      color: var(--sol-info-text);
      background: var(--sol-info-bg);
      border-color: var(--sol-info-border);
    }
    .alert--success {
      color: var(--sol-success-text);
      background: var(--sol-success-bg);
      border-color: var(--sol-success-border);
    }
    .alert--warning {
      color: var(--sol-warning-text);
      background: var(--sol-warning-bg);
      border-color: var(--sol-warning-border);
    }
    .alert--error {
      color: var(--sol-danger-text);
      background: var(--sol-danger-bg);
      border-color: var(--sol-danger-border);
    }
  `,
})
export class Alert {
  readonly kind = input<AlertKind>('info');

  protected readonly role = computed(() => (this.kind() === 'error' ? 'alert' : 'status'));
  protected readonly icon = computed(
    () => ({ info: 'ℹ', success: '✓', warning: '⚠', error: '✕' })[this.kind()],
  );
}
