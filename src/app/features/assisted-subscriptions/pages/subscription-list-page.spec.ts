import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { Subject } from 'rxjs';
import { AssistedSubscriptionsGateway } from '../data-access/assisted-subscriptions.gateway';
import { SubscriptionPage } from '../domain/models';
import { COMPENSATING, SUBSCRIPTION } from '../testing/fixtures';
import { FakeAssistedSubscriptionsGateway } from '../testing/fake-assisted-subscriptions.gateway';
import { SubscriptionListPage } from './subscription-list-page';

describe('SubscriptionListPage', () => {
  let fixture: ComponentFixture<SubscriptionListPage>;
  let el: HTMLElement;
  let gateway: FakeAssistedSubscriptionsGateway;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const create = async () => {
    fixture = TestBed.createComponent(SubscriptionListPage);
    el = fixture.nativeElement;
    await settle();
  };
  const text = () => el.textContent ?? '';
  const rows = () => Array.from(el.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    )!;

  beforeEach(() => {
    sessionStorage.clear();
    gateway = new FakeAssistedSubscriptionsGateway();
    TestBed.configureTestingModule({
      imports: [SubscriptionListPage],
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        { provide: AssistedSubscriptionsGateway, useValue: gateway },
      ],
    });
  });

  afterEach(() => sessionStorage.clear());

  it('should load the first page with one main heading', async () => {
    await create();

    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(gateway.queries).toEqual([{ status: 'ALL', page: 1 }]);
    expect(rows().length).toBe(2);
  });

  it('should show the client with the minimum data and the saga status', async () => {
    await create();

    const row = rows()[0].textContent ?? '';
    expect(row).toContain('Ana P.');
    expect(row).toContain('******300');
    expect(row).toContain('Cobro realizado');
    expect(row).toContain('Firma');
  });

  it('should offer managing the signature only when the backend allows it', async () => {
    await create();

    expect(rows()[0].querySelector('a')?.textContent).toContain('Gestionar firma');
    expect(rows()[0].querySelector('a')?.getAttribute('href')).toBe(
      `/subscriptions/${SUBSCRIPTION.id}`,
    );
    expect(rows()[1].querySelector('a')?.textContent).toContain('Ver detalle');
  });

  it('should not offer managing the signature while the charge is being refunded', async () => {
    gateway.items = [COMPENSATING];
    await create();

    expect(rows()[0].querySelector('a')?.textContent).toContain('Ver detalle');
    expect(rows()[0].textContent).toContain('Cobro en devolución');
  });

  it('should tolerate a client that could not be read', async () => {
    gateway.items = [{ ...SUBSCRIPTION, client: null }];
    await create();

    expect(rows()[0].querySelector('td')?.textContent).toContain('—');
  });

  it('should filter by status, back on the first page', async () => {
    gateway.total = 45;
    await create();
    button('Siguiente').click();
    await settle();

    const select = el.querySelector<HTMLSelectElement>('#sub-status')!;
    select.value = 'EMITIDA';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect(gateway.queries.at(1)).toEqual({ status: 'ALL', page: 2 });
    expect(gateway.queries.at(-1)).toEqual({ status: 'EMITIDA', page: 1 });
  });

  it('should page with previous and next, disabled at the ends', async () => {
    gateway.total = 45;
    await create();

    expect(text()).toContain('Página 1 de 3');
    expect(button('Anterior').disabled).toBeTrue();
    button('Siguiente').click();
    button('Siguiente').click();
    await settle();

    expect(text()).toContain('Página 3 de 3');
    expect(button('Siguiente').disabled).toBeTrue();
  });

  it('should show a loading state while the page arrives', async () => {
    gateway.holdList = new Subject<SubscriptionPage>();
    await create();

    expect(text()).toContain('Cargando suscripciones');
    expect(rows().length).toBe(0);
  });

  it('should show an empty state when nothing matches', async () => {
    gateway.items = [];
    await create();

    expect(text()).toContain('No hay suscripciones con este filtro');
    expect(el.querySelector('table')).toBeNull();
  });

  it('should show a server error with a way to reload', async () => {
    gateway.failList = new ApiError('server', 500);
    await create();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('problema del servidor');
    gateway.failList = null;
    button('Volver a cargar').click();
    await settle();
    expect(rows().length).toBe(2);
  });

  it('should send an expired session to the login and come back to the list', async () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const session = TestBed.inject(SessionStore);
    session.start({
      token: 't',
      user: { id: '1', name: 'A', role: 'ASESOR' },
      expiresAt: Date.now() + 60_000,
    });
    await create();

    session.expire();
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/subscriptions' },
    });
  });
});
