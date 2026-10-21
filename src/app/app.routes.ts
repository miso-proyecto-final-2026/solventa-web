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
  // Mientras no existan las demás pantallas (cotizar, pólizas…), vuelven al inicio.
  { path: '**', redirectTo: '' },
];
