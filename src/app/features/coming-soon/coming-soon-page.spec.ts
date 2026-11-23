import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { comingSoonRoutes } from './coming-soon.routes';
import { COMING_SOON_SECTIONS } from './coming-soon.sections';

describe('ComingSoonPage', () => {
  const names: Readonly<Record<string, string>> = {
    quote: 'Cotizar',
    policies: 'Pólizas',
    claims: 'Siniestros',
    profile: 'Perfil',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', children: [] },
          ...COMING_SOON_SECTIONS.map((path) => ({
            path,
            loadChildren: () => comingSoonRoutes(path),
          })),
          { path: '**', redirectTo: '' },
        ]),
      ],
    });
  });

  for (const section of COMING_SOON_SECTIONS) {
    it(`should explain that ${section} is not available yet, instead of going home`, async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(`/${section}`);

      const page: HTMLElement = harness.routeNativeElement!;
      expect(TestBed.inject(Router).url).toBe(`/${section}`);
      expect(page.querySelector('h1')?.textContent).toBe(names[section]);
      expect(page.textContent).toContain('todavía no está disponible');
      expect(page.querySelector('a')?.getAttribute('href')).toBe('/');
      expect(document.title).toBe(`Solventa — ${names[section]}`);
    });
  }
});
