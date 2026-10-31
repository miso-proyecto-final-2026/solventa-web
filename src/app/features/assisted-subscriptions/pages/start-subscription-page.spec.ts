import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ApiError } from '@core/http/api-error';
import { Subject } from 'rxjs';
import { AssistedSubscriptionsGateway } from '../data-access/assisted-subscriptions.gateway';
import { FakeAssistedSubscriptionsGateway } from '../testing/fake-assisted-subscriptions.gateway';
import { StartSubscriptionPage } from './start-subscription-page';

const CARD = '4242 4242 4242 4242';

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
  const fill = async (card = CARD, accept = true) => {
    cardInput().value = card;
    cardInput().dispatchEvent(new Event('input'));
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
