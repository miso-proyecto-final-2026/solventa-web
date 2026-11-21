import { Routes } from '@angular/router';
import { provideGateway } from '@core/config/data-source';
import { HttpReconciliationGateway } from './data-access/http-reconciliation.gateway';
import { MockReconciliationGateway } from './data-access/mock-reconciliation.gateway';
import { ReconciliationGateway } from './data-access/reconciliation.gateway';
import { DisbursementDetailPage } from './pages/disbursement-detail-page';
import { ReconciliationPage } from './pages/reconciliation-page';

export const RECONCILIATION_ROUTES: Routes = [
  {
    path: '',
    // Un solo adaptador para la lista y el detalle: en modo simulado comparten los datos.
    providers: [
      provideGateway(ReconciliationGateway, HttpReconciliationGateway, MockReconciliationGateway),
    ],
    children: [
      {
        path: '',
        component: ReconciliationPage,
        title: $localize`:@@reconciliation.document-title:Solventa — Conciliación de desembolsos`,
      },
      {
        path: ':disbursementId',
        component: DisbursementDetailPage,
        title: $localize`:@@reconciliation.detail.document-title:Solventa — Detalle del desembolso`,
      },
    ],
  },
];
