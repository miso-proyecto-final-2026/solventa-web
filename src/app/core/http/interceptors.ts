import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@env/environment';
import { catchError, throwError } from 'rxjs';
import { SessionStore } from '../auth/session.store';
import { toApiError } from './api-error';

/**
 * Una ruta pública con su propia credencial (la firma por enlace, HU39): no lleva el token del asesor y
 * un 401 suyo no le cierra la sesión a un asesor que tenga la consola abierta en el mismo navegador.
 */
export const PUBLIC_REQUEST = new HttpContextToken<boolean>(() => false);

/** Agrega el token del asesor, y solo a las llamadas al API propio (nunca a terceros). */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(PUBLIC_REQUEST)) return next(req);
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
      const expired =
        apiError.kind === 'unauthenticated' &&
        session.isAuthenticated() &&
        !req.context.get(PUBLIC_REQUEST);
      if (expired) session.expire();
      return throwError(() => apiError);
    }),
  );
};
