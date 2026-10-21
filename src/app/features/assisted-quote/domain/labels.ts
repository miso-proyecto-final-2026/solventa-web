import { ApiError } from '@core/http/api-error';
import { ConsentState, ProfileSource, RiskLevel } from './models';

/**
 * Textos por código. El backend envía códigos estables (producto, cobertura, concepto, señal), no
 * texto traducible: aquí se convierten a recursos por idioma. Un código que aún no tiene
 * traducción se muestra tal cual, para que un producto nuevo no rompa la pantalla.
 */

const PRODUCTS: Record<string, string> = {
  microseguro_vida: $localize`:@@assistedQuote.product.microseguro_vida:Microseguro de vida`,
  proteccion_dispositivos: $localize`:@@assistedQuote.product.proteccion_dispositivos:Protección de dispositivos`,
};

const FIELDS: Record<string, string> = {
  edad: $localize`:@@assistedQuote.field.edad:Edad`,
  suma_asegurada: $localize`:@@assistedQuote.field.suma_asegurada:Suma asegurada`,
  tipo_dispositivo: $localize`:@@assistedQuote.field.tipo_dispositivo:Tipo de dispositivo`,
  valor_dispositivo: $localize`:@@assistedQuote.field.valor_dispositivo:Valor del dispositivo`,
  antiguedad_meses: $localize`:@@assistedQuote.field.antiguedad_meses:Antigüedad (meses)`,
};

const OPTIONS: Record<string, string> = {
  celular: $localize`:@@assistedQuote.option.celular:Celular`,
  portatil: $localize`:@@assistedQuote.option.portatil:Portátil`,
  tableta: $localize`:@@assistedQuote.option.tableta:Tableta`,
};

const COVERAGES: Record<string, string> = {
  muerte: $localize`:@@assistedQuote.coverage.muerte:Muerte`,
  incapacidad_total: $localize`:@@assistedQuote.coverage.incapacidad_total:Incapacidad total`,
  dano_accidental: $localize`:@@assistedQuote.coverage.dano_accidental:Daño accidental`,
  robo: $localize`:@@assistedQuote.coverage.robo:Robo`,
};

const COMPONENTS: Record<string, string> = {
  prima_base: $localize`:@@assistedQuote.component.prima_base:Prima base del producto`,
  ajuste_datos: $localize`:@@assistedQuote.component.ajuste_datos:Ajuste por los datos del seguro`,
  ajuste_riesgo: $localize`:@@assistedQuote.component.ajuste_riesgo:Ajuste por el perfil de riesgo`,
  recargo_degradado: $localize`:@@assistedQuote.component.recargo_degradado:Recargo por datos no disponibles`,
};

const SIGNALS: Record<string, string> = {
  ratio_endeudamiento: $localize`:@@assistedQuote.signal.ratio_endeudamiento:Nivel de endeudamiento`,
  reportes_negativos: $localize`:@@assistedQuote.signal.reportes_negativos:Reportes negativos`,
  ingresos_mensuales_cop: $localize`:@@assistedQuote.signal.ingresos_mensuales_cop:Ingresos mensuales`,
};

const lookup = (dictionary: Record<string, string>, code: string): string =>
  dictionary[code] ?? code;

export const productLabel = (code: string, fallback?: string): string =>
  PRODUCTS[code] ?? fallback ?? code;
export const fieldLabel = (name: string): string => lookup(FIELDS, name);
export const optionLabel = (value: string): string => lookup(OPTIONS, value);
export const coverageLabel = (type: string): string => lookup(COVERAGES, type);
export const componentLabel = (concept: string): string => lookup(COMPONENTS, concept);
export const signalLabel = (name: string): string => lookup(SIGNALS, name);

export function levelLabel(level: RiskLevel): string {
  switch (level) {
    case 'LOW':
      return $localize`:@@assistedQuote.level.low:Bajo`;
    case 'MEDIUM':
      return $localize`:@@assistedQuote.level.medium:Medio`;
    case 'HIGH':
      return $localize`:@@assistedQuote.level.high:Alto`;
  }
}

export function consentLabel(state: ConsentState): string {
  switch (state) {
    case 'GRANTED':
      return $localize`:@@assistedQuote.consent.granted:Consentimiento vigente`;
    case 'REVOKED':
      return $localize`:@@assistedQuote.consent.revoked:Consentimiento revocado`;
    case 'NOT_GRANTED':
      return $localize`:@@assistedQuote.consent.not-granted:Sin consentimiento`;
  }
}

/** Explica al asesor cómo afecta el consentimiento al precio que verá el cliente. */
export function consentEffect(source: ProfileSource): string {
  switch (source) {
    case 'REAL':
      return $localize`:@@assistedQuote.consent.effect.real:El precio se calcula con el perfil real del cliente.`;
    case 'DEFAULT':
      return $localize`:@@assistedQuote.consent.effect.default:El precio se calcula con el perfil por defecto y es un estimado: puede cambiar al comprar.`;
    case 'DEGRADED':
      return $localize`:@@assistedQuote.consent.effect.degraded:No pudimos consultar los datos del cliente: el precio lleva un recargo conservador y es un estimado.`;
  }
}

export function profileSourceLabel(source: ProfileSource): string {
  switch (source) {
    case 'REAL':
      return $localize`:@@assistedQuote.source.real:Perfil real del cliente`;
    case 'DEFAULT':
      return $localize`:@@assistedQuote.source.default:Perfil por defecto`;
    case 'DEGRADED':
      return $localize`:@@assistedQuote.source.degraded:Perfil degradado`;
  }
}

/** Mensaje al asesor para un error del servidor. Los de validación por campo se muestran en el campo. */
export function errorMessage(error: ApiError): string {
  switch (error.kind) {
    case 'network':
      return $localize`:@@assistedQuote.error.network:No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo; lo que ingresaste se conserva.`;
    case 'forbidden':
      return $localize`:@@assistedQuote.error.forbidden:Tu usuario no tiene permiso para esta operación.`;
    case 'validation':
      return $localize`:@@assistedQuote.error.validation:Revisa los datos marcados e inténtalo de nuevo.`;
    case 'unauthenticated':
      return $localize`:@@assistedQuote.error.unauthenticated:Tu sesión venció. Inicia sesión de nuevo para continuar.`;
    case 'not-found':
    case 'server':
      return $localize`:@@assistedQuote.error.server:No pudimos completar la operación por un problema del servidor. Inténtalo de nuevo; lo que ingresaste se conserva.`;
  }
}
