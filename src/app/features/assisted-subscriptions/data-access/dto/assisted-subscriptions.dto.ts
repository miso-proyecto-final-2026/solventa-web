/** Contrato de `/v1/suscripciones/asistidas` en MS Suscripción (ADR-0020). */
export interface ClientSummaryDto {
  nombre: string;
  inicial_apellido: string;
  tipo_documento: string;
  documento_enmascarado: string;
}

export interface AssistedSubscriptionDto {
  id: string;
  cotizacion_id: string;
  cliente: ClientSummaryDto | null;
  producto: string;
  moneda: string;
  monto_asegurado: number;
  periodicidad_pago: string;
  estado_saga: string;
  paso_actual: string;
  pasos: string[];
  decision: string | null;
  motivos: string[];
  cobro_estado: string | null;
  cobro_motivo: string | null;
  firma: { estado: string; vence_en: string | null; compensacion: string | null } | null;
  compensacion: { estado: string; motivo: string | null; solicitada_en: string | null } | null;
  poliza: {
    numero_poliza: string;
    estado: string;
    documento_estado: string;
    documento_intentos: number;
    documento_error: string | null;
  } | null;
  puede_gestionar_firma: boolean;
  creada_en: string;
}

export interface SubscriptionPageDto {
  items: AssistedSubscriptionDto[];
  total: number;
  pagina: number;
  tamano: number;
}

/** Respuesta de `POST /asistidas`: la saga recién creada; aquí solo importa su id. */
export interface StartedSubscriptionDto {
  id: string;
}

export interface SignatureDocumentDto {
  suscripcion_id: string;
  numero_poliza: string;
  documento_sha256: string;
  estado: 'PENDIENTE' | 'FIRMADA';
  vence_en: string | null;
  autenticacion: string;
}

export interface SignatureDto {
  suscripcion_id: string;
  poliza_id: string;
  estado_saga: string;
  documento_sha256: string;
  firmada_en: string;
  canal: string;
  metodo_autenticacion: string;
  modalidad: string;
  asesor_id: string | null;
}
