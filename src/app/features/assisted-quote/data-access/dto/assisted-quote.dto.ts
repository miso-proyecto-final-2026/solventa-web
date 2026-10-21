// Formas exactas del backend (MS Identidad y MS Cotización, contrato 1.3.0). Si el backend renombra
// un campo, cambia este archivo y el mapper; nada más.

export interface ClientSearchDto {
  cliente_id: string;
  nombre: string;
  apellido_inicial: string;
  tipo_documento: string;
  numero_documento: string;
  estado_kyc: string;
  consentimiento: {
    estado: string;
    version_texto: string | null;
    fecha_otorgamiento: string | null;
  };
}

export interface ProfileDto {
  cliente_id: string;
  con_consentimiento: boolean;
  perfil_fuente: string;
  fuentes: string[];
  completitud: number;
  senales: { nombre: string; nivel: string }[];
  obtenido_en: string;
}

export interface CatalogDto {
  version_reglas: string;
  moneda: string;
  productos: {
    codigo: string;
    nombre: string;
    campos: {
      nombre: string;
      tipo: string;
      requerido: boolean;
      min: number | null;
      max: number | null;
      valores: string[] | null;
    }[];
  }[];
}

export interface QuoteRequestDto {
  cliente_id?: string;
  documento?: { tipo: string; numero: string };
  producto: string;
  datos: Record<string, number | string>;
}

export interface QuoteDto {
  id: string;
  producto: string;
  moneda: string;
  prima_anual: number;
  prima_mensual: number;
  coberturas: { tipo: string; monto: number; deducible: number }[];
  vigente_hasta: string;
  aproximada: boolean;
  degradado: boolean;
  componentes: { concepto: string; monto: number }[] | null;
  perfil_fuente: string;
  sin_cuenta: boolean;
}
