import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ApiError } from '@core/http/api-error';
import { ReconciliationGateway } from '../data-access/reconciliation.gateway';
import { FakeReconciliationGateway } from '../testing/fake-reconciliation.gateway';
import { DETAIL, FAILED, RECONCILED, WITH_DIFFERENCE } from '../testing/fixtures';
import { DisbursementDetailPage } from './disbursement-detail-page';

describe('DisbursementDetailPage', () => {
  let fixture: ComponentFixture<DisbursementDetailPage>;
  let el: HTMLElement;
  let gateway: FakeReconciliationGateway;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const create = async () => {
    fixture = TestBed.createComponent(DisbursementDetailPage);
    el = fixture.nativeElement;
    await settle();
  };
  const text = () => el.textContent ?? '';
  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    );
  const writeNote = async (value: string) => {
    const area = el.querySelector<HTMLTextAreaElement>('#rc-note')!;
    area.value = value;
    area.dispatchEvent(new Event('input'));
    await settle();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await settle();
  };

  beforeEach(() => {
    sessionStorage.clear();
    gateway = new FakeReconciliationGateway();
    TestBed.configureTestingModule({
      imports: [DisbursementDetailPage],
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        { provide: ReconciliationGateway, useValue: gateway },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ disbursementId: DETAIL.id }) } },
        },
      ],
    });
  });

  afterEach(() => sessionStorage.clear());

  it('should show the event, policy, validation and payment with the idempotency key and the redeliveries', async () => {
    await create();

    expect(el.querySelectorAll('h1').length).toBe(1);
    for (const expected of [
      'Sismo',
      'Magnitud: 6.4',
      'bogota',
      'pol-1',
      'cli***01',
      'CORRESPONDE_PAGO',
      'sismo (v1)',
      'simpg_abc',
      'evt-1:pol-1',
      'ninguna volvió a pagar',
    ]) {
      expect(text()).toContain(expected);
    }
    expect(text()).toMatch(/5[.,]000[.,]000/);
  });

  it('should list the payment attempts, the ones that did not pay included', async () => {
    await create();

    const attempts = Array.from(el.querySelectorAll('tbody tr')).map((r) => r.textContent ?? '');
    expect(attempts.length).toBe(2);
    expect(attempts[0]).toContain('NO_DISPONIBLE');
    expect(attempts[1]).toContain('APROBADO');
  });

  it('should show dashes for what the command did not bring and never the destination account', async () => {
    await create();

    expect(text()).toContain('Monto asegurado');
    expect(text()).not.toMatch(/cta_|tok_/);
  });

  it('should reconcile and tell who did it, without asking for the attempts again', async () => {
    await create();

    button('Conciliar con la pasarela')!.click();
    await settle();

    expect(gateway.reconciled).toEqual([DETAIL.id]);
    expect(text()).toContain('Conciliado: el pago coincide con el extracto');
    expect(text()).toContain('Olga Operadora');
    expect(gateway.detailCalls).toBe(1);
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('should show the difference and offer to escalate it when the statement does not match', async () => {
    gateway.reconcileResult = { ...WITH_DIFFERENCE, id: DETAIL.id };
    await create();
    expect(button('Escalar')).toBeUndefined();

    button('Conciliar con la pasarela')!.click();
    await settle();

    expect(text()).toContain('El monto del extracto no coincide');
    expect(text()).toContain('Monto en la pasarela');
    expect(text()).toMatch(/4[.,]900[.,]000/);
    expect(button('Escalar')).toBeDefined();
  });

  it('should say nothing changed when the gateway has no such payment', async () => {
    gateway.failReconcile = new ApiError('validation', 409, 'EXTRACTO_SIN_PAGO');
    await create();

    button('Conciliar con la pasarela')!.click();
    await settle();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se cambió nada');
    expect(text()).toContain('Pendiente');
  });

  it('should not offer to reconcile a payment that did not go through', async () => {
    gateway.detail = { ...DETAIL, ...FAILED, paymentAttempts: [] };
    await create();

    expect(button('Conciliar con la pasarela')).toBeUndefined();
    expect(text()).toContain('Solo se concilian los desembolsos pagados');
    expect(text()).toContain('INTENTOS_AGOTADOS');
  });

  it('should escalate a difference with a note and show it afterwards', async () => {
    gateway.detail = { ...DETAIL, ...WITH_DIFFERENCE, paymentAttempts: DETAIL.paymentAttempts };
    await create();

    await writeNote('  El extracto dice 4,9 millones  ');

    expect(gateway.escalated).toEqual([{ id: DETAIL.id, note: 'El extracto dice 4,9 millones' }]);
    expect(text()).toContain('Escalado. El equipo de pagos verá tu nota');
    expect(text()).toContain('Escalado al equipo de pagos');
    expect((el.querySelector('#rc-note') as HTMLTextAreaElement).value).toBe('');
  });

  it('should require a note and not call the backend without one', async () => {
    gateway.detail = { ...DETAIL, ...WITH_DIFFERENCE, paymentAttempts: [] };
    await create();

    await writeNote('   ');

    expect(gateway.escalated).toEqual([]);
    expect(el.querySelector('#rc-note-error')?.textContent).toContain('1 a 500');
    expect(el.querySelector('#rc-note')!.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#rc-note')!.getAttribute('aria-describedby')).toContain(
      'rc-note-error',
    );
  });

  it('should show the escalation error from the backend', async () => {
    gateway.detail = { ...DETAIL, ...WITH_DIFFERENCE, paymentAttempts: [] };
    gateway.failEscalate = new ApiError('validation', 409, 'DESEMBOLSO_SIN_DIFERENCIA');
    await create();

    await writeNote('nota');

    expect(el.querySelector('#rc-note-error')?.textContent).toContain('con diferencia');
  });

  it('should show a reconciled disbursement without the escalate form', async () => {
    gateway.detail = { ...DETAIL, ...RECONCILED, paymentAttempts: [] };
    await create();

    expect(text()).toContain('Conciliado');
    expect(el.querySelector('form')).toBeNull();
  });

  it('should tell a missing disbursement apart and not offer to reload it', async () => {
    gateway.failDetail = new ApiError('not-found', 404);
    await create();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('no existe');
    expect(button('Volver a cargar')).toBeUndefined();
  });

  it('should offer to reload after a server failure', async () => {
    gateway.failDetail = new ApiError('server', 500);
    await create();
    gateway.failDetail = null;

    button('Volver a cargar')!.click();
    await settle();

    expect(text()).toContain('Sismo');
  });
});
