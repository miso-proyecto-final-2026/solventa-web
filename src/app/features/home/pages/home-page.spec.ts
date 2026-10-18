import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomePage } from './home-page';

describe('HomePage', () => {
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    page = fixture.nativeElement;
  });

  it('should have a single main heading', () => {
    const headings = page.querySelectorAll('h1');

    expect(headings.length).toBe(1);
    expect(headings[0].textContent).toContain('Protege lo que importa');
  });

  it('should link the call to action to the quote section', () => {
    const cta = page.querySelector<HTMLAnchorElement>('a.sol-btn');

    expect(cta?.textContent?.trim()).toBe('Cotizar ahora');
    expect(cta?.getAttribute('href')).toBe('/quote');
  });

  it('should show the three value propositions', () => {
    const titles = Array.from(page.querySelectorAll('.value-props h2')).map((h) => h.textContent);

    expect(titles).toEqual(['Cotización instantánea', '100% digital', 'Siniestro automático']);
  });

  it('should show the distribution partners', () => {
    const partners = Array.from(page.querySelectorAll('.partners__list li')).map(
      (li) => li.textContent,
    );

    expect(partners).toEqual(['Fintech A', 'Banco B', 'Comercio C']);
  });
});
