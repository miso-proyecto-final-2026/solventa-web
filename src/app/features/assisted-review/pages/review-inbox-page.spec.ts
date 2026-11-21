import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { Subject } from 'rxjs';
import { AssistedReviewGateway } from '../data-access/assisted-review.gateway';
import { ReviewPage } from '../domain/models';
import { FakeAssistedReviewGateway } from '../testing/fake-assisted-review.gateway';
import { DETAIL, EXPIRED_ROW, ROW } from '../testing/fixtures';
import { ReviewInboxPage } from './review-inbox-page';

describe('ReviewInboxPage', () => {
  let fixture: ComponentFixture<ReviewInboxPage>;
  let el: HTMLElement;
  let gateway: FakeAssistedReviewGateway;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const create = async () => {
    fixture = TestBed.createComponent(ReviewInboxPage);
    el = fixture.nativeElement;
    await settle();
  };
  const text = () => el.textContent ?? '';
  const rows = () => Array.from(el.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    )!;
  const check = async (label: string) => {
    const input = Array.from(el.querySelectorAll<HTMLLabelElement>('label.ar__check'))
      .find((l) => l.textContent?.includes(label))!
      .querySelector('input')!;
    input.click();
    await settle();
  };

  beforeEach(() => {
    sessionStorage.clear();
    gateway = new FakeAssistedReviewGateway();
    TestBed.configureTestingModule({
      imports: [ReviewInboxPage],
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        { provide: AssistedReviewGateway, useValue: gateway },
      ],
    });
  });

  afterEach(() => sessionStorage.clear());

  it('should load the pending cases with one main heading', async () => {
    await create();

    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(gateway.queries).toEqual([
      { state: 'PENDING', category: null, mineOnly: false, expiredOnly: false, page: 1 },
    ]);
    expect(rows().length).toBe(2);
  });

  it('should show priority, date, reason, category, client, product and amount', async () => {
    await create();

    const [first] = rows();
    expect(first.textContent).toContain('Alta');
    expect(first.textContent).toContain('Datos incompletos o inconsistentes');
    expect(first.textContent).toContain('El perfil del cliente no está disponible');
    expect(first.textContent).toContain('Ana María P.');
    expect(first.textContent).toContain('******300');
    expect(first.textContent).toContain('Microseguro de vida');
    expect(first.textContent).toMatch(/40[.,]000[.,]000/);
  });

  it('should mark the priority with an icon and text, not only color', async () => {
    await create();

    const badge = rows()[0].querySelector('.ar__badge')!;
    expect(badge.querySelector('[aria-hidden="true"]')?.textContent).toBe('▲');
    expect(badge.textContent).toContain('Alta');
  });

  it('should warn with the count of expired quotes and mark each one with text, icon and date', async () => {
    await create();

    expect(text()).toContain('1 caso tiene la cotización vencida y solo se puede cerrar');
    const expired = rows()[1];
    expect(expired.classList).toContain('ar__row--expired');
    const badge = expired.querySelector<HTMLElement>('.ar__badge--expired')!;
    expect(badge.textContent).toContain('Cotización vencida');
    expect(badge.getAttribute('aria-label')).toContain('Cotización vencida el');
    expect(rows()[0].querySelector('.ar__badge--expired')).toBeNull();
  });

  it('should apply the expired filter from the notice button', async () => {
    await create();

    button('Ver solo los vencidos').click();
    await settle();

    expect(gateway.queries.at(-1)).toEqual(
      jasmine.objectContaining({ expiredOnly: true, page: 1 }),
    );
  });

  it('should send the filters of the form to the gateway', async () => {
    await create();

    await check('Mis cotizaciones');
    expect(gateway.queries.at(-1)).toEqual(jasmine.objectContaining({ mineOnly: true }));

    const select = el.querySelector<HTMLSelectElement>('#ar-category')!;
    select.value = 'AMOUNT_OVER_LIMIT';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(gateway.queries.at(-1)).toEqual(
      jasmine.objectContaining({ category: 'AMOUNT_OVER_LIMIT', mineOnly: true }),
    );
  });

  it('should offer the quick close only on the expired pending case', async () => {
    await create();

    const [open, expired] = rows();
    expect(open.textContent).not.toContain('Cerrar por cotización vencida');
    expect(expired.textContent).toContain('Cerrar por cotización vencida');
  });

  it('should open an inline panel with the suggested, editable justification', async () => {
    await create();

    button('Cerrar por cotización vencida').click();
    await settle();

    const area = el.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(area.value).toContain('La cotización venció el');
    expect(area.value).toContain('el cliente debe volver a cotizar');
    expect(button('Cerrar por cotización vencida').getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[role="dialog"]')).toBeNull(); // en línea, sin modal
  });

  it('should reject the case with the suggested text, reload and announce the result', async () => {
    await create();
    button('Cerrar por cotización vencida').click();
    await settle();
    const suggested = el.querySelector<HTMLTextAreaElement>('textarea')!.value;
    gateway.rows = [ROW];
    gateway.expiredTotal = 0;

    button('Confirmar cierre sin cobro').click();
    await settle();

    expect(gateway.decisions).toEqual([
      {
        id: EXPIRED_ROW.id,
        request: { decision: 'REJECTED', justification: suggested, insuredAmount: null },
      },
    ]);
    expect(rows().length).toBe(1);
    expect(el.querySelector('#ar-announcement')?.textContent).toContain('sin cobro');
    expect(el.querySelector('textarea')).toBeNull();
  });

  it('should not close with a justification that is too short', async () => {
    await create();
    button('Cerrar por cotización vencida').click();
    await settle();
    const area = el.querySelector<HTMLTextAreaElement>('textarea')!;
    area.value = 'corta';
    area.dispatchEvent(new Event('input'));
    await settle();

    button('Confirmar cierre sin cobro').click();
    await settle();

    expect(gateway.decisions).toEqual([]);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('entre 20 y 2000');
  });

  it('should reload when another advisor closed the case first', async () => {
    await create();
    button('Cerrar por cotización vencida').click();
    await settle();
    gateway.failDecide = new ApiError('validation', 409, 'REVISION_YA_DECIDIDA');
    const loads = gateway.queries.length;

    button('Confirmar cierre sin cobro').click();
    await settle();

    expect(gateway.queries.length).toBe(loads + 1);
    expect(el.querySelector('#ar-announcement')?.textContent).toContain('Otro asesor');
    expect(el.querySelector('textarea')).toBeNull();
  });

  it('should keep the panel and explain the error when closing fails for another reason', async () => {
    await create();
    button('Cerrar por cotización vencida').click();
    await settle();
    gateway.failDecide = new ApiError('server', 500);

    button('Confirmar cierre sin cobro').click();
    await settle();

    expect(el.querySelector('textarea')).not.toBeNull();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('servidor');
  });

  it('should cancel the panel without deciding', async () => {
    await create();
    button('Cerrar por cotización vencida').click();
    await settle();

    button('Cancelar').click();
    await settle();

    expect(el.querySelector('textarea')).toBeNull();
    expect(gateway.decisions).toEqual([]);
  });

  it('should link each case to its detail', async () => {
    await create();

    const link = el.querySelector<HTMLAnchorElement>('a.ar__open')!;
    expect(link.getAttribute('href')).toBe(`/assisted-review/${DETAIL.id}`);
  });

  it('should show the empty state with the live region and busy table while loading', async () => {
    const hold = new Subject<ReviewPage>();
    gateway.holdList = hold;
    await create();

    expect(el.querySelector('[role="status"]')?.textContent).toContain('Cargando');

    hold.next({ items: [], total: 0, expiredTotal: 0, page: 1, size: 20 });
    await settle();
    expect(text()).toContain('No hay casos con estos filtros');
  });

  it('should explain a failure and reload from the button', async () => {
    gateway.failList = new ApiError('server', 500);
    await create();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('servidor');

    gateway.failList = null;
    button('Volver a cargar').click();
    await settle();

    expect(rows().length).toBe(2);
  });

  it('should page with the buttons', async () => {
    gateway.total = 45;
    await create();
    expect(text()).toContain('Página 1 de 3');

    button('Siguiente').click();
    await settle();

    expect(gateway.queries.at(-1)?.page).toBe(2);
  });

  it('should send an expired session to the login and come back to the inbox', async () => {
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
      queryParams: { returnUrl: '/assisted-review' },
    });
  });
});
