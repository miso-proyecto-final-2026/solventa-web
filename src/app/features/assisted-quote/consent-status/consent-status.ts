import { Component, computed, input } from '@angular/core';
import { ConsentState, ProfileSource } from '../domain/models';
import { consentEffect, consentLabel } from '../domain/labels';

/** Estado del consentimiento Open Finance y cómo afecta el precio (perfil real o por defecto). */
@Component({
  selector: 'sol-consent-status',
  template: `
    <p class="consent">
      <span class="consent__badge" [class.consent__badge--granted]="state() === 'GRANTED'">
        <span aria-hidden="true">{{ state() === 'GRANTED' ? '✓' : '!' }}</span>
        {{ label() }}
      </span>
    </p>
    <p class="consent__effect">{{ effect() }}</p>
  `,
  styles: `
    .consent {
      margin-bottom: var(--sol-space-2);
    }
    .consent__badge {
      display: inline-flex;
      gap: var(--sol-space-2);
      padding: var(--sol-space-1) var(--sol-space-3);
      font-weight: 600;
      color: var(--sol-warning-text);
      background: var(--sol-warning-bg);
      border: 1px solid var(--sol-warning-border);
      border-radius: var(--sol-radius-pill);
    }
    .consent__badge--granted {
      color: var(--sol-success-text);
      background: var(--sol-success-bg);
      border-color: var(--sol-success-border);
    }
    .consent__effect {
      color: var(--sol-text-muted);
    }
  `,
})
export class ConsentStatus {
  readonly state = input.required<ConsentState>();
  readonly source = input.required<ProfileSource>();

  protected readonly label = computed(() => consentLabel(this.state()));
  protected readonly effect = computed(() => consentEffect(this.source()));
}
