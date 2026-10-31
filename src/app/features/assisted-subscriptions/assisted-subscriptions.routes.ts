import { Routes } from '@angular/router';
import { provideGateway } from '@core/config/data-source';
import { AssistedSubscriptionsGateway } from './data-access/assisted-subscriptions.gateway';
import { HttpAssistedSubscriptionsGateway } from './data-access/http-assisted-subscriptions.gateway';
import { MockAssistedSubscriptionsGateway } from './data-access/mock-assisted-subscriptions.gateway';
import { StartSubscriptionPage } from './pages/start-subscription-page';
import { SubscriptionDetailPage } from './pages/subscription-detail-page';
import { SubscriptionListPage } from './pages/subscription-list-page';

export const ASSISTED_SUBSCRIPTIONS_ROUTES: Routes = [
  {
    path: '',
    // Un solo adaptador para todas las pantallas: en modo simulado comparten los datos.
    providers: [
      provideGateway(
        AssistedSubscriptionsGateway,
        HttpAssistedSubscriptionsGateway,
        MockAssistedSubscriptionsGateway,
      ),
    ],
    children: [
      {
        path: '',
        component: SubscriptionListPage,
        title: $localize`:@@subscriptions.list.document-title:Solventa — Suscripciones`,
      },
      {
        path: 'new/:quoteId',
        component: StartSubscriptionPage,
        title: $localize`:@@subscriptions.start.document-title:Solventa — Iniciar suscripción`,
      },
      {
        path: ':id',
        component: SubscriptionDetailPage,
        title: $localize`:@@subscriptions.detail.document-title:Solventa — Detalle de la suscripción`,
      },
    ],
  },
];
