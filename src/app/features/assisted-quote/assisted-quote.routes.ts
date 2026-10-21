import { Routes } from '@angular/router';
import { AssistedQuotePage } from './pages/assisted-quote-page';

export const ASSISTED_QUOTE_ROUTES: Routes = [
  {
    path: '',
    component: AssistedQuotePage,
    title: $localize`:@@assistedQuote.document-title:Solventa — Cotización asistida`,
  },
];
