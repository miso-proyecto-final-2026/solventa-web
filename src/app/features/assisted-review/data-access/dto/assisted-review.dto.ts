/** Formas exactas de MS Suscripción (`/v1/suscripciones/revisiones`, HU16) y del perfil de MS Cotización. */

export type PriorityDto = 'ALTA' | 'MEDIA' | 'BAJA';
export type CategoryDto =
  'PERFIL_FUERA_DE_RANGO' | 'MONTO_SOBRE_LIMITE' | 'DATOS_INCOMPLETOS_O_INCONSISTENTES';
export type StateDto = 'PENDIENTE' | 'DECIDIDA';
export type DecisionDto = 'APROBADA' | 'RECHAZADA' | 'AJUSTADA';

export interface ClientDto {
  nombre: string;
  inicial_apellido: string;
  tipo_documento: string;
  documento_enmascarado: string;
}

export interface ReviewRowDto {
  id: string;
  cliente: ClientDto | null;
  producto: string;
  moneda: string;
  monto_asegurado: number;
  categorias: CategoryDto[];
  motivo: string;
  creada_en: string;
  prioridad: PriorityDto;
  estado: StateDto;
  decision: DecisionDto | null;
  cotizacion_vencida: boolean;
  vigente_hasta: string | null;
}

export interface ReviewPageDto {
  items: ReviewRowDto[];
  total: number;
  total_vencidas: number;
  pagina: number;
  tamano: number;
}

export interface CoverageDto {
  tipo: string;
  monto: number;
  deducible: number;
}

export interface QuoteDto {
  cotizacion_id: string;
  producto: string;
  moneda: string;
  monto_asegurado: number;
  prima_mensual: number;
  prima_anual: number;
  periodicidad_pago: string;
  coberturas: CoverageDto[];
  vigente_hasta: string | null;
}

export interface AdjustmentDto {
  factor: number;
  monto_original: number;
  monto_asegurado: number;
  prima_mensual_original: number;
  prima_mensual: number;
  prima_anual_original: number;
  prima_anual: number;
}

export interface HumanDecisionDto {
  decision: DecisionDto;
  justificacion: string | null;
  asesor_id: string | null;
  asesor_nombre: string | null;
  decidido_en: string | null;
  ajuste: AdjustmentDto | null;
}

export interface ReviewDetailDto {
  id: string;
  cliente_id: string;
  cliente: ClientDto | null;
  cotizacion: QuoteDto;
  decision_automatica: {
    motivos: { categoria: CategoryDto; texto: string }[];
    reglas_version: string | null;
    decidido_en: string | null;
  };
  decision_humana: HumanDecisionDto | null;
  prioridad: PriorityDto;
  estado: StateDto;
  creada_en: string;
  cotizacion_vencida: boolean;
  puede_decidir: boolean;
  decisiones_permitidas: DecisionDto[];
}

export interface DecisionRequestDto {
  decision: DecisionDto;
  justificacion: string;
  monto_asegurado?: number;
}

/** `GET /v1/asesor/clientes/{id}/perfil` de Cotización. Solo niveles. */
export interface ProfileDto {
  cliente_id: string;
  con_consentimiento: boolean;
  perfil_fuente: string;
  fuentes: string[];
  completitud: number;
  senales: { nombre: string; nivel: string }[];
  obtenido_en: string;
}
