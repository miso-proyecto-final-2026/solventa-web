/** Formas exactas de MS Pagos (`/v1/pagos/conciliacion/desembolsos`, HU31). Los montos llegan como texto decimal. */

export type PaymentStateDto = 'PENDIENTE' | 'PAGADA' | 'FALLIDA';
export type ReconciliationStatusDto = 'PENDIENTE' | 'CONCILIADO' | 'CON_DIFERENCIA';

export interface ValidationDto {
  resultado: string;
  motivo?: string | null;
  regla?: string | null;
  version_reglas?: string | null;
}

export interface DifferenceDto {
  monto_registrado: string;
  monto_pasarela: string;
  moneda_pasarela: string;
  referencia_registrada: string | null;
  referencia_pasarela: string | null;
}

export interface DisbursementDto {
  id: string;
  idempotency_key: string;
  evento_id: string;
  tipo_evento: string | null;
  magnitud: Record<string, number | string> | null;
  ubicacion: string | null;
  evento_ocurrido_en: string | null;
  poliza_id: string;
  producto: string | null;
  cliente: string | null;
  numero_poliza: string | null;
  monto_asegurado: number | string | null;
  validacion: ValidationDto | null;
  estado: PaymentStateDto;
  monto: string;
  moneda: string;
  referencia_pasarela: string | null;
  fecha_pago: string | null;
  intentos: number;
  reentregas: number;
  estado_conciliacion: ReconciliationStatusDto;
  conciliado_por: string | null;
  conciliado_en: string | null;
  diferencia: DifferenceDto | null;
  escalada_en: string | null;
  escalada_por: string | null;
  nota_escalamiento: string | null;
  codigo_fallo: string | null;
  motivo_fallo: string | null;
}

export interface AttemptDto {
  numero: number;
  resultado: string;
  codigo: string | null;
  motivo: string | null;
  referencia_pasarela: string | null;
  fecha: string;
}

export interface DisbursementDetailDto extends DisbursementDto {
  intentos_de_pago: AttemptDto[];
}

export interface DisbursementPageDto {
  items: DisbursementDto[];
  total: number;
  pagina: number;
  tamano: number;
}

export interface SummaryDto {
  desembolsos: number;
  claves_distintas: number;
  claves_con_mas_de_un_pago: number;
  pagados: number;
  monto_pagado: string;
  por_estado_conciliacion: Record<ReconciliationStatusDto, number>;
}
