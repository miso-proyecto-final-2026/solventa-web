import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '@core/http/api-error';
import { Observable, of, throwError } from 'rxjs';
import { SignLinkGateway } from '../data-access/sign-link.gateway';
import { LinkDocument } from '../domain/models';
import { SignLinkPage } from './sign-link-page';

const DOC: LinkDocument = {
  policyNumber: 'SOLV-1',
  hash: 'a'.repeat(64),
  state: 'PENDING',
  expiresAt: new Date('2030-01-01T00:00:00Z'),
};

class FakeGateway extends SignLinkGateway {
  document = DOC;
  failDocument: ApiError | null = null;
  failPdf: ApiError | null = null;
  failSign: ApiError | null = null;
  documentCalls = 0;
  readonly tokens: string[] = [];
  readonly codes: string[] = [];

  getDocument(token: string): Observable<LinkDocument> {
    this.documentCalls++;
    this.tokens.push(token);
    return this.failDocument ? throwError(() => this.failDocument) : of(this.document);
  }
  getPdf(): Observable<Blob> {
    return this.failPdf ? throwError(() => this.failPdf) : of(new Blob(['%PDF']));
  }
  requestCode(): Observable<void> {
    return of(undefined);
  }
  sign(_token: string, submission: { code: string }): Observable<void> {
    this.codes.push(submission.code);
    return this.failSign ? throwError(() => this.failSign) : of(undefined);
  }
}

describe('SignLinkPage', () => {
  let fixture: ComponentFixture<SignLinkPage>;
  let el: HTMLElement;
  let gateway: FakeGateway;
  const path = location.pathname + location.search;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const create = async (hash = '#t=token-1') => {
    history.replaceState(null, '', `${path}${hash}`);
    fixture = TestBed.createComponent(SignLinkPage);
    el = fixture.nativeElement;
    await settle();
  };
  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    );
  const click = async (label: string) => {
    button(label)!.click();
    await settle();
  };
  const signWith = async (code: string) => {
    await click('Abrir el documento');
    el.querySelector<HTMLInputElement>('input[name="reviewed"]')!.click();
    await settle();
    await click('Enviarme el código');
    const input = el.querySelector<HTMLInputElement>('#sub-code')!;
    input.value = code;
    input.dispatchEvent(new Event('input'));
    await settle();
    await click('Firmar');
  };

  beforeEach(() => {
    gateway = new FakeGateway();
    TestBed.configureTestingModule({
      imports: [SignLinkPage],
      providers: [provideRouter([]), { provide: SignLinkGateway, useValue: gateway }],
    });
  });

  afterEach(() => {
    fixture.destroy();
    history.replaceState(null, '', path);
  });

  it('should read the token, keep it in memory and take it out of the address bar', async () => {
    await create();

    expect(gateway.tokens).toEqual(['token-1']);
    expect(location.hash).toBe('');
    expect(text()).toContain('SOLV-1');
  });

  it('should use the new link when another one is opened in the same page', async () => {
    gateway.failDocument = new ApiError('validation', 410, 'ENLACE_REEMPLAZADO');
    await create('#t=viejo');
    expect(text()).toContain('fue reemplazado');

    gateway.failDocument = null;
    location.hash = '#t=nuevo';
    await new Promise((resolve) => window.addEventListener('hashchange', resolve, { once: true }));
    await settle();

    expect(gateway.tokens).toEqual(['viejo', 'nuevo']);
    expect(text()).not.toContain('fue reemplazado');
    expect(text()).toContain('SOLV-1');
    expect(location.hash).toBe('');
  });

  it('should not call the server without a token', async () => {
    await create('');

    expect(gateway.documentCalls).toBe(0);
    expect(text()).toContain('no es válido');
    expect(button('Abrir el documento')).toBeUndefined();
  });

  it('should sign and show the result', async () => {
    await create();

    await signWith('123 456');

    expect(gateway.codes).toEqual(['123456']);
    expect(text()).toContain('Tu póliza está firmada');
    expect(button('Firmar')).toBeUndefined();
  });

  it('should say it is signed when the link was already used', async () => {
    gateway.document = { ...DOC, state: 'SIGNED' };

    await create();

    expect(text()).toContain('Tu póliza está firmada');
  });

  for (const [code, status, expected] of [
    ['ENLACE_INVALIDO', 401, 'no es válido'],
    ['ENLACE_VENCIDO', 410, 'venció'],
    ['ENLACE_REEMPLAZADO', 410, 'fue reemplazado'],
    ['FIRMA_VENCIDA', 409, 'plazo para firmar'],
    ['FIRMA_FALLIDA', 409, 'verificar tu identidad'],
    ['FIRMA_NO_DISPONIBLE', 409, 'Consulta con tu asesor'],
  ] as const) {
    it(`should close the page and explain ${code}`, async () => {
      gateway.failDocument = new ApiError('validation', status, code);

      await create();

      expect(text()).toContain(expected);
      expect(button('Abrir el documento')).toBeUndefined();
    });
  }

  it('should explain a link that stopped working while opening the PDF', async () => {
    await create();
    gateway.failPdf = new ApiError('validation', 410);

    await click('Abrir el documento');

    expect(text()).toContain('ya no sirve');
    expect(button('Abrir el documento')).toBeUndefined();
  });

  it('should offer retrying when the document could not load', async () => {
    gateway.failDocument = new ApiError('network', 0);
    await create();
    expect(text()).toContain('No hay conexión');

    gateway.failDocument = null;
    await click('Volver a intentar');

    expect(text()).toContain('SOLV-1');
  });

  it('should say how many attempts are left and stay open', async () => {
    await create();
    gateway.failSign = new ApiError('forbidden', 403, 'OTP_INVALIDO', [
      { field: 'codigo', reason: 'intentos restantes: 2' },
    ]);

    await signWith('000000');

    expect(text()).toContain('Intentos restantes: 2');
    expect(button('Firmar')).toBeDefined();
  });

  it('should close the page when the attempts run out', async () => {
    await create();
    gateway.failSign = new ApiError('validation', 409, 'FIRMA_FALLIDA');

    await signWith('000000');

    expect(text()).toContain('cobro se devolverá');
    expect(button('Firmar')).toBeUndefined();
  });

  it('should ask for a new review with the new hash when the document changed', async () => {
    await create();
    gateway.failSign = new ApiError('validation', 409, 'DOCUMENTO_ALTERADO');
    gateway.document = { ...DOC, hash: 'b'.repeat(64) };

    await signWith('123456');

    expect(text()).toContain('El documento cambió');
    expect(el.querySelector<HTMLInputElement>('input[name="reviewed"]')!.checked).toBeFalse();
    expect(el.querySelector('iframe')).toBeNull();
  });

  it('should check whether it was signed when the connection failed', async () => {
    await create();
    gateway.failSign = new ApiError('network', 0);
    gateway.document = { ...DOC, state: 'SIGNED' };

    await signWith('123456');

    expect(text()).not.toContain('No hay conexión');
    expect(text()).toContain('Tu póliza está firmada');
  });

  it('should keep the connection error when it was not signed', async () => {
    await create();
    gateway.failSign = new ApiError('network', 0);

    await signWith('123456');

    expect(text()).toContain('No hay conexión');
    expect(button('Firmar')).toBeDefined();
  });
});
