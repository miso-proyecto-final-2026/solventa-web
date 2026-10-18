import { DOCUMENT, LocationStrategy } from '@angular/common';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LocaleSwitcher } from './locale-switcher';

interface Scenario {
  /** Lo que devuelve <base href> en ese build. */
  baseHref: string;
  /** Idioma del build (LOCALE_ID). */
  locale: string;
  /** Dirección completa abierta en el navegador, incluida la carpeta del idioma. */
  url: string;
}

function setup({ baseHref, locale, url }: Scenario) {
  const { pathname, search, hash } = new URL(url, 'http://localhost');
  const assign = jasmine.createSpy('assign');

  TestBed.configureTestingModule({
    providers: [
      { provide: DOCUMENT, useValue: { location: { pathname, search, hash, assign } } },
      { provide: LocationStrategy, useValue: { getBaseHref: () => baseHref } },
      { provide: LOCALE_ID, useValue: locale },
    ],
  });

  return { switcher: TestBed.inject(LocaleSwitcher), assign };
}

const SPANISH_BUILD: Scenario = { baseHref: '/es-CO/', locale: 'es-CO', url: '/es-CO/quote' };

describe('LocaleSwitcher', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('availability', () => {
    it('should know the current and the other language', () => {
      const { switcher } = setup(SPANISH_BUILD);

      expect(switcher.current).toBe('es-CO');
      expect(switcher.other).toBe('en-US');
    });

    it('should be able to switch in a build served from its language folder', () => {
      const { switcher } = setup(SPANISH_BUILD);

      expect(switcher.canSwitch).toBeTrue();
    });

    it('should not be able to switch on the development server, which serves from /', () => {
      const { switcher } = setup({ baseHref: '/', locale: 'es-CO', url: '/quote' });

      expect(switcher.canSwitch).toBeFalse();
    });
  });

  describe('switchTo', () => {
    it('should go to the same screen in the other language', () => {
      const { switcher, assign } = setup({ ...SPANISH_BUILD, url: '/es-CO/quote?plan=1#top' });

      switcher.switchTo('en-US');

      expect(assign).toHaveBeenCalledOnceWith('/en-US/quote?plan=1#top');
    });

    it('should go to the root of the other language from the home page', () => {
      const { switcher, assign } = setup({ ...SPANISH_BUILD, url: '/es-CO/' });

      switcher.switchTo('en-US');

      expect(assign).toHaveBeenCalledOnceWith('/en-US/');
    });

    it('should work from English back to Spanish', () => {
      const { switcher, assign } = setup({
        baseHref: '/en-US/',
        locale: 'en-US',
        url: '/en-US/claims',
      });

      switcher.switchTo('es-CO');

      expect(assign).toHaveBeenCalledOnceWith('/es-CO/claims');
    });

    it('should keep a folder prefix when the app is deployed under a sub-path', () => {
      const { switcher, assign } = setup({
        baseHref: '/portal/es-CO/',
        locale: 'es-CO',
        url: '/portal/es-CO/claims',
      });

      switcher.switchTo('en-US');

      expect(assign).toHaveBeenCalledOnceWith('/portal/en-US/claims');
    });

    it('should remember the chosen language', () => {
      const { switcher } = setup(SPANISH_BUILD);

      switcher.switchTo('en-US');

      expect(localStorage.getItem('solventa.language')).toBe('en-US');
    });

    it('should do nothing when the language is already the current one', () => {
      const { switcher, assign } = setup(SPANISH_BUILD);

      switcher.switchTo('es-CO');

      expect(assign).not.toHaveBeenCalled();
    });

    it('should do nothing, and remember nothing, when switching is not possible', () => {
      const { switcher, assign } = setup({ baseHref: '/', locale: 'es-CO', url: '/quote' });

      switcher.switchTo('en-US');

      expect(assign).not.toHaveBeenCalled();
      expect(localStorage.getItem('solventa.language')).toBeNull();
    });
  });

  describe('applyStoredPreference', () => {
    it('should send the user to the language they chose before', () => {
      localStorage.setItem('solventa.language', 'en-US');
      const { switcher, assign } = setup(SPANISH_BUILD);

      switcher.applyStoredPreference();

      expect(assign).toHaveBeenCalledOnceWith('/en-US/quote');
    });

    it('should stay when the open build already is the chosen language', () => {
      localStorage.setItem('solventa.language', 'es-CO');
      const { switcher, assign } = setup(SPANISH_BUILD);

      switcher.applyStoredPreference();

      expect(assign).not.toHaveBeenCalled();
    });

    it('should stay when the user never chose a language', () => {
      const { switcher, assign } = setup(SPANISH_BUILD);

      switcher.applyStoredPreference();

      expect(assign).not.toHaveBeenCalled();
    });
  });
});
