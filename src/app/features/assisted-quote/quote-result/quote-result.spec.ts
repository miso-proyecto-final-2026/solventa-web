import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AssistedQuoteGateway } from '../data-access/assisted-quote.gateway';
import { Quote } from '../domain/models';
import { CLIENT, QUOTE } from '../testing/fixtures';
import { FakeAssistedQuoteGateway } from '../testing/fake-assisted-quote.gateway';
import { QuoteResult } from './quote-result';

registerLocaleData(localeEsCo);

describe('QuoteResult', () => {
  let fixture: ComponentFixture<QuoteResult>;
  let el: HTMLElement;
  let newQuotes = 0;
  let gateway: FakeAssistedQuoteGateway;

  const render = async (quote: Quote = QUOTE) => {
    fixture.componentRef.setInput('quote', quote);
    await fixture.whenStable();
  };
  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';

  /** Los montos y fechas salen del idioma del build: se fija para no depender del navegador. */
  const create = async (locale: string) => {
    await TestBed.configureTestingModule({
      imports: [QuoteResult],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: locale },
        { provide: AssistedQuoteGateway, useValue: gateway },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(QuoteResult);
    fixture.componentInstance.newQuote.subscribe(() => newQuotes++);
    el = fixture.nativeElement;
  };

  beforeEach(async () => {
    newQuotes = 0;
    gateway = new FakeAssistedQuoteGateway();
    await create('es-CO');
  });

  it('should present the monthly and annual premium formatted for the locale', async () => {
    await render();

    expect(text()).toMatch(/\$\s?13\.162/);
    expect(text()).toMatch(/Prima anual: \$\s?157\.938/);
    expect(text()).toContain('Microseguro de vida');
  });

  it('should format amounts and dates with the English conventions in the en-US build', async () => {
    TestBed.resetTestingModule();
    await create('en-US');

    await render();

    expect(text()).toContain('$13,162');
    expect(text()).toContain('$157,938');
    expect(text()).toContain('November 19, 2026');
  });

  it('should list coverages with insured amount and deductible', async () => {
    await render();

    const rows = Array.from(el.querySelectorAll('section table tbody tr')).map((r) =>
      r.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(rows[0]).toMatch(/^Muerte \$\s?50\.000\.000 \$\s?0$/);
    expect(rows[1]).toMatch(/^Incapacidad total \$\s?25\.000\.000 \$\s?0$/);
  });

  it('should show the validity date', async () => {
    await render();

    expect(text()).toContain('Válida hasta');
    expect(text()).toContain('19 de noviembre de 2026');
  });

  it('should not warn about an estimate when the real profile was used', async () => {
    await render();

    expect(el.querySelector('sol-alert')).toBeNull();
  });

  it('should warn that the price is an estimate', async () => {
    await render({ ...QUOTE, estimated: true, profileSource: 'DEFAULT' });

    expect(el.querySelector('sol-alert [role="status"]')?.textContent).toContain('Precio estimado');
    expect(text()).toContain('Perfil por defecto');
  });

  it('should say a quote without an account needs registration to buy', async () => {
    await render({ ...QUOTE, estimated: true, withoutAccount: true });

    expect(text()).toContain('Cotización sin cuenta');
  });

  it('should explain the price with the breakdown that adds up to the annual premium', async () => {
    await render();

    const rows = Array.from(el.querySelectorAll('sol-price-breakdown tbody tr')).map((r) =>
      r.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(rows.length).toBe(4);
    expect(rows[0]).toMatch(/^Prima base del producto \$\s?175\.000$/);
    expect(rows[2]).toMatch(/^Ajuste por el perfil de riesgo -\$\s?17\.062$/);
    const total = QUOTE.components.reduce((sum, c) => sum + c.amount.amount, 0);
    expect(total).toBe(QUOTE.annualPremium.amount);
  });

  it('should say so when there is no breakdown', async () => {
    await render({ ...QUOTE, components: [] });

    expect(text()).toContain('no tiene desglose disponible');
    expect(el.querySelector('sol-price-breakdown table')).toBeNull();
  });

  it('should link to starting the subscription of this quote and allow a new quote', async () => {
    await render();

    const start = el.querySelector<HTMLAnchorElement>('a.sol-btn')!;
    expect(start.textContent).toContain('Iniciar suscripción');
    expect(start.getAttribute('href')).toBe(`/subscriptions/new/${QUOTE.id}`);

    el.querySelector<HTMLButtonElement>('button.sol-btn')!.click();
    expect(newQuotes).toBe(1);
  });

  it('should not offer the subscription to a person without an account', async () => {
    await render({ ...QUOTE, withoutAccount: true });

    expect(el.querySelector('a.sol-btn')).toBeNull();
    expect(text()).toContain('el cliente debe registrarse');
  });

  describe('lineage tab (HU24)', () => {
    const tabs = () => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panel = (id: string) => el.querySelector<HTMLElement>(`#${id}`);
    const renderFor = async (clientId: string | null, quote: Quote = QUOTE) => {
      fixture.componentRef.setInput('clientId', clientId);
      await render(quote);
    };

    it('should not show tabs for a person without an account', async () => {
      await renderFor(null, { ...QUOTE, withoutAccount: true });

      expect(tabs().length).toBe(0);
      expect(panel('panel-quote')?.getAttribute('role')).toBeNull();
      expect(gateway.lineageRequests).toEqual([]);
    });

    it('should open on the quote tab and not ask for the lineage until its tab is opened', async () => {
      await renderFor(CLIENT.id);

      expect(tabs().map((t) => t.textContent?.trim())).toEqual(['Cotización', 'Linaje de fuentes']);
      expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
      expect(panel('panel-quote')?.getAttribute('role')).toBe('tabpanel');
      expect(panel('panel-quote')?.hidden).toBeFalse();
      expect(panel('panel-lineage')).toBeNull();
      expect(gateway.lineageRequests).toEqual([]);
    });

    it('should show the lineage of the client when its tab is selected', async () => {
      await renderFor(CLIENT.id);

      tabs()[1].click();
      await fixture.whenStable();

      expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
      expect(panel('panel-quote')?.hidden).toBeTrue();
      expect(panel('panel-lineage')?.hidden).toBeFalse();
      expect(panel('panel-lineage')?.getAttribute('aria-labelledby')).toBe('tab-lineage');
      expect(gateway.lineageRequests).toEqual([CLIENT.id]);
      expect(text()).toContain('Open Finance');
    });

    it('should keep the lineage loaded when going back and forth between tabs', async () => {
      await renderFor(CLIENT.id);

      tabs()[1].click();
      await fixture.whenStable();
      tabs()[0].click();
      await fixture.whenStable();
      tabs()[1].click();
      await fixture.whenStable();

      expect(gateway.lineageRequests.length).toBe(1);
    });

    it('should move between tabs with the arrow, Home and End keys and keep one tab focusable', async () => {
      await renderFor(CLIENT.id);
      const key = async (k: string) => {
        // La tecla llega a la pestaña activa, como en el navegador.
        el.querySelector('[role="tab"][aria-selected="true"]')!.dispatchEvent(
          new KeyboardEvent('keydown', { key: k }),
        );
        await fixture.whenStable();
      };

      await key('ArrowRight');
      expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(tabs()[1]);
      expect(tabs().map((t) => t.tabIndex)).toEqual([-1, 0]);

      await key('ArrowRight');
      expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
      await key('End');
      expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
      await key('Home');
      expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    });

    it('should keep the actions visible on both tabs', async () => {
      await renderFor(CLIENT.id);

      tabs()[1].click();
      await fixture.whenStable();

      expect(el.querySelector('a.sol-btn')?.textContent).toContain('Iniciar suscripción');
    });
  });
});
