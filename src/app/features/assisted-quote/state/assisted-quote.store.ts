import { Injectable, computed, signal } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import {
  ClientIdentity,
  DocumentId,
  Product,
  ProfileSummary,
  Quote,
  toFieldName,
} from '../domain/models';

/** Pasos del recorrido, en orden: documento → perfil (y aprobación) → datos del seguro → resultado. */
export const STEPS = ['lookup', 'profile', 'insurance', 'result'] as const;
export type Step = (typeof STEPS)[number];

/** Estado de la cotización asistida. Solo lo escribe la fachada; la pantalla lo lee. */
@Injectable()
export class AssistedQuoteStore {
  readonly step = signal<Step>('lookup');
  /** Hay una llamada en curso: se bloquean los botones para no enviar dos veces. */
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);

  /** Documento que se buscó; con `client` nulo significa que no existe en Identidad. */
  readonly searched = signal<DocumentId | null>(null);
  readonly client = signal<ClientIdentity | null>(null);
  readonly profile = signal<ProfileSummary | null>(null);
  readonly catalog = signal<readonly Product[]>([]);
  readonly quote = signal<Quote | null>(null);

  readonly stepIndex = computed(() => STEPS.indexOf(this.step()));
  readonly clientNotFound = computed(() => this.searched() !== null && this.client() === null);

  /** Errores de validación del servidor por nombre de campo del seguro. */
  readonly fieldErrors = computed<Readonly<Record<string, string>>>(() => {
    const entries = (this.error()?.fields ?? []).map((f) => [toFieldName(f.field), f.reason]);
    return Object.fromEntries(entries) as Record<string, string>;
  });

  reset(): void {
    this.step.set('lookup');
    this.busy.set(false);
    this.error.set(null);
    this.searched.set(null);
    this.client.set(null);
    this.profile.set(null);
    this.quote.set(null);
  }
}
