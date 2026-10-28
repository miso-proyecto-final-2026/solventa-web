import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { Header } from './header';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let links: () => HTMLAnchorElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'quote', children: [] },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    links = () => Array.from(fixture.nativeElement.querySelectorAll('nav a'));
  });

  it('should list the five main sections in order', () => {
    expect(links().map((link) => link.textContent?.trim())).toEqual([
      '🏠 Inicio',
      '📋 Cotizar',
      '🛡️ Mis Pólizas',
      '⚡ Siniestros',
      '👤 Perfil',
    ]);
  });

  describe('session', () => {
    const advisor = () =>
      TestBed.inject(SessionStore).start({
        token: 't',
        user: { id: '1', name: 'Asesora Demo', role: 'ASESOR' },
        expiresAt: Date.now() + 60_000,
      });
    const sessionEl = (selector: string): HTMLElement | null =>
      fixture.nativeElement.querySelector(selector);

    beforeEach(() => sessionStorage.clear());
    afterEach(() => sessionStorage.clear());

    it('should hide the assisted quote option from visitors and offer to sign in', () => {
      expect(links().some((l) => l.textContent?.includes('Cotización asistida'))).toBeFalse();
      expect(sessionEl('.header__session a')?.textContent).toContain('Ingresar');
    });

    it('should show the assisted quote option to advisors, with their name and a sign-out', async () => {
      advisor();
      await fixture.whenStable();

      expect(links().map((l) => l.textContent?.trim())).toContain('🤝 Cotización asistida');
      expect(sessionEl('.header__user')?.textContent).toContain('Asesora Demo');
      expect(sessionEl('.header__session button')?.textContent).toContain('Cerrar sesión');
    });

    it('should show failed payments to advisors and operators, and only that to operators', async () => {
      advisor();
      await fixture.whenStable();
      expect(links().map((l) => l.textContent?.trim())).toContain('💳 Cobros fallidos');

      TestBed.inject(SessionStore).start({
        token: 't',
        user: { id: '2', name: 'Operador Demo', role: 'OPERADOR' },
        expiresAt: Date.now() + 60_000,
      });
      await fixture.whenStable();

      const labels = links().map((l) => l.textContent?.trim());
      expect(labels).toContain('💳 Cobros fallidos');
      expect(labels).not.toContain('🤝 Cotización asistida');
    });

    it('should sign out and go home', async () => {
      advisor();
      await fixture.whenStable();
      const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

      sessionEl('.header__session button')!.click();
      await fixture.whenStable();

      expect(TestBed.inject(SessionStore).isAuthenticated()).toBeFalse();
      expect(navigate).toHaveBeenCalledWith('/');
      expect(links().some((l) => l.textContent?.includes('Cotización asistida'))).toBeFalse();
    });
  });

  it('should mark only the current page with aria-current', async () => {
    await TestBed.inject(Router).navigateByUrl('/quote');
    await fixture.whenStable();

    const current = links().filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.length).toBe(1);
    expect(current[0].textContent).toContain('Cotizar');
  });
});
