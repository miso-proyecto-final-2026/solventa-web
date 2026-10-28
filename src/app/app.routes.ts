import { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';

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
  // Mientras no existan las demás pantallas (cotizar, pólizas…), vuelven al inicio.
  { path: '**', redirectTo: '' },
];
