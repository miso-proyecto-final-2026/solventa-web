import { DOCUMENT, LocationStrategy } from '@angular/common';
import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { PreferencesService } from '../preferences/preferences.service';
import { APP_LOCALES, AppLocale, isAppLocale } from './locales';

/**
 * Cambia de idioma llevando al usuario al build del otro idioma (`/es-CO/` ↔ `/en-US/`).
 * `@angular/localize` traduce al compilar, por eso cambiar de idioma es cambiar de sitio.
 */
@Injectable({ providedIn: 'root' })
export class LocaleSwitcher {
  private readonly document = inject(DOCUMENT);
  private readonly preferences = inject(PreferencesService);
  private readonly baseHref = inject(LocationStrategy).getBaseHref();
  private readonly localeId = inject(LOCALE_ID);

  /** Idioma del build que se está mostrando. */
  readonly current: AppLocale = isAppLocale(this.localeId) ? this.localeId : APP_LOCALES[0];

  /** El otro idioma disponible. */
  readonly other: AppLocale = APP_LOCALES.find((locale) => locale !== this.current) ?? this.current;

  /**
   * Solo se puede cambiar cuando la app corre en un build por idioma (`<base href="/es-CO/">`).
   * El servidor de desarrollo sirve un único idioma bajo `/`, y ahí no hay otro sitio al que ir.
   */
  readonly canSwitch = this.baseHref.endsWith(`/${this.current}/`);

  /** Guarda la elección y lleva al usuario a la misma pantalla en el otro idioma. */
  switchTo(locale: AppLocale): void {
    if (!this.canSwitch || locale === this.current) return;

    this.preferences.setLanguage(locale);

    const { pathname, search, hash } = this.document.location;
    const rest = pathname.slice(this.baseHref.length) + search + hash;
    const base = this.baseHref.slice(0, -(this.current.length + 1)) + `${locale}/`;
    this.document.location.assign(base + rest);
  }

  /** Al abrir la app: si el usuario eligió otro idioma antes, lo lleva a ese build. */
  applyStoredPreference(): void {
    const preferred = this.preferences.getLanguage();
    if (preferred) this.switchTo(preferred);
  }
}
