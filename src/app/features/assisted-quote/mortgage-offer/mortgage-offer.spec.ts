import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '@core/http/api-error';
import { AssistedQuoteGateway } from '../data-access/assisted-quote.gateway';
import { MortgageOffer } from '../domain/models';
import { FakeAssistedQuoteGateway } from '../testing/fake-assisted-quote.gateway';
import { CLIENT, OFFER } from '../testing/fixtures';
import { MortgageOfferPanel } from './mortgage-offer';

registerLocaleData(localeEsCo);

describe('MortgageOfferPanel (HU26)', () => {
  let fixture: ComponentFixture<MortgageOfferPanel>;
  let el: HTMLElement;
  let gateway: FakeAssistedQuoteGateway;
  let recalculated: number[];
  let retries: number;
  let backs: number;

  const render = async (inputs: {
    offer?: MortgageOffer | null;
    busy?: boolean;
    error?: ApiError | null;
  }) => {
    fixture.componentRef.setInput('clientId', CLIENT.id);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
  };
  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (name: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === name,
    );
  const sumInput = () => el.querySelector<HTMLInputElement>('#offer-sum')!;
  const typeSum = async (value: string) => {
    sumInput().value = value;
    sumInput().dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
  };
  const acceptLink = () =>
    Array.from(el.querySelectorAll<HTMLAnchorElement>('a')).find((a) =>
      a.textContent?.includes('El cliente acepta'),
    );

  beforeEach(async () => {
    recalculated = [];
    retries = 0;
    backs = 0;
    gateway = new FakeAssistedQuoteGateway();
    await TestBed.configureTestingModule({
      imports: [MortgageOfferPanel],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'es-CO' },
        { provide: AssistedQuoteGateway, useValue: gateway },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MortgageOfferPanel);
    fixture.componentInstance.recalculate.subscribe((v) => recalculated.push(v));
    fixture.componentInstance.retry.subscribe(() => retries++);
    fixture.componentInstance.back.subscribe(() => backs++);
    el = fixture.nativeElement;
  });

  it('should say the offer is being generated while the profile is enriched', async () => {
    await render({ busy: true });

    expect(text()).toContain('Generando la oferta');
    expect(acceptLink()).toBeUndefined();
  });

  it('should present the premiums, sum, life stage and coverages formatted for the locale', async () => {
    await render({ offer: OFFER });

    expect(text()).toContain('Seguro de vida hipotecario');
    expect(text()).toMatch(/\$\s?35\.100/);
    expect(text()).toMatch(/Prima anual: \$\s?421\.200/);
    expect(text()).toMatch(/Suma asegurada \$\s?200\.000\.000/);
    expect(text()).toMatch(/Etapa de vida\s*Consolidación/);
    expect(text()).toContain('Incapacidad total y permanente');
    expect(text()).toMatch(/\$\s?20\.000\.000/); // deducible
  });

  it('should explain each step of the price without the client figures', async () => {
    await render({ offer: OFFER });
    const rows = Array.from(el.querySelectorAll('section:last-of-type tbody tr')).map(
      (r) => r.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );

    expect(rows[0]).toMatch(/^Prima base sobre la suma asegurada — \$\s?360\.000/);
    expect(rows[1]).toMatch(/^Etapa de vida: Consolidación 1,30 \$\s?108\.000/);
    expect(rows[2]).toMatch(/^Nivel de endeudamiento 0,90 -\$\s?46\.800/);
    expect(rows[3]).toContain('Puntaje crediticio (sin dato)');
    // La regla de la prima base viene sin traducir del backend: no se muestra.
    expect(text()).not.toContain('0.0018');
  });

  it('should warn that a degraded profile carries a surcharge', async () => {
    await render({ offer: { ...OFFER, degraded: true } });

    expect(text()).toContain('la prima lleva un recargo conservador');
  });

  it('should start the assisted subscription with the registered quote when the client accepts', async () => {
    await render({ offer: OFFER });

    expect(acceptLink()!.getAttribute('href')).toBe('/subscriptions/new/cot-vh-1');
  });

  it('should not offer to accept while a new sum is being recalculated', async () => {
    await render({ offer: OFFER, busy: true });

    expect(acceptLink()).toBeUndefined();
    expect(button('Recalcular')!.disabled).toBeTrue();
  });

  it('should recalculate with the sum the advisor types, prefilled with the current one', async () => {
    await render({ offer: OFFER });
    expect(sumInput().value).toBe('200000000');

    await typeSum('150000000');

    expect(recalculated).toEqual([150_000_000]);
  });

  it('should reject a sum with separators or decimals before calling the backend', async () => {
    await render({ offer: OFFER });

    await typeSum('150.000.000');

    expect(recalculated).toEqual([]);
    expect(text()).toContain('Escribe la suma en pesos, sin puntos ni decimales.');
    expect(sumInput().getAttribute('aria-invalid')).toBe('true');
    expect(sumInput().getAttribute('aria-describedby')).toBe('offer-sum-error');
  });

  it('should show the reason Perfilamiento gave for an out-of-range sum next to the field', async () => {
    const error = new ApiError('validation', 422, 'VALIDATION_ERROR', [
      { field: 'suma_asegurada', reason: 'debe estar entre 20,000,000 y 800,000,000' },
    ]);
    await render({ offer: OFFER, error });

    expect(text()).toContain('debe estar entre 20,000,000 y 800,000,000');
    expect(sumInput().getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('sol-alert')).toBeNull();
  });

  it('should let the advisor type another sum when the default one was rejected', async () => {
    const error = new ApiError('validation', 422, 'VALIDATION_ERROR', [
      { field: 'suma_asegurada', reason: 'debe estar entre 20,000,000 y 800,000,000' },
    ]);
    await render({ offer: null, error });

    await typeSum('300000000');

    expect(recalculated).toEqual([300_000_000]);
  });

  it('should explain that without consent there is no offer, with no retry', async () => {
    await render({ error: new ApiError('validation', 409, 'CONSENTIMIENTO_REQUERIDO') });

    expect(text()).toContain('El cliente no ha otorgado el consentimiento de datos');
    expect(button('Reintentar')).toBeUndefined();
    expect(sumInput()).toBeNull();
  });

  it('should offer a retry when Perfilamiento or a source is down or slow', async () => {
    for (const error of [
      new ApiError('server', 503, 'OFERTA_NO_DISPONIBLE'),
      new ApiError('network', 0),
      new ApiError('not-found', 404, 'PERFIL_NO_ENCONTRADO'),
    ]) {
      await render({ error });
      expect(text()).toContain('No pudimos generar la oferta');

      button('Reintentar')!.click();
    }

    expect(retries).toBe(3);
  });

  it('should open the source lineage in its own tab, only when asked', async () => {
    await render({ offer: OFFER });
    expect(gateway.lineageRequests).toEqual([]);

    button('Linaje de fuentes')!.click();
    await fixture.whenStable();

    expect(gateway.lineageRequests).toEqual([CLIENT.id]);
    expect(el.querySelector<HTMLElement>('#panel-offer')!.hidden).toBeTrue();
    expect(button('Linaje de fuentes')!.getAttribute('aria-selected')).toBe('true');
  });

  it('should move between tabs with the arrow keys', async () => {
    await render({ offer: OFFER });

    button('Oferta')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await fixture.whenStable();

    expect(button('Linaje de fuentes')!.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(button('Linaje de fuentes')!);
  });

  it('should go back to the profile', async () => {
    await render({ offer: OFFER });

    button('Volver al perfil')!.click();

    expect(backs).toBe(1);
  });
});
