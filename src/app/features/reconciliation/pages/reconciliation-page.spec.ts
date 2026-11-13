import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { FileSaver } from '@shared/download';
import { Subject } from 'rxjs';
import { ReconciliationGateway } from '../data-access/reconciliation.gateway';
import { DisbursementPage, NO_FILTERS } from '../domain/models';
import { FakeReconciliationGateway } from '../testing/fake-reconciliation.gateway';
import { PENDING, SUMMARY } from '../testing/fixtures';
import { ReconciliationPage } from './reconciliation-page';

describe('ReconciliationPage', () => {
  let fixture: ComponentFixture<ReconciliationPage>;
  let el: HTMLElement;
  let gateway: FakeReconciliationGateway;
  const saved: { name: string; size: number }[] = [];

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const create = async () => {
    fixture = TestBed.createComponent(ReconciliationPage);
    el = fixture.nativeElement;
    await settle();
  };
  const text = () => el.textContent ?? '';
  const rows = () => Array.from(el.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    )!;
  const choose = async (selector: string, value: string) => {
    const field = el.querySelector<HTMLSelectElement | HTMLInputElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
    await settle();
  };

  beforeEach(() => {
    sessionStorage.clear();
    gateway = new FakeReconciliationGateway();
    saved.length = 0;
    TestBed.configureTestingModule({
      imports: [ReconciliationPage],
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        { provide: ReconciliationGateway, useValue: gateway },
        {
          provide: FileSaver,
          useValue: { save: (b: Blob, name: string) => saved.push({ name, size: b.size }) },
        },
      ],
    });
  });

  afterEach(() => sessionStorage.clear());

  it('should load the first page with one main heading and the summary of the same filters', async () => {
    await create();

    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(gateway.queries).toEqual([{ ...NO_FILTERS, page: 1 }]);
    expect(gateway.summaryFilters).toEqual([NO_FILTERS]);
    expect(rows().length).toBe(3);
  });

  it('should show the event, policy, validation, payment and reconciliation of each disbursement', async () => {
    await create();

    const first = rows()[0].textContent ?? '';
    expect(first).toContain('Sismo');
    expect(first).toContain('Magnitud: 6.4');
    expect(first).toContain('bogota');
    expect(first).toContain('pol-1');
    expect(first).toContain('CORRESPONDE_PAGO');
    expect(first).toMatch(/5[.,]000[.,]000/); // el separador depende del LOCALE_ID
    expect(first).toContain('Pagado');
    expect(first).toContain('simpg_abc');
    expect(first).toContain('Pendiente');
  });

  it('should never show the whole client, the key of the account or tokens', async () => {
    await create();

    expect(text()).toContain('cli***01');
    expect(text()).not.toMatch(/cli-0|cta_|tok_/);
  });

  it('should prove there are no duplicate payments, with text and not only color', async () => {
    await create();

    expect(text()).toContain('Claves con más de un pago');
    expect(text()).toContain('Sin pagos duplicados');

    gateway.summaryResult = { ...SUMMARY, keysWithMultiplePayments: 2 };
    fixture.componentInstance['load']();
    await settle();
    expect(text()).toContain('Hay pagos duplicados');
  });

  it('should hide the summary and still show the list if the summary fails', async () => {
    gateway.failSummary = new ApiError('server', 500);
    await create();

    expect(rows().length).toBe(3);
    expect(text()).not.toContain('Claves con más de un pago');
  });

  it('should link each disbursement to its detail', async () => {
    await create();

    expect(rows()[0].querySelector('a')!.getAttribute('href')).toBe(
      `/reconciliation/${PENDING.id}`,
    );
  });

  it('should filter by type, status and dates, back on the first page', async () => {
    gateway.total = 60;
    await create();
    button('Siguiente').click();
    await settle();

    await choose('#rc-type', 'inundacion');
    await choose('#rc-status', 'WITH_DIFFERENCE');
    await choose('#rc-from', '2026-11-01');
    await choose('#rc-to', '2026-11-10');

    expect(gateway.queries.at(1)?.page).toBe(2);
    expect(gateway.queries.at(-1)).toEqual({
      from: '2026-11-01',
      to: '2026-11-10',
      eventType: 'inundacion',
      reconciliation: 'WITH_DIFFERENCE',
      page: 1,
    });
    expect(gateway.summaryFilters.at(-1)?.eventType).toBe('inundacion');
  });

  it('should offer to clear the filters only when there are some', async () => {
    await create();
    expect(button('Quitar filtros')).toBeUndefined();

    await choose('#rc-type', 'sismo');
    expect(button('Quitar filtros')).toBeDefined();
    button('Quitar filtros').click();
    await settle();

    expect(gateway.queries.at(-1)).toEqual({ ...NO_FILTERS, page: 1 });
    expect(button('Quitar filtros')).toBeUndefined();
  });

  it('should page with previous and next, disabled at the ends', async () => {
    gateway.total = 60;
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
    gateway.holdList = new Subject<DisbursementPage>();
    await create();

    expect(text()).toContain('Cargando desembolsos');
    expect(rows().length).toBe(0);
  });

  it('should show an empty state when nothing matches', async () => {
    gateway.items = [];
    await create();

    expect(text()).toContain('No hay desembolsos con estos filtros');
    expect(el.querySelector('table')).toBeNull();
  });

  it('should show an error with a way to reload', async () => {
    gateway.failList = new ApiError('server', 500);
    await create();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('problema del servidor');
    gateway.failList = null;
    button('Volver a cargar').click();
    await settle();
    expect(rows().length).toBe(3);
  });

  it('should tell an operator-only screen apart from a server failure', async () => {
    gateway.failList = new ApiError('forbidden', 403);
    await create();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Solo los operadores');
  });

  it('should export the report in the chosen format with the filters, and save the file', async () => {
    await create();
    await choose('#rc-type', 'sismo');

    button('Exportar CSV').click();
    await settle();
    button('Exportar PDF').click();
    await settle();

    expect(gateway.exports.map((e) => e.format)).toEqual(['csv', 'pdf']);
    expect(gateway.exports[0].filters.eventType).toBe('sismo');
    expect(saved.map((f) => f.name)).toEqual([
      'conciliacion-desembolsos.csv',
      'conciliacion-desembolsos.pdf',
    ]);
    expect(text()).toContain('El reporte se descargó');
  });

  it('should not start a second export while one is running, and report a failure', async () => {
    gateway.holdExport = new Subject<Blob>();
    await create();

    button('Exportar CSV').click();
    await settle();
    expect(button('Exportar PDF').disabled).toBeTrue();
    expect(text()).toContain('Generando el reporte');
    fixture.componentInstance['export']('pdf');
    expect(gateway.exports.length).toBe(1);

    gateway.holdExport.error(new ApiError('server', 500));
    await settle();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos generar el reporte',
    );
    expect(button('Exportar CSV').disabled).toBeFalse();
  });

  it('should send an expired session to the login and come back to the list', async () => {
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
      queryParams: { returnUrl: '/reconciliation' },
    });
  });
});
