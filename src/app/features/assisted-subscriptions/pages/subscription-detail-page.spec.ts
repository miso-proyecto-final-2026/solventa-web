import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ApiError } from '@core/http/api-error';
import { AssistedSubscriptionsGateway } from '../data-access/assisted-subscriptions.gateway';
import { COMPENSATING, HASH, ISSUED, SUBSCRIPTION } from '../testing/fixtures';
import { FakeAssistedSubscriptionsGateway } from '../testing/fake-assisted-subscriptions.gateway';
import { SubscriptionDetailPage } from './subscription-detail-page';

describe('SubscriptionDetailPage', () => {
  let fixture: ComponentFixture<SubscriptionDetailPage>;
  let el: HTMLElement;
  let gateway: FakeAssistedSubscriptionsGateway;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const create = async () => {
    fixture = TestBed.createComponent(SubscriptionDetailPage);
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
  const review = async () => {
    await click('Gestionar firma');
    await click('Abrir el documento');
    el.querySelector<HTMLInputElement>('input[name="reviewed"]')!.click();
    await settle();
  };
  const typeCode = async (code: string) => {
    const input = el.querySelector<HTMLInputElement>('#sub-code')!;
    input.value = code;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const signWith = async (code: string) => {
    await typeCode(code);
    await click('Firmar');
  };

  beforeEach(() => {
    sessionStorage.clear();
    // La descarga real interrumpiría al navegador de pruebas.
    spyOn(HTMLAnchorElement.prototype, 'click');
    gateway = new FakeAssistedSubscriptionsGateway();
    TestBed.configureTestingModule({
      imports: [SubscriptionDetailPage],
      providers: [
        provideRouter([]),
        { provide: AssistedSubscriptionsGateway, useValue: gateway },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'sus-1' }) } },
        },
      ],
    });
  });

  afterEach(() => sessionStorage.clear());

  it('should show the saga progress with the current step marked', async () => {
    await create();

    const steps = el.querySelectorAll('.stepper__item');
    expect(steps.length).toBe(4);
    expect(steps[2].getAttribute('aria-current')).toBe('step');
    expect(steps[0].textContent).toContain('Decisión');
    expect(text()).toContain('Cobro realizado');
  });

  it('should mark every step as done once issued', async () => {
    gateway.detail = ISSUED;
    await create();

    expect(el.querySelectorAll('.stepper__item--done').length).toBe(4);
    expect(el.querySelector('[aria-current]')).toBeNull();
  });

  it('should offer managing the signature only when the backend allows it', async () => {
    await create();
    expect(button('Gestionar firma')).toBeDefined();
  });

  it('should not offer it while the charge is being refunded and should explain why', async () => {
    gateway.detail = COMPENSATING;
    await create();

    expect(button('Gestionar firma')).toBeUndefined();
    expect(text()).toContain('No se pudo verificar la identidad');
    expect(text()).toContain('devolución del cobro');
  });

  it('should keep the email option disabled with an explanation', async () => {
    await create();
    await click('Gestionar firma');

    const email = button('Enviar por correo')!;
    expect(email.disabled).toBeTrue();
    expect(email.getAttribute('aria-describedby')).toBe('sub-email-note');
    expect(el.querySelector('#sub-email-note')?.textContent).toContain('notificaciones');
  });

  it('should require opening the document, confirming it and asking for the code before signing', async () => {
    await create();
    await click('Gestionar firma');

    expect(el.querySelector<HTMLInputElement>('input[name="reviewed"]')!.disabled).toBeTrue();
    expect(button('Enviar código')!.disabled).toBeTrue();
    expect(el.querySelector<HTMLInputElement>('#sub-code')!.disabled).toBeTrue();

    await click('Abrir el documento');
    expect(el.querySelector('iframe')?.getAttribute('title')).toContain('Documento');
    el.querySelector<HTMLInputElement>('input[name="reviewed"]')!.click();
    await settle();
    expect(button('Firmar')!.disabled).toBeTrue();

    await click('Enviar código');
    expect(gateway.codeCalls).toBe(1);
    await typeCode('123456');
    expect(button('Firmar')!.disabled).toBeFalse();
  });

  it('should sign with the hash it showed and then offer the download', async () => {
    await create();
    await review();
    await click('Enviar código');
    gateway.detail = ISSUED;
    await signWith('123456');

    expect(gateway.signs).toEqual([
      { id: 'sus-1', request: { hash: HASH, reviewed: true, code: '123456' } },
    ]);
    expect(text()).toContain('Póliza firmada y emitida');
    await click('Descargar póliza firmada');
    expect(gateway.downloads).toBe(1);
  });

  it('should tell apart a signature that already existed', async () => {
    gateway.signResult = { ...gateway.signResult, replay: true };
    await create();
    await review();
    await click('Enviar código');
    await signWith('123456');

    expect(text()).toContain('se conserva la firma original');
  });

  it('should say how many attempts are left and clear the code', async () => {
    gateway.failSign = new ApiError('forbidden', 403, 'OTP_INVALIDO', [
      { field: 'codigo', reason: 'intentos restantes: 2' },
    ]);
    await create();
    await review();
    await click('Enviar código');
    await signWith('000000');

    const alert = el.querySelector('[role="alert"]')?.textContent ?? '';
    expect(alert).toContain('Intentos restantes: 2');
    expect(alert).not.toContain('permiso');
    expect(el.querySelector<HTMLInputElement>('#sub-code')!.value).toBe('');
  });

  it('should explain the failed signature and reload the saga', async () => {
    gateway.failSign = new ApiError('validation', 409, 'FIRMA_FALLIDA');
    await create();
    await review();
    await click('Enviar código');
    gateway.detail = COMPENSATING;
    const before = gateway.detailCalls;
    await signWith('000000');

    expect(gateway.detailCalls).toBe(before + 1);
    expect(text()).toContain('el cobro se devolverá');
    expect(button('Gestionar firma')).toBeUndefined();
  });

  it('should explain an expired signature', async () => {
    gateway.failCode = new ApiError('validation', 409, 'FIRMA_VENCIDA');
    await create();
    await review();
    await click('Enviar código');

    expect(text()).toContain('El plazo para firmar terminó');
  });

  it('should explain that the advisor has no relation with the client, without a reload', async () => {
    gateway.failDetail = new ApiError('forbidden', 403, 'ACCESO_DENEGADO');
    await create();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('no atendiste');
    expect(button('Volver a cargar')).toBeUndefined();
  });

  it('should show a service failure with a way to reload', async () => {
    gateway.failDetail = new ApiError('server', 500);
    await create();

    expect(text()).toContain('problema del servidor');
    gateway.failDetail = null;
    await click('Volver a cargar');
    expect(text()).toContain('Cobro realizado');
  });

  it('should explain a download that failed', async () => {
    gateway.detail = ISSUED;
    gateway.failDownload = new ApiError('validation', 409);
    await create();
    await click('Descargar póliza firmada');

    expect(text()).toContain('aún no está disponible');
  });

  it('should keep checking while the saga advances, and stop when it settles', () => {
    jasmine.clock().install();
    try {
      gateway.detail = {
        ...SUBSCRIPTION,
        status: 'EN_PROGRESO',
        step: 'DECISION',
        chargeStatus: null,
      };
      fixture = TestBed.createComponent(SubscriptionDetailPage);
      expect(gateway.detailCalls).toBe(1);

      jasmine.clock().tick(3000);
      expect(gateway.detailCalls).toBe(2);

      gateway.detail = SUBSCRIPTION;
      jasmine.clock().tick(3000);
      expect(gateway.detailCalls).toBe(3);
      jasmine.clock().tick(30000);
      expect(gateway.detailCalls).toBe(3);
      fixture.destroy();
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
