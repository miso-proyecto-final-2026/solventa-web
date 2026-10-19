import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
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

  it('should mark only the current page with aria-current', async () => {
    await TestBed.inject(Router).navigateByUrl('/quote');
    await fixture.whenStable();

    const current = links().filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.length).toBe(1);
    expect(current[0].textContent).toContain('Cotizar');
  });
});
