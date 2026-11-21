import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Subscription } from 'rxjs';
import { AssistedQuoteGateway } from '../data-access/assisted-quote.gateway';
import {
  dataTypeLabel,
  errorMessage,
  lineageSourceLabel,
  missingReasonLabel,
  originLabel,
  profileFieldLabel,
  ttlLabel,
} from '../domain/labels';
import { ProfileLineage } from '../domain/models';

type LineageState = 'loading' | 'loaded' | 'empty' | 'error';

/**
 * HU24: linaje de fuentes del último perfil enriquecido del cliente, para que el asesor explique
 * de dónde salió cada dato. Muestra fuentes, fechas y marcas; nunca los valores del cliente.
 * Carga al mostrarse, así la consulta (que queda auditada) solo ocurre si el asesor la pide.
 */
@Component({
  selector: 'sol-source-lineage',
  imports: [Alert, DatePipe],
  templateUrl: './source-lineage.html',
  styleUrl: './source-lineage.scss',
})
export class SourceLineage {
  readonly clientId = input.required<string>();

  private readonly gateway = inject(AssistedQuoteGateway);
  private request: Subscription | null = null;

  protected readonly state = signal<LineageState>('loading');
  protected readonly lineage = signal<ProfileLineage | null>(null);
  protected readonly errorText = signal<string | null>(null);

  protected readonly sourceLabel = lineageSourceLabel;
  protected readonly dataTypeLabel = dataTypeLabel;
  protected readonly fieldLabel = profileFieldLabel;
  protected readonly reasonLabel = missingReasonLabel;
  protected readonly originLabel = originLabel;
  protected readonly ttlLabel = ttlLabel;

  constructor() {
    effect(() => {
      const clientId = this.clientId();
      untracked(() => this.load(clientId));
    });
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  protected retry(): void {
    this.load(this.clientId());
  }

  protected fieldList(fields: readonly string[]): string {
    return fields.map((f) => this.fieldLabel(f)).join(', ');
  }

  private load(clientId: string): void {
    this.request?.unsubscribe();
    this.state.set('loading');
    this.errorText.set(null);
    this.request = this.gateway.getLineage(clientId).subscribe({
      next: (lineage) => {
        this.lineage.set(lineage);
        this.state.set(lineage ? 'loaded' : 'empty');
      },
      error: (error: unknown) => {
        this.lineage.set(null);
        this.errorText.set(
          error instanceof ApiError && error.kind !== 'server' && error.kind !== 'not-found'
            ? errorMessage(error)
            : $localize`:@@lineage.error.unavailable:El linaje no está disponible en este momento. Inténtalo de nuevo en unos minutos.`,
        );
        this.state.set('error');
      },
    });
  }
}
