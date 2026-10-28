import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ApiError } from '@core/http/api-error';
import { Subject } from 'rxjs';
import { FailedPaymentsGateway } from '../data-access/failed-payments.gateway';
import { RetryResult } from '../domain/models';
import { DETAIL, DETAIL_WITH_PENDING_RETRY, NOTE, RETRY_APPROVED } from '../testing/fixtures';
import { FakeFailedPaymentsGateway } from '../testing/fake-failed-payments.gateway';
import { CaseDetailPage } from './case-detail-page';

describe('CaseDetailPage', () => {
  let fixture: ComponentFixture<CaseDetailPage>;
  let el: HTMLElement;
  let gateway: FakeFailedPaymentsGateway;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const create = async () => {
    fixture = TestBed.createComponent(CaseDetailPage);
    el = fixture.nativeElement;
    await settle();
  };
  const text = () => el.textContent ?? '';
  const retryButton = () =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      /Reintentar cobro|Reintentando/.test(b.textContent ?? ''),
    )!;
  const writeNote = async (value: string) => {
    const area = el.querySelector<HTMLTextAreaElement>('#fp-note')!;
    area.value = value;
    area.dispatchEvent(new Event('input'));
    await settle();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await settle();
  };

  beforeEach(() => {
    sessionStorage.clear();
    gateway = new FakeFailedPaymentsGateway();
    TestBed.configureTestingModule({
      imports: [CaseDetailPage],
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        { provide: FailedPaymentsGateway, useValue: gateway },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ caseId: DETAIL.id }) } },
        },
      ],
    });
  });

  afterEach(() => sessionStorage.clear());

  it('should show the summary, the attempt history with the gateway code and no contact data', async () => {
    await create();

    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(text()).toContain('Fondos insuficientes');
    expect(text()).toContain('FONDOS_INSUFICIENTES');
    expect(text()).toContain('VISA •••• 4242');
    expect(text()).toContain('Cobro original');
    expect(text()).not.toMatch(/@|celular|correo/i);
  });

  it('should retry with an idempotency key and show the approval', async () => {
    await create();

    retryButton().click();
    await settle();

    expect(gateway.retries.length).toBe(1);
    expect(gateway.retries[0].caseId).toBe(DETAIL.id);
    expect(gateway.retries[0].key).toMatch(/^[0-9a-f-]{36}$/);
    expect(text()).toContain('Cobro aprobado');
    expect(gateway.detailCalls).toBe(2); // se recarga el historial
  });

  it('should disable the button while the retry is in flight, so a double click charges once', async () => {
    const hold = new Subject<RetryResult>();
    gateway.holdRetry = hold;
    await create();

    retryButton().click();
    await settle();
    retryButton().click();
    await settle();

    expect(retryButton().disabled).toBeTrue();
    expect(gateway.retries.length).toBe(1);
    hold.next(RETRY_APPROVED);
    hold.complete();
    await settle();
    expect(text()).toContain('Cobro aprobado');
  });

  it('should reuse the same key after a network failure, and use a new one after a decline', async () => {
    gateway.failRetry = new ApiError('network', 0);
    await create();

    retryButton().click();
    await settle();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('conexión');

    gateway.failRetry = null;
    gateway.retryResult = {
      ...RETRY_APPROVED,
      outcome: 'DECLINED',
      caseStatus: 'PENDING',
      declineReason: 'Tarjeta bloqueada',
    };
    retryButton().click();
    await settle();
    retryButton().click();
    await settle();

    const [first, second, third] = gateway.retries.map((r) => r.key);
    expect(second).toBe(first);
    expect(third).not.toBe(second);
    expect(text()).toContain('rechazó el cobro otra vez: Tarjeta bloqueada');
  });

  it('should tell the gateway being down apart from a decline', async () => {
    gateway.retryResult = {
      outcome: 'IN_PROGRESS',
      gatewayDetail: 'UNAVAILABLE',
      declineReason: null,
      caseStatus: 'PENDING',
      replay: false,
    };
    await create();

    retryButton().click();
    await settle();

    expect(text()).toContain('no está disponible');
    expect(text()).not.toContain('rechazó');
  });

  it('should not offer the retry on a recovered case and explain a 409', async () => {
    gateway.failRetry = new ApiError('validation', 409, 'CASO_YA_RECUPERADO');
    await create();
    retryButton().click();
    await settle();
    expect(text()).toContain('ya se recuperó');

    gateway.detail = { ...DETAIL, status: 'RECOVERED', grace: null };
    fixture.destroy();
    await create();
    expect(retryButton().disabled).toBeTrue();
  });

  it('should disable the retry while one is pending, say why and enable it once resolved', async () => {
    gateway.detail = DETAIL_WITH_PENDING_RETRY;
    await create();

    const hint = el.querySelector('#fp-retry-pending');
    expect(retryButton().disabled).toBeTrue();
    expect(retryButton().getAttribute('aria-describedby')).toBe('fp-retry-pending');
    expect(hint?.textContent).toContain('Hay un reintento en proceso');
    retryButton().click();
    await settle();
    expect(gateway.retries.length).toBe(0);

    gateway.detail = {
      ...DETAIL_WITH_PENDING_RETRY,
      charges: DETAIL_WITH_PENDING_RETRY.charges.map((c) => ({ ...c, status: 'RECHAZADA' })),
    };
    Array.from(el.querySelectorAll<HTMLButtonElement>('#fp-retry-pending button'))[0].click();
    await settle();
    expect(retryButton().disabled).toBeFalse();
    expect(retryButton().hasAttribute('aria-describedby')).toBeFalse();
    expect(el.querySelector('#fp-retry-pending')).toBeNull();
  });

  it('should save a note with its author and date and clear the field', async () => {
    await create();

    await writeNote('  Cliente contactado  ');

    expect(gateway.notes).toEqual([{ caseId: DETAIL.id, text: 'Cliente contactado' }]);
    expect(text()).toContain(NOTE.authorName);
    expect(el.querySelector<HTMLTextAreaElement>('#fp-note')!.value).toBe('');
    expect(text()).toContain('Nota guardada');
  });

  it('should not send an empty note and explain a note with a card number', async () => {
    await create();

    await writeNote('   ');
    expect(gateway.notes.length).toBe(0);
    expect(text()).toContain('1 a 1000');

    gateway.failNote = new ApiError('validation', 422, 'DATO_DE_TARJETA_NO_PERMITIDO');
    await writeNote('paga con 4111111111111111');
    expect(text()).toContain('no puede llevar números de tarjeta');
    expect(el.querySelector('#fp-note')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('should explain a case that does not exist without offering to reload', async () => {
    gateway.failDetail = new ApiError('not-found', 404, 'CASO_NO_ENCONTRADO');
    await create();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('no existe');
    expect(text()).not.toContain('Volver a cargar');
  });
});
