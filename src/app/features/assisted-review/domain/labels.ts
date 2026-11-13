import { ApiError } from '@core/http/api-error';
import {
  ProfileSource,
  ReviewCategory,
  ReviewDecision,
  ReviewPriority,
  ReviewState,
  RiskLevel,
} from './models';

export function priorityLabel(priority: ReviewPriority): string {
  switch (priority) {
    case 'HIGH':
      return $localize`:@@assistedReview.priority.high:Alta`;
    case 'MEDIUM':
      return $localize`:@@assistedReview.priority.medium:Media`;
    case 'LOW':
      return $localize`:@@assistedReview.priority.low:Baja`;
  }
}

/** El icono acompaña al texto: la prioridad no depende solo del color. */
export function priorityIcon(priority: ReviewPriority): string {
  return { HIGH: '▲', MEDIUM: '◆', LOW: '▼' }[priority];
}

export function categoryLabel(category: ReviewCategory): string {
  switch (category) {
    case 'RISK_PROFILE_OUT_OF_RANGE':
      return $localize`:@@assistedReview.category.risk-profile:Variables del perfil fuera de rango`;
    case 'AMOUNT_OVER_LIMIT':
      return $localize`:@@assistedReview.category.amount:Monto asegurado sobre el límite automático`;
    case 'INCOMPLETE_OR_INCONSISTENT_DATA':
      return $localize`:@@assistedReview.category.data:Datos incompletos o inconsistentes`;
  }
}

export function stateLabel(state: ReviewState): string {
  return state === 'PENDING'
    ? $localize`:@@assistedReview.state.pending:Pendiente`
    : $localize`:@@assistedReview.state.decided:Decidido`;
}

export function decisionLabel(decision: ReviewDecision): string {
  switch (decision) {
    case 'APPROVED':
      return $localize`:@@assistedReview.decision.approved:Aprobar`;
    case 'REJECTED':
      return $localize`:@@assistedReview.decision.rejected:Rechazar`;
    case 'ADJUSTED':
      return $localize`:@@assistedReview.decision.adjusted:Ajustar la cobertura`;
  }
}

/** El resultado ya decidido, en pasado. */
export function decisionResultLabel(decision: ReviewDecision): string {
  switch (decision) {
    case 'APPROVED':
      return $localize`:@@assistedReview.result.approved:Aprobado`;
    case 'REJECTED':
      return $localize`:@@assistedReview.result.rejected:Rechazado`;
    case 'ADJUSTED':
      return $localize`:@@assistedReview.result.adjusted:Ajustado`;
  }
}

/** Lo que pasará al confirmar: el cobro o el cierre sin cobro. */
export function decisionConsequence(decision: ReviewDecision): string {
  switch (decision) {
    case 'APPROVED':
      return $localize`:@@assistedReview.consequence.approved:Se cobrará la prima de la cotización y la compra continuará como si la decisión hubiera sido automática.`;
    case 'ADJUSTED':
      return $localize`:@@assistedReview.consequence.adjusted:Se cobrará la prima ajustada y la compra continuará, sin pedir otra aceptación al cliente.`;
    case 'REJECTED':
      return $localize`:@@assistedReview.consequence.rejected:La compra se cerrará sin cobro y el cliente podrá volver a cotizar.`;
  }
}

export function levelLabel(level: RiskLevel): string {
  switch (level) {
    case 'LOW':
      return $localize`:@@assistedReview.level.low:Bajo`;
    case 'MEDIUM':
      return $localize`:@@assistedReview.level.medium:Medio`;
    case 'HIGH':
      return $localize`:@@assistedReview.level.high:Alto`;
  }
}

export function profileSourceLabel(source: ProfileSource): string {
  switch (source) {
    case 'REAL':
      return $localize`:@@assistedReview.source.real:Perfil real del cliente`;
    case 'DEFAULT':
      return $localize`:@@assistedReview.source.default:Perfil por defecto`;
    case 'DEGRADED':
      return $localize`:@@assistedReview.source.degraded:Perfil degradado`;
  }
}

const SIGNALS: Readonly<Record<string, string>> = {
  ratio_endeudamiento: $localize`:@@assistedReview.signal.ratio_endeudamiento:Nivel de endeudamiento`,
  reportes_negativos: $localize`:@@assistedReview.signal.reportes_negativos:Reportes negativos`,
  ingresos_mensuales_cop: $localize`:@@assistedReview.signal.ingresos_mensuales_cop:Ingresos mensuales`,
};

export const signalLabel = (name: string): string => SIGNALS[name] ?? name;

const COVERAGES: Readonly<Record<string, string>> = {
  muerte: $localize`:@@assistedReview.coverage.muerte:Muerte`,
  incapacidad_total: $localize`:@@assistedReview.coverage.incapacidad_total:Incapacidad total`,
  dano_accidental: $localize`:@@assistedReview.coverage.dano_accidental:Daño accidental`,
  robo: $localize`:@@assistedReview.coverage.robo:Robo`,
};

export const coverageLabel = (type: string): string => COVERAGES[type] ?? type;

/**
 * Cargar la bandeja o el detalle. El `code` se evalúa antes que el `kind`: 409 y 422 llegan los dos
 * como `validation`.
 */
export function loadErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case 'unauthenticated':
      return $localize`:@@assistedReview.error.unauthenticated:Tu sesión venció. Inicia sesión de nuevo para continuar.`;
    case 'forbidden':
      return $localize`:@@assistedReview.error.forbidden:Tu usuario no tiene permiso para la revisión asistida. Solo los asesores pueden verla.`;
    case 'not-found':
      return $localize`:@@assistedReview.error.not-found:Este caso no existe o ya no está en revisión. Vuelve a la bandeja y elige otro.`;
    case 'network':
      return $localize`:@@assistedReview.error.network:No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.`;
    case 'validation':
    case 'server':
      return $localize`:@@assistedReview.error.server:No pudimos cargar los casos por un problema del servidor. Inténtalo de nuevo en unos minutos.`;
  }
}

/** Decidir un caso. Primero el código del negocio; después el tipo de fallo. */
export function decideErrorMessage(error: ApiError): string {
  switch (error.code) {
    case 'REVISION_YA_DECIDIDA':
      return $localize`:@@assistedReview.decide.error.already:Otro asesor ya decidió este caso.`;
    case 'COTIZACION_VENCIDA':
      return $localize`:@@assistedReview.decide.error.expired:La cotización venció mientras decidías. Solo se puede cerrar el caso; el cliente debe volver a cotizar.`;
    case 'COTIZACION_NO_DISPONIBLE':
      return $localize`:@@assistedReview.decide.error.quote-unavailable:No pudimos confirmar la vigencia de la cotización. Inténtalo de nuevo en un momento.`;
    case 'AJUSTE_INVALIDO':
      return $localize`:@@assistedReview.decide.error.adjustment:El nuevo monto asegurado debe ser mayor que cero y menor que el actual.`;
    case 'SIN_METODO_PAGO':
      return $localize`:@@assistedReview.decide.error.no-payment:La compra no tiene un método de pago para cobrar. No se puede aprobar ni ajustar; consulta con el equipo de soporte.`;
  }
  if (error.kind === 'validation') {
    return $localize`:@@assistedReview.decide.error.validation:Revisa los datos de la decisión: la justificación debe tener entre 20 y 2000 caracteres.`;
  }
  return loadErrorMessage(error);
}

/** Quién decidió y cuándo, a partir de los `details` del 409 `REVISION_YA_DECIDIDA`. */
export function alreadyDecidedBy(error: ApiError): { advisor: string; decidedAt: Date | null } {
  const field = (name: string) => error.fields.find((f) => f.field === name)?.reason ?? '';
  const at = field('decidido_en');
  return { advisor: field('asesor'), decidedAt: at ? new Date(at) : null };
}
