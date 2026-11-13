import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ApiError } from '@core/http/api-error';
import { Subject } from 'rxjs';
import { AssistedReviewGateway } from '../data-access/assisted-review.gateway';
import { ReviewDetail } from '../domain/models';
import { FakeAssistedReviewGateway } from '../testing/fake-assisted-review.gateway';
import { DECIDED_DETAIL, DETAIL, EXPIRED_DETAIL, JUSTIFICATION } from '../testing/fixtures';
import { ReviewDetailPage } from './review-detail-page';

describe('ReviewDetailPage', () => {
  let fixture: ComponentFixture<ReviewDetailPage>;
  let el: HTMLElement;
  let gateway: FakeAssistedReviewGateway;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const create = async () => {
    fixture = TestBed.createComponent(ReviewDetailPage);
    el = fixture.nativeElement;
    document.body.appendChild(el);
    await settle();
  };
  const text = () => el.textContent ?? '';
  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    )!;
  const radio = (value: string) => el.querySelector<HTMLInputElement>(`#ar-decision-${value}`)!;
  const type = async (selector: string, value: string) => {
    const field = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await settle();
  };
  const choose = async (value: string) => {
    radio(value).click();
    await settle();
  };
  const review = async () => {
    button('Revisar decisión').click();
    await settle();
  };
  const confirm = async () => {
    button('Confirmar decisión').click();
    await settle();
  };

  beforeEach(() => {
    sessionStorage.clear();
    gateway = new FakeAssistedReviewGateway();
    TestBed.configureTestingModule({
      imports: [ReviewDetailPage],
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        { provide: AssistedReviewGateway, useValue: gateway },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ reviewId: DETAIL.id }) } },
        },
      ],
    });
  });

  afterEach(() => {
    el?.remove();
    sessionStorage.clear();
  });

  it('should show the client masked, the quote, the profile by levels and the reason', async () => {
    await create();

    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(text()).toContain('Ana María P.');
    expect(text()).toContain('******300');
    expect(text()).toContain('Microseguro de vida');
    expect(text()).toMatch(/40[.,]000[.,]000/);
    expect(text()).toContain('Muerte');
    expect(text()).toContain('Nivel de endeudamiento');
    expect(text()).toContain('Medio');
    expect(text()).toContain('Perfil real del cliente');
    expect(text()).toContain('Vigente');
    expect(text()).toContain('Datos incompletos o inconsistentes');
    expect(text()).toContain('El perfil del cliente no está disponible');
  });

  it('should never show profile figures or the full surname', async () => {
    await create();

    expect(text()).not.toMatch(/ratio|0[.,]\d{2}\b/i);
    expect(text()).not.toContain('Pérez');
  });

  it('should keep the case decidable without the profile and let the advisor reload it', async () => {
    gateway.failProfile = new ApiError('server', 500);
    await create();

    expect(text()).toContain('No pudimos cargar el perfil del cliente');
    expect(radio('APPROVED')).not.toBeNull();
    gateway.failProfile = null;
    button('Volver a cargar').click();
    await settle();
    expect(text()).toContain('Perfil real del cliente');
  });

  it('should keep the case decidable without the client summary', async () => {
    gateway.detail = { ...DETAIL, client: null };
    await create();

    expect(text()).toContain('No pudimos cargar los datos del cliente');
    expect(radio('APPROVED')).not.toBeNull();
  });

  it('should enable the three decisions on a valid quote', async () => {
    await create();

    expect(radio('APPROVED').disabled).toBeFalse();
    expect(radio('REJECTED').disabled).toBeFalse();
    expect(radio('ADJUSTED').disabled).toBeFalse();
  });

  it('should only enable rejecting when the quote expired, and say why', async () => {
    gateway.detail = EXPIRED_DETAIL;
    await create();

    expect(radio('APPROVED').disabled).toBeTrue();
    expect(radio('ADJUSTED').disabled).toBeTrue();
    expect(radio('REJECTED').disabled).toBeFalse();
    expect(radio('APPROVED').getAttribute('aria-describedby')).toBe('ar-expired-reason');
    expect(el.querySelector('#ar-expired-reason')?.textContent).toContain('venció');
    expect(text()).toContain('Solo se puede cerrar el caso; el cliente debe volver a cotizar');
  });

  it('should preselect rejecting with the suggested justification from the expired notice', async () => {
    gateway.detail = EXPIRED_DETAIL;
    await create();

    button('Cerrar por cotización vencida').click();
    await settle();

    expect(radio('REJECTED').checked).toBeTrue();
    const area = el.querySelector<HTMLTextAreaElement>('#ar-justification')!;
    expect(area.value).toContain('La cotización venció el');
    expect(document.activeElement).toBe(area);
  });

  it('should show the error summary with focus when nothing was filled in', async () => {
    await create();

    await review();

    const summary = el.querySelector('sol-error-summary')!;
    expect(summary.textContent).toContain('Elige aprobar, rechazar o ajustar');
    expect(summary.textContent).toContain('al menos 20 caracteres');
    expect(gateway.decisions).toEqual([]);
    expect(document.activeElement?.closest('sol-error-summary')).not.toBeNull();
  });

  it('should reject without justification and show the error next to the field', async () => {
    await create();
    await choose('REJECTED');

    await review();

    expect(el.querySelector('#ar-justification-error')?.textContent).toContain('al menos 20');
    expect(el.querySelector('#ar-justification')?.getAttribute('aria-invalid')).toBe('true');
    expect(gateway.decisions).toEqual([]);
  });

  it('should count the justification and ignore the surrounding spaces', async () => {
    await create();
    await type('#ar-justification', `   ${'a'.repeat(19)}   `);

    expect(text()).toContain('/2000');
    await choose('APPROVED');
    await review();

    expect(el.querySelector('#ar-justification-error')?.textContent).toContain('al menos 20');
  });

  it('should show the new amount field only when adjusting', async () => {
    await create();
    expect(el.querySelector('#ar-amount')).toBeNull();

    await choose('ADJUSTED');

    expect(el.querySelector('#ar-amount')).not.toBeNull();
    await choose('APPROVED');
    expect(el.querySelector('#ar-amount')).toBeNull();
  });

  it('should refuse an invalid amount, then accept a valid one', async () => {
    await create();
    await choose('ADJUSTED');
    await type('#ar-justification', JUSTIFICATION);

    await type('#ar-amount', '');
    await review();
    expect(el.querySelector('#ar-amount-error')?.textContent).toContain('Escribe el nuevo monto');

    await type('#ar-amount', '40000000');
    expect(el.querySelector('#ar-amount-error')?.textContent).toContain('menor que el actual');
    expect(gateway.decisions).toEqual([]);

    await type('#ar-amount', '30.000.000');
    await review();
    expect(el.querySelector('#ar-amount-error')).toBeNull();
    expect(text()).toContain('Se cobrará la prima ajustada');
  });

  it('should ask for an inline confirmation before approving, with what will happen', async () => {
    await create();
    await choose('APPROVED');
    await type('#ar-justification', JUSTIFICATION);

    await review();

    expect(text()).toContain('Se cobrará la prima de la cotización');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(gateway.decisions).toEqual([]);
  });

  it('should let the advisor go back to edit from the confirmation', async () => {
    await create();
    await choose('APPROVED');
    await type('#ar-justification', JUSTIFICATION);
    await review();

    button('Volver a editar').click();
    await settle();

    expect(button('Revisar decisión')).toBeDefined();
    expect(gateway.decisions).toEqual([]);
  });

  it('should approve once confirmed and show the decision read-only with a success notice', async () => {
    gateway.decided = {
      ...DECIDED_DETAIL,
      human: { ...DECIDED_DETAIL.human!, decision: 'APPROVED', adjustment: null },
    };
    await create();
    await choose('APPROVED');
    await type('#ar-justification', JUSTIFICATION);
    await review();

    await confirm();

    expect(gateway.decisions).toEqual([
      {
        id: DETAIL.id,
        request: { decision: 'APPROVED', justification: JUSTIFICATION, insuredAmount: null },
      },
    ]);
    expect(el.querySelector('sol-alert [role="status"]')?.textContent).toContain('Caso aprobado');
    expect(text()).toContain('Decisión del asesor');
    expect(text()).toContain('Laura Gómez');
    expect(el.querySelector('form')).toBeNull();
  });

  it('should adjust with the new amount and say the adjusted premium will be charged', async () => {
    gateway.decided = DECIDED_DETAIL;
    await create();
    await choose('ADJUSTED');
    await type('#ar-amount', '30000000');
    await type('#ar-justification', JUSTIFICATION);
    await review();

    await confirm();

    expect(gateway.decisions[0].request).toEqual({
      decision: 'ADJUSTED',
      justification: JUSTIFICATION,
      insuredAmount: 30_000_000,
    });
    expect(text()).toContain('Cobertura ajustada');
    expect(text()).toMatch(/30[.,]000[.,]000/);
    expect(text()).toMatch(/131[.,]250/);
  });

  it('should reject and say the purchase closes without charge', async () => {
    gateway.decided = {
      ...DECIDED_DETAIL,
      human: { ...DECIDED_DETAIL.human!, decision: 'REJECTED', adjustment: null },
    };
    await create();
    await choose('REJECTED');
    await type('#ar-justification', JUSTIFICATION);
    await review();
    expect(text()).toContain('La compra se cerrará sin cobro');

    await confirm();

    expect(text()).toContain('Caso rechazado. La compra se cerró sin cobro');
  });

  it('should not decide twice on a double click', async () => {
    const hold = new Subject<ReviewDetail>();
    gateway.holdDecide = hold;
    await create();
    await choose('APPROVED');
    await type('#ar-justification', JUSTIFICATION);
    await review();

    const confirmButton = button('Confirmar decisión');
    confirmButton.click();
    confirmButton.click();
    await settle();

    expect(gateway.decisions.length).toBe(1);
    expect(confirmButton.disabled).toBeTrue();
  });

  it('should say who decided first on 409 and reload the case', async () => {
    await create();
    await choose('APPROVED');
    await type('#ar-justification', JUSTIFICATION);
    await review();
    gateway.failDecide = new ApiError('validation', 409, 'REVISION_YA_DECIDIDA', [
      { field: 'asesor', reason: 'Laura Gómez' },
      { field: 'decidido_en', reason: '2026-11-10T09:30:00+00:00' },
    ]);
    gateway.detail = DECIDED_DETAIL;
    const loads = gateway.detailCalls;

    await confirm();

    expect(text()).toContain('Otro asesor ya decidió este caso');
    expect(text()).toContain('Laura Gómez');
    expect(gateway.detailCalls).toBe(loads + 1);
    expect(el.querySelector('form')).toBeNull();
  });

  it('should warn and reload when the quote expired while deciding', async () => {
    await create();
    await choose('APPROVED');
    await type('#ar-justification', JUSTIFICATION);
    await review();
    gateway.failDecide = new ApiError('validation', 409, 'COTIZACION_VENCIDA');
    gateway.detail = EXPIRED_DETAIL;

    await confirm();

    expect(el.querySelector('sol-alert [role="alert"]')?.textContent).toContain(
      'venció mientras decidías',
    );
    expect(radio('APPROVED').disabled).toBeTrue();
  });

  it('should explain an unconfirmable quote and keep the form to try again', async () => {
    await create();
    await choose('APPROVED');
    await type('#ar-justification', JUSTIFICATION);
    await review();
    gateway.failDecide = new ApiError('server', 503, 'COTIZACION_NO_DISPONIBLE');

    await confirm();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('confirmar la vigencia');
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('should show a decided case read-only, without the form', async () => {
    gateway.detail = DECIDED_DETAIL;
    await create();

    expect(el.querySelector('form')).toBeNull();
    expect(text()).toContain('Ajustado');
    expect(text()).toContain('Laura Gómez');
    expect(text()).toContain('Se ajustó el monto por el nivel de ingresos soportado.');
  });

  it('should explain a case that does not exist without offering to reload', async () => {
    gateway.failDetail = new ApiError('not-found', 404, 'REVISION_NO_ENCONTRADA');
    await create();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('no existe');
    expect(el.querySelector('[role="alert"] button')).toBeNull();
  });

  it('should explain a forbidden role', async () => {
    gateway.failDetail = new ApiError('forbidden', 403);
    await create();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Solo los asesores');
  });
});
