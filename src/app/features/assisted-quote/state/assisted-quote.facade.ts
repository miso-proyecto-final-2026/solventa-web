import { Injectable, inject } from '@angular/core';
import { DraftStorage } from '@core/draft/draft-storage';
import { ApiError } from '@core/http/api-error';
import { Observable, finalize, map, of, switchMap, tap } from 'rxjs';
import { AssistedQuoteGateway } from '../data-access/assisted-quote.gateway';
import { DocumentId, QuoteData, QuoteDraft, QuoteSubject } from '../domain/models';
import { AssistedQuoteStore, Step } from './assisted-quote.store';

const DRAFT_KEY = 'assisted-quote';

/**
 * Casos de uso de la cotización asistida. La pantalla solo llama a estos métodos y lee el store:
 * no conoce HTTP ni el gateway.
 */
@Injectable()
export class AssistedQuoteFacade {
  private readonly gateway = inject(AssistedQuoteGateway);
  private readonly drafts = inject(DraftStorage);
  readonly store = inject(AssistedQuoteStore);

  /** Paso 1: busca al cliente y, si existe, trae su perfil. Si no existe, el paso 2 lo explica. */
  searchClient(document: DocumentId): void {
    this.run(() =>
      this.gateway.findClient(document).pipe(
        switchMap((client) =>
          client
            ? this.gateway.getProfile(client.id).pipe(map((profile) => ({ client, profile })))
            : of({ client: null, profile: null }),
        ),
        tap(({ client, profile }) => {
          this.store.searched.set(document);
          this.store.client.set(client);
          this.store.profile.set(profile);
          this.store.step.set('profile');
        }),
      ),
    );
  }

  /** Paso 2: el asesor aprueba cotizar a este cliente (o continuar sin cuenta si no existe). */
  approve(): void {
    this.run(() => this.ensureCatalog().pipe(tap(() => this.store.step.set('insurance'))));
  }

  /** Paso 3: calcula la cotización con el mismo motor que usan la app móvil y la API. */
  requestQuote(productCode: string, data: QuoteData): void {
    const subject = this.subject();
    if (!subject) return;
    this.run(() =>
      this.gateway.requestQuote({ subject, productCode, data }).pipe(
        tap((quote) => {
          this.store.quote.set(quote);
          this.store.step.set('result');
          this.drafts.clear(DRAFT_KEY); // el trabajo ya se entregó: no hace falta recuperarlo
        }),
      ),
    );
  }

  goTo(step: Step): void {
    this.store.error.set(null);
    this.store.step.set(step);
  }

  newQuote(): void {
    this.store.reset();
    this.drafts.clear(DRAFT_KEY);
  }

  saveDraft(draft: QuoteDraft): void {
    this.drafts.save(DRAFT_KEY, draft);
  }

  loadDraft(): QuoteDraft | null {
    return this.drafts.load<QuoteDraft>(DRAFT_KEY);
  }

  private subject(): QuoteSubject | null {
    const client = this.store.client();
    if (client) return { kind: 'client', clientId: client.id };
    const document = this.store.searched();
    return document ? { kind: 'prospect', document } : null;
  }

  private ensureCatalog(): Observable<unknown> {
    return this.store.catalog().length
      ? of(null)
      : this.gateway.getCatalog().pipe(tap((catalog) => this.store.catalog.set(catalog)));
  }

  /** Ejecuta una operación con el estado de carga y error de la pantalla; si ya hay otra en curso la ignora
   * (la operación se arma solo si se va a ejecutar, para no disparar efectos de más). */
  private run(operation: () => Observable<unknown>): void {
    if (this.store.busy()) return;
    this.store.busy.set(true);
    this.store.error.set(null);
    operation()
      .pipe(finalize(() => this.store.busy.set(false)))
      .subscribe({
        error: (error: unknown) =>
          this.store.error.set(error instanceof ApiError ? error : new ApiError('server', 0)),
      });
  }
}
