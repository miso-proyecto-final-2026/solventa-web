import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('@features/home/home.routes').then((m) => m.HOME_ROUTES),
  },
  // Mientras no existan las demás pantallas (cotizar, pólizas…), vuelven al inicio.
  { path: '**', redirectTo: '' },
];
