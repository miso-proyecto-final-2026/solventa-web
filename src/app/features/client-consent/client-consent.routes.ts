import { Routes } from '@angular/router';
import { ClientConsentPage } from './pages/client-consent-page';

export const CLIENT_CONSENT_ROUTES: Routes = [
  {
    path: '',
    component: ClientConsentPage,
    title: $localize`:@@clientConsent.document-title:Solventa — Consentimiento del cliente`,
  },
];
