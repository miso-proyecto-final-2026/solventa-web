import { DatePipe, DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { ApiError } from '@core/http/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Card } from '@shared/ui/card/card';
import { SignatureActions, SignatureSteps } from '@shared/signature/signature-steps';
import { filter } from 'rxjs';
import { SignLinkGateway } from '../data-access/sign-link.gateway';
import { linkClosedMessage, retryMessage } from '../domain/labels';
import { LinkDocument } from '../domain/models';

type Stage = 'loading' | 'ready' | 'signed' | 'closed';

/**
 * HU39: el cliente firma con el enlace que le envió su asesor, sin iniciar sesión. El token llega en
 * el fragmento de la URL, que el navegador no envía al servidor; se queda en memoria y sale de la
 * barra de direcciones para que no se copie ni quede en el historial.
 */
@Component({
  selector: 'sol-sign-link',
  imports: [Alert, Card, DatePipe, SignatureSteps],
  templateUrl: './sign-link-page.html',
  styleUrl: './sign-link-page.scss',
})
export class SignLinkPage {
  private readonly gateway = inject(SignLinkGateway);
  private readonly page = inject(DOCUMENT);
  private readonly status = viewChild<ElementRef<HTMLElement>>('status');
  private token: string | null = null;

  protected readonly stage = signal<Stage>('loading');
  protected readonly document = signal<LinkDocument | null>(null);
  protected readonly revision = signal(0);
  protected readonly closedText = signal('');
  protected readonly error = signal<ApiError | null>(null);
  protected readonly retryText = retryMessage;
  protected readonly hash = computed(() => this.document()?.hash ?? null);
  protected readonly actions: SignatureActions<void> = {
    getPdf: () => this.gateway.getPdf(this.token ?? ''),
    requestCode: () => this.gateway.requestCode(this.token ?? ''),
    sign: (submission) => this.gateway.sign(this.token ?? '', submission),
  };

  constructor() {
    this.readToken();
    // Pegar otro enlace con la página abierta solo cambia el fragmento: el navegador no la recarga.
    const onHashChange = () => {
      if (this.page.location.hash) this.readToken();
    };
    const view = this.page.defaultView;
    view?.addEventListener('hashchange', onHashChange);
    inject(DestroyRef).onDestroy(() => view?.removeEventListener('hashchange', onHashChange));
    // El enrutador procesa ese mismo cambio después y vuelve a escribir el fragmento en la URL.
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.clearAddressBar());
  }

  private readToken(): void {
    const location = this.page.location;
    this.token = new URLSearchParams(location.hash.slice(1)).get('t');
    this.clearAddressBar();
    this.document.set(null);
    if (this.token) this.load();
    else this.close(null);
  }

  private clearAddressBar(): void {
    const location = this.page.location;
    if (location.hash) this.page.defaultView?.history.replaceState(null, '', location.pathname);
  }

  protected load(): void {
    this.stage.set('loading');
    this.error.set(null);
    this.gateway.getDocument(this.token ?? '').subscribe({
      next: (d) => {
        this.document.set(d);
        this.stage.set(d.state === 'SIGNED' ? 'signed' : 'ready');
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  protected onSigned(): void {
    this.stage.set('signed');
    this.announce();
  }

  /** No se sabe si la firma llegó, o el documento cambió: se vuelve a preguntar antes de pedir otro código. */
  protected onSignFailed(e: ApiError): void {
    this.fail(e);
    if (e.code === 'DOCUMENTO_ALTERADO') this.reloadDocument();
    if (e.kind === 'network' || e.kind === 'server') this.checkSigned();
  }

  protected fail(e: unknown): void {
    const error = e instanceof ApiError ? e : new ApiError('server', 500);
    const closed = linkClosedMessage(error);
    if (closed) {
      this.close(error);
      return;
    }
    this.error.set(error);
    if (this.stage() === 'loading') this.stage.set('ready');
    this.announce();
  }

  private reloadDocument(): void {
    this.gateway.getDocument(this.token ?? '').subscribe({
      next: (d) => {
        this.document.set(d);
        this.revision.update((r) => r + 1);
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  private checkSigned(): void {
    this.gateway.getDocument(this.token ?? '').subscribe({
      next: (d) => {
        if (d.state !== 'SIGNED') return;
        this.error.set(null);
        this.onSigned();
      },
      // Sigue sin haber conexión: se mantiene el error que ya se muestra.
      error: () => undefined,
    });
  }

  private close(error: ApiError | null): void {
    this.closedText.set(linkClosedMessage(error) ?? '');
    this.stage.set('closed');
    this.announce();
  }

  private announce(): void {
    queueMicrotask(() => this.status()?.nativeElement.focus());
  }
}
