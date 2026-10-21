import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@env/environment';
import { catchError, throwError } from 'rxjs';
import { SessionStore } from '../auth/session.store';
import { toApiError } from './api-error';

/** Agrega el token del asesor, y solo a las llamadas al API propio (nunca a terceros). */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = req.url.startsWith(environment.apiBaseUrl) ? inject(SessionStore).token() : null;
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};

/**
 * Traduce los errores HTTP a `ApiError`. Un 401 con sesión iniciada significa que venció:
 * se marca para que la pantalla pida iniciar sesión de nuevo sin perder lo ingresado.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
      const apiError = toApiError(error);
      if (apiError.kind === 'unauthenticated' && session.isAuthenticated()) session.expire();
      return throwError(() => apiError);
    }),
  );
};
