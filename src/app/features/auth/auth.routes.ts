import { Routes } from '@angular/router';
import { LoginPage } from './pages/login-page';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: LoginPage,
    title: $localize`:@@auth.login.document-title:Solventa — Iniciar sesión`,
  },
];
