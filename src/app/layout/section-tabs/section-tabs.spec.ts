import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { SectionTabs } from './section-tabs';

const PAGES = [
  '',
  'quote',
  'assisted-quote',
  'assisted-review',
  'client-consent',
  'failed-payments',
  'subscriptions',
  'reconciliation',
  'policies',
];

describe('SectionTabs', () => {
  let fixture: ComponentFixture<SectionTabs>;
  const tabs = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a'));
  const labels = () => tabs().map((tab) => tab.textContent?.trim());
  const go = async (url: string) => {
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
  };
  const startSession = async (role: 'ASESOR' | 'OPERADOR') => {
    TestBed.inject(SessionStore).start({
      token: 't',
      user: { id: '1', name: 'Demo', role },
      expiresAt: Date.now() + 60_000,
    });
    await fixture.whenStable();
  };

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [SectionTabs],
      providers: [provideRouter(PAGES.map((path) => ({ path, children: [] })))],
    }).compileComponents();
    fixture = TestBed.createComponent(SectionTabs);
    await fixture.whenStable();
  });

  afterEach(() => sessionStorage.clear());

  it('should show the three quote screens to advisors, pointing at the same routes as before', async () => {
    await startSession('ASESOR');
    await go('/assisted-quote');

    expect(labels()).toEqual(['Cotizar', 'Cotización asistida', 'Revisión asistida']);
    expect(tabs().map((tab) => tab.getAttribute('href'))).toEqual([
      '/quote',
      '/assisted-quote',
      '/assisted-review',
    ]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('nav')?.getAttribute('aria-label'),
    ).toBe('Secciones de Cotizaciones');
  });

  it('should mark only the current tab', async () => {
    await startSession('ASESOR');
    await go('/assisted-review');

    const current = tabs().filter((tab) => tab.getAttribute('aria-current') === 'page');
    expect(current.map((tab) => tab.textContent?.trim())).toEqual(['Revisión asistida']);
  });

  it('should show advisors failed payments and subscriptions under billing', async () => {
    await startSession('ASESOR');
    await go('/subscriptions');

    expect(labels()).toEqual(['Cobros fallidos', 'Suscripciones']);
  });

  it('should show operators failed payments and reconciliation, and nothing from the advisor', async () => {
    await startSession('OPERADOR');
    await go('/failed-payments');

    expect(labels()).toEqual(['Cobros fallidos', 'Conciliación']);
  });

  it('should not show tabs when only one screen of the group is allowed', async () => {
    await go('/quote'); // un visitante solo ve «Cotizar» en Cotizaciones

    expect(tabs()).toEqual([]);
  });

  it('should not show tabs on single-screen sections or outside the groups', async () => {
    await startSession('ASESOR');

    await go('/client-consent');
    expect(tabs()).toEqual([]);
    await go('/policies');
    expect(tabs()).toEqual([]);
    await go('/');
    expect(tabs()).toEqual([]);
  });
});
