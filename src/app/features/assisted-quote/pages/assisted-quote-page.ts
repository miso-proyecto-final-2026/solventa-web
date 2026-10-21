import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { provideGateway } from '@core/config/data-source';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { Stepper } from '@shared/ui/stepper/stepper';
import { ClientLookup } from '../client-lookup/client-lookup';
import { ClientProfile } from '../client-profile/client-profile';
import { AssistedQuoteGateway } from '../data-access/assisted-quote.gateway';
import { HttpAssistedQuoteGateway } from '../data-access/http-assisted-quote.gateway';
import { MockAssistedQuoteGateway } from '../data-access/mock-assisted-quote.gateway';
import { errorMessage } from '../domain/labels';
import { DocumentId, QuoteDraft } from '../domain/models';
import { ProductDraft, ProductForm, ProductSubmission } from '../product-form/product-form';
import { QuoteResult } from '../quote-result/quote-result';
import { AssistedQuoteFacade } from '../state/assisted-quote.facade';
import { AssistedQuoteStore, Step } from '../state/assisted-quote.store';

const STEP_TITLES: Record<Step, string> = {
  lookup: $localize`:@@assistedQuote.step.lookup:Buscar al cliente`,
  profile: $localize`:@@assistedQuote.step.profile:Perfil del cliente`,
  insurance: $localize`:@@assistedQuote.step.insurance:Datos del seguro`,
  result: $localize`:@@assistedQuote.step.result:Resultado`,
};

/**
 * Contenedor del recorrido: conecta la fachada con los pasos y se ocupa del foco y de la sesión.
 * El estado vive con la página (se reinicia cada vez que el asesor entra).
 */
@Component({
  selector: 'sol-assisted-quote-page',
  imports: [Alert, Card, Stepper, ClientLookup, ClientProfile, ProductForm, QuoteResult],
  providers: [
    AssistedQuoteStore,
    AssistedQuoteFacade,
    provideGateway(AssistedQuoteGateway, HttpAssistedQuoteGateway, MockAssistedQuoteGateway),
  ],
  templateUrl: './assisted-quote-page.html',
  styleUrl: './assisted-quote-page.scss',
})
export class AssistedQuotePage {
  protected readonly facade = inject(AssistedQuoteFacade);
  protected readonly store = this.facade.store;

  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('stepHeading');

  protected readonly stepLabels = Object.values(STEP_TITLES);
  protected readonly stepTitle = computed(() => STEP_TITLES[this.store.step()]);
  protected readonly errorText = computed(() => {
    const error = this.store.error();
    return error ? errorMessage(error) : null;
  });

  /** Borrador recuperado: lo que el asesor ya había escrito antes de que venciera la sesión. */
  protected readonly draft: QuoteDraft = this.facade.loadDraft() ?? {
    documentType: 'CC',
    documentNumber: '',
    productCode: null,
    data: {},
  };
  protected readonly initialDocument: DocumentId | null = this.draft.documentNumber
    ? { type: this.draft.documentType, number: this.draft.documentNumber }
    : null;

  private current: QuoteDraft = this.draft;
  private firstStep = true;

  constructor() {
    // Si la sesión vence (el interceptor lo detecta con un 401), se pide iniciar sesión de nuevo.
    // Lo ingresado ya está guardado en el borrador y se recupera al volver.
    effect(() => {
      if (this.session.expired()) {
        void this.router.navigate(['/login'], { queryParams: { returnUrl: '/assisted-quote' } });
      }
    });

    // Al cambiar de paso el foco pasa al título, para quien usa teclado o lector de pantalla.
    effect(() => {
      this.store.step();
      if (this.firstStep) {
        this.firstStep = false;
        return;
      }
      queueMicrotask(() => this.heading()?.nativeElement.focus());
    });
  }

  protected onLookupDraft(document: DocumentId): void {
    this.remember({ documentType: document.type, documentNumber: document.number });
  }

  protected onProductDraft(draft: ProductDraft): void {
    this.remember({ productCode: draft.productCode, data: draft.data });
  }

  protected submitQuote(submission: ProductSubmission): void {
    this.facade.requestQuote(submission.productCode, submission.data);
  }

  private remember(change: Partial<QuoteDraft>): void {
    this.current = { ...this.current, ...change };
    this.facade.saveDraft(this.current);
  }
}
