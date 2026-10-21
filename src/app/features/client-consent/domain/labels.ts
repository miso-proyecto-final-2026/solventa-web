import { ApiError } from '@core/http/api-error';
import { ConsentState } from '../../assisted-quote/domain/models';

/** Los tres estados que ve el asesor. «No solicitado» es el cliente que nunca decidió. */
export function consentStatusLabel(state: ConsentState): string {
  switch (state) {
    case 'GRANTED':
      return $localize`:@@clientConsent.status.granted:Consentimiento otorgado`;
    case 'REVOKED':
      return $localize`:@@clientConsent.status.revoked:Consentimiento revocado`;
    case 'NOT_GRANTED':
      return $localize`:@@clientConsent.status.not-requested:Consentimiento no solicitado`;
  }
}

/** Cada falla pide una acción distinta: reintentar, iniciar sesión o pedir permiso. */
export function lookupErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case 'unauthenticated':
      return $localize`:@@clientConsent.error.unauthenticated:Tu sesión venció. Inicia sesión de nuevo para consultar.`;
    case 'forbidden':
      return $localize`:@@clientConsent.error.forbidden:Tu usuario no tiene permiso para consultar el consentimiento de un cliente.`;
    case 'validation':
      return $localize`:@@clientConsent.error.validation:El documento no es válido. Revisa el tipo y el número e inténtalo de nuevo.`;
    case 'network':
      return $localize`:@@clientConsent.error.network:No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.`;
    case 'not-found':
    case 'server':
      return $localize`:@@clientConsent.error.server:No pudimos consultar el consentimiento por un problema del servidor. Inténtalo de nuevo en unos minutos.`;
  }
}
