import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { Subject } from 'rxjs';
import { FailedPaymentsGateway } from '../data-access/failed-payments.gateway';
import { CasePage } from '../domain/models';
import { CASE } from '../testing/fixtures';
import { FakeFailedPaymentsGateway } from '../testing/fake-failed-payments.gateway';
import { InboxPage } from './inbox-page';

describe('InboxPage', () => {
  let fixture: ComponentFixture<InboxPage>;
  let el: HTMLElement;
  let gateway: FakeFailedPaymentsGateway;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const create = async () => {
    fixture = TestBed.createComponent(InboxPage);
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
    gateway = new FakeFailedPaymentsGateway();
    TestBed.configureTestingModule({
      imports: [InboxPage],
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        { provide: FailedPaymentsGateway, useValue: gateway },
      ],
    });
  });

  afterEach(() => sessionStorage.clear());

  it('should load the first page of open cases with one main heading', async () => {
    await create();

    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(gateway.queries).toEqual([{ status: 'OPEN', dueSoonOnly: false, page: 1 }]);
    expect(rows().length).toBe(2);
  });

  it('should show amount, attempts, reason and grace, and highlight the case due soon with text', async () => {
    await create();

    const [urgent, normal] = rows();
    expect(urgent.classList).toContain('fp__row--urgent');
    expect(urgent.textContent).toContain('Vence en menos de 24 h');
    expect(normal.classList).not.toContain('fp__row--urgent');
    expect(normal.textContent).toContain('Fondos insuficientes');
    expect(normal.textContent).toMatch(/55[.,]500/); // el separador depende del LOCALE_ID
    expect(text()).not.toContain('tok_');
  });

  it('should link each case to its detail', async () => {
    await create();

    const link = rows()[1].querySelector<HTMLAnchorElement>('a')!;
    expect(link.getAttribute('href')).toBe(`/failed-payments/${CASE.id}`);
  });

  it('should filter by status and by due soon, back on the first page', async () => {
    gateway.total = 45;
    await create();
    button('Siguiente').click();
    await settle();

    const select = el.querySelector<HTMLSelectElement>('#fp-status')!;
    select.value = 'EXPIRED';
    select.dispatchEvent(new Event('change'));
    await settle();
    const check = el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    check.click();
    await settle();

    expect(gateway.queries.at(1)).toEqual({ status: 'OPEN', dueSoonOnly: false, page: 2 });
    expect(gateway.queries.at(-2)).toEqual({ status: 'EXPIRED', dueSoonOnly: false, page: 1 });
    expect(gateway.queries.at(-1)).toEqual({ status: 'EXPIRED', dueSoonOnly: true, page: 1 });
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
    gateway.holdList = new Subject<CasePage>();
    await create();

    expect(text()).toContain('Cargando cobros fallidos');
    expect(rows().length).toBe(0);
  });

  it('should show an empty state when nothing matches', async () => {
    gateway.cases = [];
    await create();

    expect(text()).toContain('No hay cobros fallidos con estos filtros');
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

  it('should send an expired session to the login and come back to the inbox', async () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const session = TestBed.inject(SessionStore);
    session.start({
      token: 't',
      user: { id: '1', name: 'A', role: 'OPERADOR' },
      expiresAt: Date.now() + 60_000,
    });
    await create();

    session.expire();
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/failed-payments' },
    });
  });
});
