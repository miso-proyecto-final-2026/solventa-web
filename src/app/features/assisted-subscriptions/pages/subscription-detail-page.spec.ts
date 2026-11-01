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

  describe('enlace de firma por correo', () => {
    it('should send it and say it was requested, without the address', async () => {
      await create();
      await click('Gestionar firma');

      await click('Enviar por correo');

      expect(gateway.linksSent).toBe(1);
      expect(text()).toContain('Solicitamos el envío del enlace');
      expect(button('Volver a enviar en 60 s')?.disabled).toBeTrue();
    });

    it('should ask for confirmation before replacing an active link', async () => {
      gateway.detail = {
        ...SUBSCRIPTION,
        signatureLink: { status: 'ACTIVO', expiresAt: new Date(), createdAt: new Date() },
      };
      await create();
      await click('Gestionar firma');

      await click('Enviar por correo');
      expect(gateway.linksSent).toBe(0);
      expect(text()).toContain('el anterior dejará de servir');

      await click('Enviar otro enlace');
      expect(gateway.linksSent).toBe(1);
    });

    it('should explain each failure and offer signing on screen', async () => {
      gateway.failLink = new ApiError('server', 503, 'ENLACES_NO_CONFIGURADOS');
      await create();
      await click('Gestionar firma');

      await click('Enviar por correo');

      expect(text()).toContain('Firma en pantalla con el cliente presente');
      expect(button('Abrir el documento')).toBeDefined();
    });

    it('should wait when the server says it was sent too soon', async () => {
      gateway.failLink = new ApiError('server', 429, 'CORREO_MUY_SEGUIDO');
      await create();
      await click('Gestionar firma');

      await click('Enviar por correo');

      expect(text()).toContain('Espera un minuto');
      expect(button('Volver a enviar en 60 s')?.disabled).toBeTrue();
    });
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

  describe('igual que la app móvil', () => {
    const requestCode = async () => {
      await review();
      await click('Enviar código al cliente');
    };

    it('should reload the hash and ask for a new review when the document changed', async () => {
      await create();
      await requestCode();
      gateway.failSign = new ApiError('validation', 409, 'DOCUMENTO_ALTERADO');
      gateway.document = { ...gateway.document, hash: 'b'.repeat(64) };

      await signWith('123456');

      expect(text()).toContain('El documento cambió');
      expect(el.querySelector<HTMLInputElement>('input[name="reviewed"]')!.checked).toBeFalse();
      expect(el.querySelector('iframe')).toBeNull();

      gateway.failSign = null;
      await click('Abrir el documento');
      el.querySelector<HTMLInputElement>('input[name="reviewed"]')!.click();
      await settle();
      await signWith('123456');
      expect(gateway.signs[1].request.hash).toBe('b'.repeat(64));
    });

    it('should keep only the digits of a pasted code and require all of them', async () => {
      await create();
      await requestCode();

      await typeCode('123 45');
      expect(el.querySelector<HTMLInputElement>('#sub-code')!.value).toBe('12345');
      expect(button('Firmar')!.disabled).toBeTrue();

      await signWith('123-456');
      expect(gateway.signs[0].request.code).toBe('123456');
    });

    it('should check the saga when the connection failed while signing', async () => {
      await create();
      await requestCode();
      gateway.failSign = new ApiError('network', 0);
      gateway.detail = ISSUED;
      const calls = gateway.detailCalls;

      await signWith('123456');

      expect(gateway.detailCalls).toBe(calls + 1);
      expect(text()).not.toContain('No hay conexión');
      expect(button('Descargar póliza firmada')).toBeDefined();
    });

    it('should keep the error when the connection failed and the saga is still unsigned', async () => {
      await create();
      await requestCode();
      gateway.failSign = new ApiError('network', 0);

      await signWith('123456');

      expect(text()).toContain('No hay conexión');
      expect(button('Firmar')).toBeDefined();
    });

    it('should say the code was sent and wait before sending it again', () => {
      jasmine.clock().install();
      try {
        fixture = TestBed.createComponent(SubscriptionDetailPage);
        el = fixture.nativeElement;
        fixture.detectChanges();
        button('Gestionar firma')!.click();
        fixture.detectChanges();
        button('Abrir el documento')!.click();
        fixture.detectChanges();
        el.querySelector<HTMLInputElement>('input[name="reviewed"]')!.click();
        fixture.detectChanges();
        button('Enviar código al cliente')!.click();
        fixture.detectChanges();

        expect(text()).toContain('Código enviado');
        expect(button('Volver a enviar en 60 s')!.disabled).toBeTrue();

        jasmine.clock().tick(60_000);
        fixture.detectChanges();
        expect(button('Volver a enviar el código')!.disabled).toBeFalse();
        fixture.destroy();
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('should keep checking until the document is generated', () => {
      jasmine.clock().install();
      try {
        gateway.detail = {
          ...SUBSCRIPTION,
          canManageSignature: false,
          policy: { number: 'SOLV-1', status: 'PENDIENTE_FIRMA', documentStatus: 'PENDIENTE' },
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

  describe('certificado y correo de confirmación', () => {
    it('should appear only once the policy is issued', async () => {
      await create();
      expect(text()).not.toContain('Certificado de cobertura');

      gateway.detail = ISSUED;
      await click('Volver a cargar');

      expect(text()).toContain('Certificado de cobertura');
      expect(text()).toContain('correo de confirmación');
    });

    it('should not appear while the policy is not in force', async () => {
      gateway.detail = { ...ISSUED, policy: { ...ISSUED.policy!, status: 'ANULADA' } };
      await create();

      expect(text()).not.toContain('Ver certificado');
    });

    it('should show the certificate in the page', async () => {
      gateway.detail = ISSUED;
      await create();

      await click('Ver certificado');

      expect(gateway.certificateCalls).toBe(1);
      expect(el.querySelector('iframe')?.getAttribute('title')).toBe('Certificado de cobertura');
    });

    it('should download it with the policy number in its name', async () => {
      gateway.detail = ISSUED;
      await create();
      const save = HTMLAnchorElement.prototype.click as jasmine.Spy;
      let name = '';
      save.and.callFake(function (this: HTMLAnchorElement) {
        name = this.download;
      });

      await click('Descargar certificado');

      expect(name).toBe('certificado-SOLV-2.pdf');
    });

    it('should explain a certificate that is not available yet', async () => {
      gateway.detail = ISSUED;
      gateway.failCertificate = new ApiError('validation', 409);
      await create();

      await click('Ver certificado');

      expect(text()).toContain('aún no está disponible');
    });

    it('should not say the email arrived, only that it was requested, and wait to resend', () => {
      jasmine.clock().install();
      try {
        gateway.detail = ISSUED;
        fixture = TestBed.createComponent(SubscriptionDetailPage);
        el = fixture.nativeElement;
        fixture.detectChanges();
        button('Reenviar correo al cliente')!.click();
        fixture.detectChanges();

        expect(gateway.resends).toBe(1);
        expect(text()).toContain('Solicitamos el reenvío');
        expect(button('Reenviar correo en 60 s')!.disabled).toBeTrue();

        jasmine.clock().tick(60_000);
        fixture.detectChanges();
        expect(button('Reenviar correo al cliente')!.disabled).toBeFalse();
        fixture.destroy();
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('should explain a resend rejected for being too soon, and also wait', () => {
      jasmine.clock().install();
      try {
        gateway.detail = ISSUED;
        gateway.failResend = new ApiError('server', 429, 'CORREO_MUY_SEGUIDO');
        fixture = TestBed.createComponent(SubscriptionDetailPage);
        el = fixture.nativeElement;
        fixture.detectChanges();
        button('Reenviar correo al cliente')!.click();
        fixture.detectChanges();

        expect(text()).toContain('Espera un minuto');
        expect(text()).not.toContain('Solicitamos el reenvío');
        expect(button('Reenviar correo en')!.disabled).toBeTrue();
        fixture.destroy();
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('should explain any other resend failure and allow retrying', async () => {
      gateway.detail = ISSUED;
      gateway.failResend = new ApiError('server', 500);
      await create();

      await click('Reenviar correo al cliente');

      expect(text()).toContain('problema del servidor');
      expect(button('Reenviar correo al cliente')!.disabled).toBeFalse();
    });
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
