import { Routes } from '@angular/router';
import { provideGateway } from '@core/config/data-source';
import { AssistedReviewGateway } from './data-access/assisted-review.gateway';
import { HttpAssistedReviewGateway } from './data-access/http-assisted-review.gateway';
import { MockAssistedReviewGateway } from './data-access/mock-assisted-review.gateway';
import { ReviewDetailPage } from './pages/review-detail-page';
import { ReviewInboxPage } from './pages/review-inbox-page';

export const ASSISTED_REVIEW_ROUTES: Routes = [
  {
    path: '',
    // Un solo adaptador para la bandeja y el detalle: en modo simulado comparten los datos.
    providers: [
      provideGateway(AssistedReviewGateway, HttpAssistedReviewGateway, MockAssistedReviewGateway),
    ],
    children: [
      {
        path: '',
        component: ReviewInboxPage,
        title: $localize`:@@assistedReview.inbox.document-title:Solventa — Revisión asistida`,
      },
      {
        path: ':reviewId',
        component: ReviewDetailPage,
        title: $localize`:@@assistedReview.detail.document-title:Solventa — Detalle de la revisión asistida`,
      },
    ],
  },
];
