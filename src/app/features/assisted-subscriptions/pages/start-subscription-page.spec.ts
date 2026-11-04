import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ApiError } from '@core/http/api-error';
import { Subject } from 'rxjs';
import { AssistedSubscriptionsGateway } from '../data-access/assisted-subscriptions.gateway';
import { FakeAssistedSubscriptionsGateway } from '../testing/fake-assisted-subscriptions.gateway';
import { StartSubscriptionPage } from './start-subscription-page';

const CARD = '4242 4242 4242 4242';
const AMEX = '3782 822463 10005';

/** Vencimiento futuro calculado (diciembre del año siguiente): no depende de la fecha de hoy. */
const nextYearExpiry = () => `12${String((new Date().getFullYear() + 1) % 100).padStart(2, '0')}`;

describe('StartSubscriptionPage', () => {
  let fixture: ComponentFixture<StartSubscriptionPage>;
  let el: HTMLElement;
  let gateway: FakeAssistedSubscriptionsGateway;
  let navigate: jasmine.Spy;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const cardInput = () => el.querySelector<HTMLInputElement>('#sub-card')!;
  const type = (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const fill = async (
    card = CARD,
    accept = true,
    { cvc = '123', expiry = nextYearExpiry() }: { cvc?: string; expiry?: string } = {},
  ) => {
    type('#sub-card', card);
    await settle(); // la franquicia define cuántos dígitos admite el CVC
    type('#sub-cvc', cvc);
    type('#sub-expiry', expiry);
    const check = el.querySelector<HTMLInputElement>('#sub-accepted')!;
    if (check.checked !== accept) check.click();
    await settle();
  };
  const submit = async () => {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();
  };

  beforeEach(async () => {
    sessionStorage.clear();
    gateway = new FakeAssistedSubscriptionsGateway();
    TestBed.configureTestingModule({
      imports: [StartSubscriptionPage],
      providers: [
        provideRouter([]),
        { provide: AssistedSubscriptionsGateway, useValue: gateway },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ quoteId: 'cot-1' }) } },
        },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(StartSubscriptionPage);
    el = fixture.nativeElement;
    await settle();
  });

  afterEach(() => sessionStorage.clear());

  it('should send only the token, never the card number, and go to the detail', async () => {
    await fill();
    await submit();

    const { request } = gateway.starts[0];
    expect(request.quoteId).toBe('cot-1');
    expect(request.paymentToken).toMatch(/^tok_sim_/);
    expect(request.frequency).toBe('ANUAL');
    expect(request.termsAccepted).toBeTrue();
    expect(JSON.stringify(gateway.starts)).not.toContain('4242');
    expect(navigate).toHaveBeenCalledWith(['/subscriptions', 'sus-nueva']);
  });

  it('should clear the card field when sending and keep it out of the session storage', async () => {
    gateway.failStart = new ApiError('server', 500);
    await fill();
    await submit();

    expect(cardInput().value).toBe('');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('4242');
  });

  it('should mask the CVC and the expiry while typing', () => {
    expect(el.querySelector<HTMLInputElement>('#sub-cvc')!.type).toBe('password');
    expect(el.querySelector<HTMLInputElement>('#sub-expiry')!.type).toBe('password');
  });

  it('should require 4 digits in the CVC for an AMEX card', async () => {
    await fill(AMEX, true, { cvc: '123' });
    await submit();

    expect(gateway.starts.length).toBe(0);
    expect(el.querySelector('#sub-cvc-error')?.textContent).toContain('4 dígitos');
  });

  it('should accept a 4 digit CVC for AMEX and cut it to 3 for the rest', async () => {
    await fill(AMEX, true, { cvc: '1234' });
    await submit();
    expect(gateway.starts.length).toBe(1);

    await fill(CARD, true, { cvc: '1234' });
    expect(el.querySelector<HTMLInputElement>('#sub-cvc')!.getAttribute('maxlength')).toBe('3');
    expect(el.querySelector<HTMLInputElement>('#sub-cvc')!.value).toBe('123');
  });

  it('should revalidate the CVC when the card changes to AMEX', async () => {
    await fill(CARD, false, { cvc: '123' });
    await submit();
    expect(el.querySelector('#sub-cvc-error')).toBeNull();

    type('#sub-card', AMEX);
    await settle();

    expect(el.querySelector('#sub-cvc-error')?.textContent).toContain('4 dígitos');
    expect(el.querySelector<HTMLInputElement>('#sub-cvc')!.value).toBe('123');
  });

  it('should reject an expired card', async () => {
    await fill(CARD, true, { expiry: '0120' });
    await submit();

    expect(gateway.starts.length).toBe(0);
    expect(el.querySelector('#sub-expiry-error')?.textContent).toContain('vencida');
    expect(el.querySelector('#sub-expiry')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('should reject a malformed expiry', async () => {
    await fill(CARD, true, { expiry: '13' });
    await submit();

    expect(gateway.starts.length).toBe(0);
    expect(el.querySelector('#sub-expiry-error')?.textContent).toContain('mes y año');
  });

  it('should keep the CVC and the expiry out of the request, the DOM and the session storage', async () => {
    await fill(CARD, true, { cvc: '987' });
    await submit();

    expect(JSON.stringify(gateway.starts)).not.toContain('987');
    expect(el.querySelector<HTMLInputElement>('#sub-cvc')!.value).toBe('');
    expect(el.querySelector<HTMLInputElement>('#sub-expiry')!.value).toBe('');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('987');
  });

  it('should require the advisor declaration', async () => {
    await fill(CARD, false);
    await submit();

    expect(gateway.starts.length).toBe(0);
    expect(el.querySelector('#sub-accepted-error')?.textContent).toContain('cliente aceptó');
    expect(el.querySelector('#sub-accepted')?.getAttribute('aria-describedby')).toBe(
      'sub-accepted-error',
    );
  });

  it('should validate the card number', async () => {
    await fill('123');
    await submit();

    expect(gateway.starts.length).toBe(0);
    expect(cardInput().getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#sub-card-error')?.textContent).toContain('13 a 19');
  });

  it('should ignore a double click while it is starting', async () => {
    gateway.holdStart = new Subject<string>();
    await fill();
    await submit();
    await submit();

    expect(gateway.starts.length).toBe(1);
  });

  it('should keep the key without a certain answer and renew it after a business answer', async () => {
    gateway.failStart = new ApiError('network', 0);
    await fill();
    await submit();
    await fill();
    await submit();
    expect(gateway.starts[1].key).toBe(gateway.starts[0].key);

    gateway.failStart = new ApiError('validation', 409, 'COTIZACION_VENCIDA');
    await fill();
    await submit();
    await fill();
    await submit();
    expect(gateway.starts[3].key).not.toBe(gateway.starts[2].key);
  });

  it('should explain each rejection', async () => {
    gateway.failStart = new ApiError('validation', 409, 'COTIZACION_SIN_CUENTA');
    await fill();
    await submit();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('sin cuenta');
    expect(navigate).not.toHaveBeenCalled();
  });
});
