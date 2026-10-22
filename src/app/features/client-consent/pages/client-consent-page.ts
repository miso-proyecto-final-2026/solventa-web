import { DatePipe } from '@angular/common';
import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { provideGateway } from '@core/config/data-source';
import { ApiError } from '@core/http/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { ClientLookup } from '../../assisted-quote/client-lookup/client-lookup';
import { AssistedQuoteGateway } from '../../assisted-quote/data-access/assisted-quote.gateway';
import { HttpAssistedQuoteGateway } from '../../assisted-quote/data-access/http-assisted-quote.gateway';
import { MockAssistedQuoteGateway } from '../../assisted-quote/data-access/mock-assisted-quote.gateway';
import { ClientIdentity, DocumentId } from '../../assisted-quote/domain/models';
import { consentStatusLabel, lookupErrorMessage } from '../domain/labels';

/**
 * HU08: el asesor consulta si un cliente autorizó el uso de sus datos antes de operar con ellos.
 * Es de solo lectura: otorgar y revocar lo hace el titular desde su app. Cada búsqueda consulta
 * al servidor, así que un cambio reciente del cliente aparece al volver a buscar.
 */
@Component({
  selector: 'sol-client-consent-page',
  imports: [Alert, Card, ClientLookup, DatePipe, RouterLink],
  providers: [
    provideGateway(AssistedQuoteGateway, HttpAssistedQuoteGateway, MockAssistedQuoteGateway),
  ],
  templateUrl: './client-consent-page.html',
  styleUrl: './client-consent-page.scss',
})
export class ClientConsentPage {
  private readonly gateway = inject(AssistedQuoteGateway);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly result = viewChild<ElementRef<HTMLElement>>('result');

  protected readonly busy = signal(false);
  protected readonly client = signal<ClientIdentity | null>(null);
  protected readonly notFound = signal<DocumentId | null>(null);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly statusLabel = consentStatusLabel;
  protected readonly errorText = lookupErrorMessage;

  constructor() {
    // Un 401 con sesión iniciada significa que venció: se pide iniciar sesión y se vuelve aquí.
    effect(() => {
      if (this.session.expired()) {
        void this.router.navigate(['/login'], { queryParams: { returnUrl: '/client-consent' } });
      }
    });
  }

  protected search(document: DocumentId): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.client.set(null);
    this.notFound.set(null);
    this.gateway.findClient(document).subscribe({
      next: (found) => {
        this.busy.set(false);
        if (found) this.client.set(found);
        else this.notFound.set(document);
        // El resultado recibe el foco: quien usa teclado o lector de pantalla lo escucha enseguida.
        queueMicrotask(() => this.result()?.nativeElement.focus());
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.error.set(e instanceof ApiError ? e : new ApiError('server', 500));
      },
    });
  }
}
