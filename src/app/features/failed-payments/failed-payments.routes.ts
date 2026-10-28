import { Routes } from '@angular/router';
import { provideGateway } from '@core/config/data-source';
import { FailedPaymentsGateway } from './data-access/failed-payments.gateway';
import { HttpFailedPaymentsGateway } from './data-access/http-failed-payments.gateway';
import { MockFailedPaymentsGateway } from './data-access/mock-failed-payments.gateway';
import { CaseDetailPage } from './pages/case-detail-page';
import { InboxPage } from './pages/inbox-page';

export const FAILED_PAYMENTS_ROUTES: Routes = [
  {
    path: '',
    // Un solo adaptador para la bandeja y el detalle: en modo simulado comparten los datos.
    providers: [
      provideGateway(FailedPaymentsGateway, HttpFailedPaymentsGateway, MockFailedPaymentsGateway),
    ],
    children: [
      {
        path: '',
        component: InboxPage,
        title: $localize`:@@failedPayments.inbox.document-title:Solventa — Cobros fallidos`,
      },
      {
        path: ':caseId',
        component: CaseDetailPage,
        title: $localize`:@@failedPayments.detail.document-title:Solventa — Detalle del cobro fallido`,
      },
    ],
  },
];
