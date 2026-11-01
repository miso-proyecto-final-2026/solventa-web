import { Routes } from '@angular/router';
import { provideGateway } from '@core/config/data-source';
import { HttpSignLinkGateway } from './data-access/http-sign-link.gateway';
import { MockSignLinkGateway } from './data-access/mock-sign-link.gateway';
import { SignLinkGateway } from './data-access/sign-link.gateway';
import { SignLinkPage } from './pages/sign-link-page';

export const SIGN_LINK_ROUTES: Routes = [
  {
    path: '',
    providers: [provideGateway(SignLinkGateway, HttpSignLinkGateway, MockSignLinkGateway)],
    component: SignLinkPage,
    title: $localize`:@@sign-link.document-title:Solventa — Firma de tu póliza`,
  },
];
