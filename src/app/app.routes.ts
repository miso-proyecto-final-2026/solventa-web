import { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { COMING_SOON_SECTIONS } from '@features/coming-soon/coming-soon.sections';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadChildren: () => import('@features/home/home.routes').then((m) => m.HOME_ROUTES),
  },
  {
    path: 'login',
    loadChildren: () => import('@features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    // Solo asesores: sin sesión lleva a /login y con otro rol, al inicio. La API valida el rol de nuevo.
    path: 'assisted-quote',
    canMatch: [roleGuard('ASESOR')],
    loadChildren: () =>
      import('@features/assisted-quote/assisted-quote.routes').then((m) => m.ASSISTED_QUOTE_ROUTES),
  },
  {
    // Solo asesores, como la cotización asistida. La API valida el rol de nuevo (403 sin él).
    path: 'client-consent',
    canMatch: [roleGuard('ASESOR')],
    loadChildren: () =>
      import('@features/client-consent/client-consent.routes').then((m) => m.CLIENT_CONSENT_ROUTES),
  },
  {
    // HU19: asesores y operadores gestionan los cobros de prima rechazados. La API valida el rol de nuevo.
    path: 'failed-payments',
    canMatch: [roleGuard('ASESOR', 'OPERADOR')],
    loadChildren: () =>
      import('@features/failed-payments/failed-payments.routes').then(
        (m) => m.FAILED_PAYMENTS_ROUTES,
      ),
  },
  {
    // HU16: el asesor decide los casos que la decisión automática derivó. La API valida el rol de nuevo.
    path: 'assisted-review',
    canMatch: [roleGuard('ASESOR')],
    loadChildren: () =>
      import('@features/assisted-review/assisted-review.routes').then(
        (m) => m.ASSISTED_REVIEW_ROUTES,
      ),
  },
  {
    // HU31: solo operadores concilian los desembolsos de indemnizaciones. La API valida el rol de nuevo (403 sin él).
    path: 'reconciliation',
    canMatch: [roleGuard('OPERADOR')],
    loadChildren: () =>
      import('@features/reconciliation/reconciliation.routes').then((m) => m.RECONCILIATION_ROUTES),
  },
  {
    // HU39: el asesor inicia y sigue las suscripciones de sus cotizaciones. La API valida rol y relación con el cliente.
    path: 'subscriptions',
    canMatch: [roleGuard('ASESOR')],
    loadChildren: () =>
      import('@features/assisted-subscriptions/assisted-subscriptions.routes').then(
        (m) => m.ASSISTED_SUBSCRIPTIONS_ROUTES,
      ),
  },
  {
    // HU39: el cliente firma con el enlace del correo. Pública a propósito: la credencial es el enlace más su código.
    path: 'sign',
    loadChildren: () =>
      import('@features/sign-link/sign-link.routes').then((m) => m.SIGN_LINK_ROUTES),
  },
  // El menú ya enlaza estas pantallas, pero todavía no existen: una página lo dice en lugar de volver al inicio.
  ...COMING_SOON_SECTIONS.map((path) => ({
    path,
    loadChildren: () =>
      import('@features/coming-soon/coming-soon.routes').then((m) => m.comingSoonRoutes(path)),
  })),
  { path: '**', redirectTo: '' },
];
