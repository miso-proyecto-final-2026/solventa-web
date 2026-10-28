/** Formas exactas de MS Pagos (`/v1/pagos/cobros-fallidos`, HU19). Los montos llegan como texto decimal. */

export type CaseStatusDto = 'PENDIENTE' | 'VENCIDO' | 'RECUPERADO';
export type GraceStatusDto = 'VIGENTE' | 'POR_VENCER' | 'VENCIDA';

export interface CaseDto {
  id: string;
  suscripcion_id: string;
  cliente_id: string;
  estado: CaseStatusDto;
  monto: string;
  moneda: string;
  intentos: number;
  ultimo_intento_en: string;
  codigo_rechazo: string | null;
  motivo_rechazo: string | null;
  gracia_hasta: string;
  estado_gracia: GraceStatusDto | null;
  tarjeta: { marca: string | null; ultimos4: string | null };
}

export interface CasePageDto {
  items: CaseDto[];
  total: number;
  pagina: number;
  tamano: number;
}

export interface AttemptDto {
  numero: number;
  resultado: string;
  codigo: string | null;
  motivo: string | null;
  referencia_pasarela: string | null;
  fecha: string;
}

export interface ChargeDto {
  transaccion_id: string;
  es_reintento: boolean;
  estado: string;
  monto: string;
  creado_en: string;
  resuelto_en: string | null;
  intentos: AttemptDto[];
}

export interface NoteDto {
  id: number;
  autor_id: string;
  autor_nombre: string;
  autor_rol: string;
  texto: string;
  creada_en: string;
}

export interface CaseDetailDto extends CaseDto {
  reintentos: number;
  operador_notificado_en: string | null;
  resuelto_en: string | null;
  cobros: ChargeDto[];
  notas: NoteDto[];
}

export interface RetryDto {
  caso_id: string;
  transaccion_id: string;
  numero_reintento: number;
  resultado: 'APROBADO' | 'RECHAZADO' | 'EN_PROCESO';
  codigo_rechazo: string | null;
  motivo_rechazo: string | null;
  detalle_pasarela: string | null;
  estado_caso: CaseStatusDto;
  repeticion: boolean;
}
