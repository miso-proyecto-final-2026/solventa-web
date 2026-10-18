import { TestBed } from '@angular/core/testing';
import { Footer } from './footer';

describe('Footer', () => {
  async function render(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [Footer] }).compileComponents();
    const fixture = TestBed.createComponent(Footer);
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  it('should show the current year in the copyright', async () => {
    const footer = await render();

    expect(footer.querySelector('p')?.textContent).toContain(
      `© ${new Date().getFullYear()} Solventa`,
    );
  });

  it('should show the three badges', async () => {
    const footer = await render();
    const badges = Array.from(footer.querySelectorAll('li')).map((li) => li.textContent?.trim());

    expect(badges).toEqual(['Accesibilidad', 'i18n ES/EN', 'L10n Colombia']);
  });
});
