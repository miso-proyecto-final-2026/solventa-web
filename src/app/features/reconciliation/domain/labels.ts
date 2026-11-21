import { ApiError } from '@core/http/api-error';
import { PaymentState, ReconciliationStatus } from './models';

export function reconciliationLabel(status: ReconciliationStatus): string {
  switch (status) {
    case 'PENDING':
      return $localize`:@@reconciliation.status.pending:Pendiente`;
    case 'RECONCILED':
      return $localize`:@@reconciliation.status.reconciled:Conciliado`;
    case 'WITH_DIFFERENCE':
      return $localize`:@@reconciliation.status.with-difference:Con diferencia`;
  }
}

export function paymentStateLabel(state: PaymentState): string {
  switch (state) {
    case 'PENDING':
      return $localize`:@@reconciliation.payment.pending:Pago en curso`;
    case 'PAID':
      return $localize`:@@reconciliation.payment.paid:Pagado`;
    case 'FAILED':
      return $localize`:@@reconciliation.payment.failed:Pago fallido`;
  }
}

/** Tipos de evento de `reglas/parametricas.yaml`; uno desconocido se muestra tal cual en lugar de ocultarse. */
export function eventTypeLabel(type: string | null): string {
  switch (type) {
    case null:
      return '—';
    case 'sismo':
      return $localize`:@@reconciliation.event.sismo:Sismo`;
    case 'inundacion':
      return $localize`:@@reconciliation.event.inundacion:Inundación`;
    case 'sequia':
      return $localize`:@@reconciliation.event.sequia:Sequía`;
    case 'tormenta':
      return $localize`:@@reconciliation.event.tormenta:Tormenta`;
    case 'vuelo_retrasado':
      return $localize`:@@reconciliation.event.vuelo-retrasado:Vuelo retrasado`;
    case 'vuelo_cancelado':
      return $localize`:@@reconciliation.event.vuelo-cancelado:Vuelo cancelado`;
    default:
      return type;
  }
}

/** Nombre y unidad de cada magnitud que compara una regla. */
export function magnitudeLabel(field: string): string {
  switch (field) {
    case 'magnitud':
      return $localize`:@@reconciliation.magnitude.magnitud:Magnitud`;
    case 'nivel_rio_cm':
      return $localize`:@@reconciliation.magnitude.nivel-rio:Nivel del río (cm)`;
    case 'precipitacion_mm_30d':
      return $localize`:@@reconciliation.magnitude.precipitacion:Precipitación 30 días (mm)`;
    case 'viento_kmh':
      return $localize`:@@reconciliation.magnitude.viento:Viento (km/h)`;
    case 'retraso_minutos':
      return $localize`:@@reconciliation.magnitude.retraso:Retraso (min)`;
    default:
      return field;
  }
}

export function magnitudeText(magnitude: Readonly<Record<string, number | string>> | null): string {
  if (!magnitude) return '—';
  const parts = Object.entries(magnitude).map(([k, v]) => `${magnitudeLabel(k)}: ${v}`);
  return parts.length ? parts.join(' · ') : '—';
}

/** Lista y detalle: cada falla pide una acción distinta. */
export function loadErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case 'unauthenticated':
      return $localize`:@@reconciliation.error.unauthenticated:Tu sesión venció. Inicia sesión de nuevo para continuar.`;
    case 'forbidden':
      return $localize`:@@reconciliation.error.forbidden:Solo los operadores pueden conciliar desembolsos.`;
    case 'not-found':
      return $localize`:@@reconciliation.error.not-found:Este desembolso no existe. Vuelve a la lista y elige otro.`;
    case 'network':
      return $localize`:@@reconciliation.error.network:No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.`;
    case 'validation':
    case 'server':
      return $localize`:@@reconciliation.error.server:No pudimos cargar los desembolsos por un problema del servidor. Inténtalo de nuevo en unos minutos.`;
  }
}

export function reconcileErrorMessage(error: ApiError): string {
  if (error.code === 'EXTRACTO_SIN_PAGO') {
    return $localize`:@@reconciliation.reconcile.error.no-payment:La pasarela no tiene un pago con la clave de este desembolso. No se cambió nada: verifica con el equipo de pagos.`;
  }
  if (error.code === 'DESEMBOLSO_NO_CONCILIABLE') {
    return $localize`:@@reconciliation.reconcile.error.not-paid:Solo se concilian los desembolsos pagados.`;
  }
  return loadErrorMessage(error);
}

export function escalateErrorMessage(error: ApiError): string {
  if (error.code === 'DESEMBOLSO_SIN_DIFERENCIA') {
    return $localize`:@@reconciliation.escalate.error.no-difference:Solo se escalan los desembolsos con diferencia.`;
  }
  if (error.kind === 'validation') {
    return $localize`:@@reconciliation.escalate.error.note:Escribe una nota de 1 a 500 caracteres.`;
  }
  return loadErrorMessage(error);
}

export function exportErrorMessage(error: ApiError): string {
  if (error.kind === 'unauthenticated' || error.kind === 'forbidden' || error.kind === 'network') {
    return loadErrorMessage(error);
  }
  return $localize`:@@reconciliation.export.error:No pudimos generar el reporte. Inténtalo de nuevo en unos minutos.`;
}
