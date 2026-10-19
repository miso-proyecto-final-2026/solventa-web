import { Routes } from '@angular/router';
import { HomePage } from './pages/home-page';

export const HOME_ROUTES: Routes = [
  {
    path: '',
    component: HomePage,
    title: $localize`:@@home.document-title:Solventa — Inicio`,
  },
];
