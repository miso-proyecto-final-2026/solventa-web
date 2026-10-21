import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { AssistedQuoteGateway } from '../data-access/assisted-quote.gateway';
import { AssistedQuoteFacade } from '../state/assisted-quote.facade';
import { AssistedQuoteStore } from '../state/assisted-quote.store';
import { FakeAssistedQuoteGateway } from '../testing/fake-assisted-quote.gateway';
import { AssistedQuotePage } from './assisted-quote-page';

describe('AssistedQuotePage', () => {
  let fixture: ComponentFixture<AssistedQuotePage>;
  let el: HTMLElement;
  let gateway: FakeAssistedQuoteGateway;

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const step = () => el.querySelector('h2')?.textContent?.trim();
  const settle = () => fixture.whenStable();
  const type = (selector: string, value: string) => {
    const control = el.querySelector<HTMLInputElement>(selector)!;
    control.value = value;
    control.dispatchEvent(new Event('input'));
  };
  const click = async (label: string) => {
    const button = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    );
    expect(button).withContext(`botón «${label}»`).toBeDefined();
    button!.click();
    await settle();
  };
  const create = async () => {
    fixture = TestBed.createComponent(AssistedQuotePage);
    el = fixture.nativeElement;
    await settle();
  };

  beforeEach(async () => {
    sessionStorage.clear();
    gateway = new FakeAssistedQuoteGateway();
    TestBed.configureTestingModule({
      imports: [AssistedQuotePage],
      providers: [provideRouter([])],
    });
    // El estado y el gateway viven con la página: se reemplaza el gateway real por el de pruebas.
    TestBed.overrideComponent(AssistedQuotePage, {
      set: {
        providers: [
          AssistedQuoteStore,
          AssistedQuoteFacade,
          { provide: AssistedQuoteGateway, useValue: gateway },
        ],
      },
    });
  });

  afterEach(() => sessionStorage.clear());

  it('should open at the document step with one main heading and the progress marked', async () => {
    await create();

    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(step()).toBe('Buscar al cliente');
    expect(el.querySelector('sol-stepper [aria-current="step"]')?.textContent).toContain(
      'Buscar al cliente',
    );
  });

  it('should walk the whole journey: document, profile, approval, insurance data, result', async () => {
    await create();

    type('#lookup-number', '1000000001');
    await click('Buscar cliente');
    expect(step()).toBe('Perfil del cliente');
    expect(text()).toContain('Ana F.');
    expect(text()).toContain('Consentimiento vigente');

    await click('Aprobar y continuar');
    expect(step()).toBe('Datos del seguro');

    type('#insurance-edad', '35');
    type('#insurance-suma_asegurada', '50000000');
    await click('Solicitar cotización');

    expect(step()).toBe('Resultado');
    // El formato depende del idioma del build; aquí solo importa que se muestre la prima mensual.
    expect(text()).toMatch(/\$\s?13[.,]162/);
    expect(text()).toContain('Cómo se calculó el precio');
    expect(gateway.quoted[0].data).toEqual({ edad: 35, suma_asegurada: 50_000_000 });
  });

  it('should let the advisor quote without an account when the client does not exist', async () => {
    gateway.client = null;
    await create();

    type('#lookup-number', '99999999');
    await click('Buscar cliente');
    expect(text()).toContain('No encontramos un cliente');

    await click('Continuar sin cuenta');
    expect(step()).toBe('Datos del seguro');
  });

  it('should go back to search another client', async () => {
    await create();
    type('#lookup-number', '1000000001');
    await click('Buscar cliente');

    await click('Buscar otro cliente');

    expect(step()).toBe('Buscar al cliente');
  });

  it('should show a server error without losing what the advisor typed', async () => {
    await create();
    type('#lookup-number', '1000000001');
    await click('Buscar cliente');
    await click('Aprobar y continuar');
    type('#insurance-edad', '35');
    type('#insurance-suma_asegurada', '50000000');
    gateway.failQuote = new ApiError('server', 500);

    await click('Solicitar cotización');

    expect(el.querySelector('sol-alert [role="alert"]')?.textContent).toContain(
      'problema del servidor',
    );
    expect(step()).toBe('Datos del seguro');
    expect(el.querySelector<HTMLInputElement>('#insurance-edad')!.value).toBe('35');
    expect(el.querySelector<HTMLInputElement>('#insurance-suma_asegurada')!.value).toBe('50000000');
  });

  it('should show a different message when there is no connection', async () => {
    gateway.failFind = new ApiError('network', 0);
    await create();

    type('#lookup-number', '1000000001');
    await click('Buscar cliente');

    expect(text()).toContain('No hay conexión con el servidor');
    expect(text()).not.toContain('problema del servidor');
  });

  it('should ask to sign in again when the session expires, keeping the draft', async () => {
    const session = TestBed.inject(SessionStore);
    session.start({
      token: 't',
      user: { id: '1', name: 'A', role: 'ASESOR' },
      expiresAt: Date.now() + 60_000,
    });
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    await create();
    type('#lookup-number', '1000000001');

    session.expire();
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/assisted-quote' },
    });
    expect(
      JSON.parse(sessionStorage.getItem('solventa.draft.assisted-quote')!).documentNumber,
    ).toBe('1000000001');
  });

  it('should restore the draft saved before the session expired', async () => {
    sessionStorage.setItem(
      'solventa.draft.assisted-quote',
      JSON.stringify({
        documentType: 'CE',
        documentNumber: '55667788',
        productCode: null,
        data: {},
      }),
    );

    await create();

    expect(el.querySelector<HTMLInputElement>('#lookup-number')!.value).toBe('55667788');
    expect(el.querySelector<HTMLSelectElement>('#lookup-type')!.value).toBe('CE');
  });

  it('should start over after a delivered quote', async () => {
    await create();
    type('#lookup-number', '1000000001');
    await click('Buscar cliente');
    await click('Aprobar y continuar');
    type('#insurance-edad', '35');
    type('#insurance-suma_asegurada', '50000000');
    await click('Solicitar cotización');

    await click('Nueva cotización');

    expect(step()).toBe('Buscar al cliente');
  });

  it('should announce a pending operation to screen readers', async () => {
    await create();
    const store = fixture.debugElement.injector.get(AssistedQuoteStore);

    store.busy.set(true);
    await settle();

    expect(el.querySelector('p[role="status"]')?.textContent).toContain('Cargando');
  });
});
