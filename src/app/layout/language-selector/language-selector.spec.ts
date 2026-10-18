import { TestBed } from '@angular/core/testing';
import { LocaleSwitcher } from '@core/i18n/locale-switcher';
import { AppLocale } from '@core/i18n/locales';
import { LanguageSelector } from './language-selector';

async function render(options: { canSwitch?: boolean; other?: AppLocale } = {}) {
  const switcher = {
    canSwitch: options.canSwitch ?? true,
    other: options.other ?? 'en-US',
    switchTo: jasmine.createSpy('switchTo'),
  };

  await TestBed.configureTestingModule({
    imports: [LanguageSelector],
    providers: [{ provide: LocaleSwitcher, useValue: switcher }],
  }).compileComponents();

  const fixture = TestBed.createComponent(LanguageSelector);
  await fixture.whenStable();
  const button = (fixture.nativeElement as HTMLElement).querySelector('button');

  return { switcher, button };
}

describe('LanguageSelector', () => {
  it('should show the code of the language it switches to', async () => {
    const { button } = await render({ other: 'en-US' });

    expect(button?.textContent?.trim()).toBe('EN');
  });

  it('should show the Spanish code when the other language is Spanish', async () => {
    const { button } = await render({ other: 'es-CO' });

    expect(button?.textContent?.trim()).toBe('ES');
  });

  it('should describe the current language and the action in its accessible name', async () => {
    const { button } = await render({ other: 'en-US' });

    expect(button?.getAttribute('aria-label')).toBe(
      'Idioma de la aplicación: español. Cambiar a inglés (EN)',
    );
  });

  it('should include the visible text in its accessible name', async () => {
    const { button } = await render({ other: 'en-US' });

    expect(button?.getAttribute('aria-label')).toContain(button?.textContent?.trim() ?? '');
  });

  it('should switch to the other language when clicked', async () => {
    const { switcher, button } = await render({ other: 'en-US' });

    button?.click();

    expect(switcher.switchTo).toHaveBeenCalledOnceWith('en-US');
  });

  it('should not be shown when switching is not possible', async () => {
    const { button } = await render({ canSwitch: false });

    expect(button).toBeNull();
  });
});
