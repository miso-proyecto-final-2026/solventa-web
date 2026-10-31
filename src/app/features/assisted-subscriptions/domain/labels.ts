import { ApiError } from '@core/http/api-error';
import { SagaStatus, SagaStep } from './models';

export function sagaStatusLabel(status: SagaStatus): string {
  switch (status) {
    case 'EN_PROGRESO':
      return $localize`:@@subscriptions.status.in-progress:En decisión`;
    case 'APROBADA':
      return $localize`:@@subscriptions.status.approved:Aprobada, por cobrar`;
    case 'COBRO_REALIZADO':
      return $localize`:@@subscriptions.status.charged:Cobro realizado`;
    case 'FIRMADA':
      return $localize`:@@subscriptions.status.signed:Firmada`;
    case 'EMITIDA':
      return $localize`:@@subscriptions.status.issued:Emitida`;
    case 'RECHAZADA':
      return $localize`:@@subscriptions.status.rejected:Rechazada`;
    case 'COMPENSADA':
      return $localize`:@@subscriptions.status.compensated:Compensada`;
  }
}

export function stepLabel(step: SagaStep): string {
  switch (step) {
    case 'DECISION':
      return $localize`:@@subscriptions.step.decision:Decisión`;
    case 'COBRO':
      return $localize`:@@subscriptions.step.charge:Cobro`;
    case 'FIRMA':
      return $localize`:@@subscriptions.step.signature:Firma`;
    case 'EMISION':
      return $localize`:@@subscriptions.step.issue:Emisión`;
  }
}

/** Qué pasó con el cobro y por qué: el motivo es un código del backend, el texto sale de aquí. */
export function compensationMessage(status: string, reason: string | null): string {
  const cause =
    reason === 'FIRMA_FALLIDA'
      ? $localize`:@@subscriptions.compensation.failed:No se pudo verificar la identidad del cliente al firmar.`
      : $localize`:@@subscriptions.compensation.expired:El plazo para firmar terminó.`;
  const refund =
    status === 'COMPLETADA'
      ? $localize`:@@subscriptions.compensation.done:El cobro ya se devolvió y la póliza quedó anulada. El cliente puede volver a cotizar.`
      : $localize`:@@subscriptions.compensation.requested:Se solicitó la devolución del cobro; la saga termina cuando Pagos la confirme.`;
  return `${cause} ${refund}`;
}

/** Lista y detalle: cada falla pide una acción distinta. */
export function loadErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case 'unauthenticated':
      return $localize`:@@subscriptions.error.unauthenticated:Tu sesión venció. Inicia sesión de nuevo para continuar.`;
    case 'forbidden':
      return $localize`:@@subscriptions.error.forbidden:Esta suscripción es de un cliente que no atendiste. Solo su asesor puede gestionarla.`;
    case 'not-found':
      return $localize`:@@subscriptions.error.not-found:Esta suscripción no existe. Vuelve a la lista y elige otra.`;
    case 'network':
      return $localize`:@@subscriptions.error.network:No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.`;
    case 'validation':
    case 'server':
      return $localize`:@@subscriptions.error.server:No pudimos completar la operación por un problema del servidor. Inténtalo de nuevo en unos minutos.`;
  }
}

export function startErrorMessage(error: ApiError): string {
  switch (error.code) {
    case 'COTIZACION_SIN_CUENTA':
      return $localize`:@@subscriptions.start.error.no-account:Esta cotización es de una persona sin cuenta. Debe registrarse para poder suscribirse y firmar.`;
    case 'COTIZACION_VENCIDA':
      return $localize`:@@subscriptions.start.error.expired:La cotización venció. Genera una nueva para continuar.`;
    case 'COTIZACION_YA_USADA':
      return $localize`:@@subscriptions.start.error.used:Esta cotización ya tiene una suscripción en curso. Búscala en la lista de suscripciones.`;
    case 'COTIZACION_NO_ENCONTRADA':
      return $localize`:@@subscriptions.start.error.not-found:Esta cotización no existe. Vuelve a cotizar.`;
    case 'ACCESO_DENEGADO':
      return $localize`:@@subscriptions.start.error.forbidden:Esta cotización la hizo otro asesor. Solo quien la hizo puede iniciar la suscripción.`;
    case 'VALIDATION_ERROR':
      return $localize`:@@subscriptions.start.error.validation:Revisa los datos del pago y confirma que el cliente aceptó.`;
  }
  return loadErrorMessage(error);
}

/** Los intentos que quedan vienen en el detalle del error (`intentos restantes: 2`). */
function attemptsLeft(error: ApiError): number | null {
  const match = /\d+/.exec(error.fields.find((f) => f.field === 'codigo')?.reason ?? '');
  return match ? Number(match[0]) : null;
}

/**
 * Cada error dice qué sigue (criterio 8). `OTP_INVALIDO` es 403: se mira el código antes que el
 * tipo; si no, se mostraría como falta de permiso.
 */
export function signErrorMessage(error: ApiError): string {
  switch (error.code) {
    case 'OTP_INVALIDO': {
      const left = attemptsLeft(error);
      return left === null
        ? $localize`:@@subscriptions.sign.error.otp:El código no es correcto. Si se agotan los intentos, la firma falla y se devuelve el cobro.`
        : $localize`:@@subscriptions.sign.error.otp-left:El código no es correcto. Intentos restantes: ${left}:left:. Si se agotan, la firma falla y se devuelve el cobro.`;
    }
    case 'FIRMA_VENCIDA':
      return $localize`:@@subscriptions.sign.error.expired:El plazo para firmar terminó y el cobro se devolverá. El cliente puede volver a cotizar.`;
    case 'FIRMA_FALLIDA':
      return $localize`:@@subscriptions.sign.error.failed:No se pudo verificar la identidad y el cobro se devolverá. El cliente puede volver a cotizar.`;
    case 'FIRMA_NO_DISPONIBLE':
      return $localize`:@@subscriptions.sign.error.unavailable:Esta suscripción ya no está en el paso de firma. Vuelve a cargarla para ver su estado.`;
    case 'POLIZA_NO_LISTA':
      return $localize`:@@subscriptions.sign.error.not-ready:El documento de la póliza aún no está listo. Inténtalo de nuevo en unos minutos.`;
    case 'DOCUMENTO_ALTERADO':
      return $localize`:@@subscriptions.sign.error.altered:El documento cambió. Ábrelo de nuevo y revísalo antes de firmar.`;
  }
  return loadErrorMessage(error);
}

/** Las descargas piden un `Blob`: su error no trae el código del backend, solo el estado HTTP. */
export function downloadErrorMessage(error: ApiError): string {
  return error.status === 409
    ? $localize`:@@subscriptions.download.error.conflict:El documento aún no está disponible. Vuelve a cargar la suscripción para ver su estado.`
    : loadErrorMessage(error);
}
