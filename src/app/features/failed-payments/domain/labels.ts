import { ApiError } from '@core/http/api-error';
import { CaseStatus, GraceStatus, RetryResult } from './models';

export function caseStatusLabel(status: CaseStatus): string {
  switch (status) {
    case 'PENDING':
      return $localize`:@@failedPayments.status.pending:Pendiente`;
    case 'EXPIRED':
      return $localize`:@@failedPayments.status.expired:Gracia vencida`;
    case 'RECOVERED':
      return $localize`:@@failedPayments.status.recovered:Recuperado`;
  }
}

export function graceLabel(grace: GraceStatus): string {
  switch (grace) {
    case 'CURRENT':
      return $localize`:@@failedPayments.grace.current:En gracia`;
    case 'DUE_SOON':
      return $localize`:@@failedPayments.grace.due-soon:Vence en menos de 24 h`;
    case 'OVERDUE':
      return $localize`:@@failedPayments.grace.overdue:Gracia vencida`;
  }
}

/** Bandeja y detalle: cada falla pide una acción distinta. */
export function loadErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case 'unauthenticated':
      return $localize`:@@failedPayments.error.unauthenticated:Tu sesión venció. Inicia sesión de nuevo para continuar.`;
    case 'forbidden':
      return $localize`:@@failedPayments.error.forbidden:Tu usuario no tiene permiso para gestionar cobros fallidos.`;
    case 'not-found':
      return $localize`:@@failedPayments.error.not-found:Este cobro fallido no existe. Vuelve a la bandeja y elige otro.`;
    case 'network':
      return $localize`:@@failedPayments.error.network:No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.`;
    case 'validation':
    case 'server':
      return $localize`:@@failedPayments.error.server:No pudimos cargar los cobros fallidos por un problema del servidor. Inténtalo de nuevo en unos minutos.`;
  }
}

export function noteErrorMessage(error: ApiError): string {
  if (error.code === 'DATO_DE_TARJETA_NO_PERMITIDO') {
    return $localize`:@@failedPayments.note.error.card:La nota no puede llevar números de tarjeta. Quítalo y guarda de nuevo.`;
  }
  if (error.kind === 'validation') {
    return $localize`:@@failedPayments.note.error.length:Escribe una nota de 1 a 1000 caracteres.`;
  }
  return loadErrorMessage(error);
}

export function retryErrorMessage(error: ApiError): string {
  if (error.code === 'CASO_YA_RECUPERADO') {
    return $localize`:@@failedPayments.retry.error.recovered:Este cobro ya se recuperó; no hace falta reintentarlo.`;
  }
  if (error.code === 'PASARELA_NO_DISPONIBLE' || error.status === 503) {
    return $localize`:@@failedPayments.retry.error.gateway:La pasarela de pago no responde. Inténtalo de nuevo en unos minutos.`;
  }
  return loadErrorMessage(error);
}

/** Resultado del reintento, distinguible del rechazo y de la pasarela caída (criterio 4). */
export function retryResultMessage(result: RetryResult): string {
  if (result.replay && result.outcome === 'IN_PROGRESS') {
    return $localize`:@@failedPayments.retry.replay:Ya hay un reintento en curso para este cobro; no se cobró otra vez.`;
  }
  switch (result.outcome) {
    case 'APPROVED':
      return $localize`:@@failedPayments.retry.approved:Cobro aprobado. El caso quedó recuperado.`;
    case 'DECLINED': {
      const reason = result.declineReason ?? '';
      return $localize`:@@failedPayments.retry.declined:La pasarela rechazó el cobro otra vez: ${reason}:reason:.`;
    }
    case 'IN_PROGRESS':
      return result.gatewayDetail === 'UNAVAILABLE'
        ? $localize`:@@failedPayments.retry.unavailable:La pasarela de pago no está disponible. El cobro quedó en proceso y se reintentará solo; revisa el estado en unos minutos.`
        : $localize`:@@failedPayments.retry.no-response:La pasarela no respondió. Estamos confirmando si el cobro pasó; revisa el estado en unos minutos antes de reintentar.`;
  }
}

export function retryResultKind(result: RetryResult): 'success' | 'error' | 'warning' {
  if (result.outcome === 'APPROVED') return 'success';
  return result.outcome === 'DECLINED' ? 'error' : 'warning';
}
