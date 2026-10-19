import { Injectable } from '@angular/core';
import { AppLocale, isAppLocale } from '../i18n/locales';

const LANGUAGE_KEY = 'solventa.language';

/** Ajustes que el usuario elige y que se recuerdan en este navegador. */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  /** Idioma elegido por el usuario, o null si nunca eligió (o el valor guardado no es válido). */
  getLanguage(): AppLocale | null {
    try {
      const stored = localStorage.getItem(LANGUAGE_KEY);
      return isAppLocale(stored) ? stored : null;
    } catch {
      return null; // almacenamiento bloqueado: la app funciona, solo no recuerda
    }
  }

  setLanguage(language: AppLocale): void {
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // sin almacenamiento no se puede recordar; el cambio de idioma igual se hace
    }
  }
}
