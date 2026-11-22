import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { LocaleSwitcher } from '@core/i18n/locale-switcher';
import { Header } from './header';

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
  'claims',
  'profile',
];

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  const switcher = {
    canSwitch: true,
    other: 'en-US',
    switchTo: jasmine.createSpy('switchTo'),
  };
  const root = (): HTMLElement => fixture.nativeElement;
  const links = () => Array.from(root().querySelectorAll<HTMLAnchorElement>('nav a'));
  const labels = () => links().map((link) => link.textContent?.trim());
  const hrefOf = (label: string) =>
    links()
      .find((link) => link.textContent?.trim() === label)
      ?.getAttribute('href');
  const accountButton = () => root().querySelector<HTMLButtonElement>('.account__button');
  const menuItems = () => Array.from(root().querySelectorAll<HTMLElement>('[role="menuitem"]'));

  const startSession = async (role: 'ASESOR' | 'OPERADOR', name = 'Asesora Demo') => {
    TestBed.inject(SessionStore).start({
      token: 't',
      user: { id: '1', name, role },
      expiresAt: Date.now() + 60_000,
    });
    await fixture.whenStable();
  };

  beforeEach(async () => {
    sessionStorage.clear();
    switcher.switchTo.calls.reset();
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter(PAGES.map((path) => ({ path, children: [] }))),
        { provide: LocaleSwitcher, useValue: switcher },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
  });

  afterEach(() => sessionStorage.clear());

  describe('main navigation', () => {
    it('should offer visitors four sections and an option to sign in', () => {
      expect(labels()).toEqual(['Inicio', 'Cotizaciones', 'Pólizas', 'Siniestros']);
      expect(root().querySelector('.header__session a')?.textContent).toContain('Ingresar');
      expect(root().querySelector('nav')?.getAttribute('aria-label')).toBe('Navegación principal');
    });

    it('should show advisors the six sections, grouping the quote and billing screens', async () => {
      await startSession('ASESOR');

      expect(labels()).toEqual([
        'Inicio',
        'Cotizaciones',
        'Consentimientos',
        'Pólizas',
        'Cobros',
        'Siniestros',
      ]);
      expect(hrefOf('Cotizaciones')).toBe('/assisted-quote');
      expect(hrefOf('Cobros')).toBe('/failed-payments');
    });

    it('should keep the role conditions: operators see billing but not consents, and no advisor screens', async () => {
      await startSession('OPERADOR', 'Operador Demo');

      expect(labels()).toEqual(['Inicio', 'Cotizaciones', 'Pólizas', 'Cobros', 'Siniestros']);
      expect(hrefOf('Cotizaciones')).toBe('/quote');
      expect(hrefOf('Cobros')).toBe('/failed-payments');
    });

    it('should keep no icons or old entries in the bar', async () => {
      await startSession('ASESOR');

      expect(labels().join(' ')).not.toMatch(/Perfil|Cerrar sesión|Revisión asistida|Mis Pólizas/);
      expect(root().querySelector('.header__icon')).toBeNull();
    });

    it('should mark the group as current for any route of the group', async () => {
      await startSession('ASESOR');
      const router = TestBed.inject(Router);

      for (const [url, group] of [
        ['/', 'Inicio'],
        ['/quote', 'Cotizaciones'],
        ['/assisted-quote', 'Cotizaciones'],
        ['/assisted-review', 'Cotizaciones'],
        ['/client-consent', 'Consentimientos'],
        ['/failed-payments', 'Cobros'],
        ['/subscriptions', 'Cobros'],
        ['/policies', 'Pólizas'],
        ['/claims', 'Siniestros'],
      ]) {
        await router.navigateByUrl(url);
        await fixture.whenStable();

        const current = links().filter((link) => link.getAttribute('aria-current') === 'page');
        expect(current.map((link) => link.textContent?.trim()))
          .withContext(url)
          .toEqual([group]);
      }
    });

    it('should mark nothing as current outside the grouped screens', async () => {
      await TestBed.inject(Router).navigateByUrl('/profile');
      await fixture.whenStable();

      expect(links().some((link) => link.getAttribute('aria-current') === 'page')).toBeFalse();
    });
  });

  describe('account menu', () => {
    beforeEach(() => startSession('ASESOR'));

    it('should show the advisor name in a button that opens a menu', async () => {
      const button = accountButton()!;
      expect(button.textContent).toContain('Asesora Demo');
      expect(button.getAttribute('aria-haspopup')).toBe('menu');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(root().querySelector('[role="menu"]')).toBeNull();

      button.click();
      await fixture.whenStable();

      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
        'Perfil',
        'IdiomaEN',
        'Cerrar sesión',
      ]);
      expect(menuItems()[0].getAttribute('href')).toBe('/profile');
    });

    it('should move the focus to the first option when it opens and close with Escape', async () => {
      accountButton()!.click();
      await fixture.whenStable();
      expect(document.activeElement).toBe(menuItems()[0]);

      menuItems()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();

      expect(root().querySelector('[role="menu"]')).toBeNull();
      expect(accountButton()!.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(accountButton());
    });

    it('should walk the options with the arrow keys', async () => {
      accountButton()!.click();
      await fixture.whenStable();

      menuItems()[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      expect(document.activeElement).toBe(menuItems()[1]);
      menuItems()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(document.activeElement).toBe(menuItems()[0]);
    });

    it('should close when the user clicks elsewhere', async () => {
      accountButton()!.click();
      await fixture.whenStable();

      document.body.click();
      await fixture.whenStable();

      expect(root().querySelector('[role="menu"]')).toBeNull();
    });

    it('should switch the language from the menu', async () => {
      accountButton()!.click();
      await fixture.whenStable();

      menuItems()[1].click();

      expect(switcher.switchTo).toHaveBeenCalledWith('en-US');
    });

    it('should hide the language option when the app cannot switch', async () => {
      switcher.canSwitch = false;
      fixture = TestBed.createComponent(Header);
      await fixture.whenStable();
      accountButton()!.click();
      await fixture.whenStable();
      switcher.canSwitch = true;

      expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
        'Perfil',
        'Cerrar sesión',
      ]);
    });

    it('should sign out and go home', async () => {
      const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      accountButton()!.click();
      await fixture.whenStable();

      menuItems()[2].click();
      await fixture.whenStable();

      expect(TestBed.inject(SessionStore).isAuthenticated()).toBeFalse();
      expect(navigate).toHaveBeenCalledWith('/');
      expect(accountButton()).toBeNull();
      expect(labels()).toEqual(['Inicio', 'Cotizaciones', 'Pólizas', 'Siniestros']);
      expect(root().querySelector('.header__session a')?.textContent).toContain('Ingresar');
    });
  });
});
