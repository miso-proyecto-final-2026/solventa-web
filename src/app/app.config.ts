import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { AuthGateway } from '@core/auth/auth.gateway';
import { HttpAuthGateway } from '@core/auth/http-auth.gateway';
import { MockAuthGateway } from '@core/auth/mock-auth.gateway';
import { provideGateway } from '@core/config/data-source';
import { LocaleSwitcher } from '@core/i18n/locale-switcher';
import { apiErrorInterceptor, authTokenInterceptor } from '@core/http/interceptors';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // El orden importa: primero se agrega el token y, al volver, se traducen los errores.
    provideHttpClient(withFetch(), withInterceptors([authTokenInterceptor, apiErrorInterceptor])),
    provideGateway(AuthGateway, HttpAuthGateway, MockAuthGateway),
    // Si el usuario eligió otro idioma antes, se le lleva a ese build al abrir la app.
    provideAppInitializer(() => inject(LocaleSwitcher).applyStoredPreference()),
  ],
};
