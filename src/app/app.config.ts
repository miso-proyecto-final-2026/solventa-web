import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { LocaleSwitcher } from '@core/i18n/locale-switcher';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Si el usuario eligió otro idioma antes, se le lleva a ese build al abrir la app.
    provideAppInitializer(() => inject(LocaleSwitcher).applyStoredPreference()),
  ],
};
