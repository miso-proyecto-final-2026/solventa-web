import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { SessionStore } from './session.store';

/**
 * Deja pasar solo a quien tiene sesión vigente con el rol dado. Sin sesión, lleva al inicio de
 * sesión recordando a dónde iba; con otro rol, al inicio. El backend valida el rol de nuevo:
 * esta guarda solo evita mostrar pantallas que no corresponden.
 */
export const roleGuard =
  (role: string): CanMatchFn =>
  (_route, segments) => {
    const session = inject(SessionStore);
    const router = inject(Router);

    if (!session.isActive()) {
      const returnUrl = '/' + segments.map((s) => s.path).join('/');
      return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
    }
    return session.hasRole(role) ? true : router.createUrlTree(['/']);
  };
