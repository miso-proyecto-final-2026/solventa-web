import { Money, money } from '@core/money/money';
import {
  ClientIdentity,
  ConsentState,
  DOCUMENT_TYPES,
  DocumentType,
  FieldKind,
  LineageDataType,
  LineageOrigin,
  MortgageOffer,
  MortgageOfferRequest,
  OfferStepKind,
  Product,
  ProfileLineage,
  ProfileSource,
  ProfileSummary,
  Quote,
  QuoteRequest,
  RiskLevel,
} from '../../domain/models';
import {
  CatalogDto,
  ClientSearchDto,
  LineageDto,
  MortgageOfferDto,
  MortgageOfferRequestDto,
  ProfileDto,
  QuoteDto,
  QuoteRequestDto,
} from '../dto/assisted-quote.dto';

const CONSENT: Record<string, ConsentState> = {
  OTORGADO: 'GRANTED',
  REVOCADO: 'REVOKED',
  NO_OTORGADO: 'NOT_GRANTED',
};

const SOURCE: Record<string, ProfileSource> = {
  REAL: 'REAL',
  POR_DEFECTO: 'DEFAULT',
  DEGRADADO: 'DEGRADED',
};

const LEVEL: Record<string, RiskLevel> = { BAJO: 'LOW', MEDIO: 'MEDIUM', ALTO: 'HIGH' };

const isDocumentType = (value: string): value is DocumentType =>
  (DOCUMENT_TYPES as readonly string[]).includes(value);

export function toClient(dto: ClientSearchDto): ClientIdentity {
  const granted = dto.consentimiento.fecha_otorgamiento;
  return {
    id: dto.cliente_id,
    firstName: dto.nombre,
    lastNameInitial: dto.apellido_inicial,
    document: {
      type: isDocumentType(dto.tipo_documento) ? dto.tipo_documento : 'CC',
      number: dto.numero_documento,
    },
    kycStatus: dto.estado_kyc,
    consent: {
      state: CONSENT[dto.consentimiento.estado] ?? 'NOT_GRANTED',
      grantedAt: granted ? new Date(granted) : null,
    },
  };
}

export function toProfile(dto: ProfileDto): ProfileSummary {
  return {
    clientId: dto.cliente_id,
    hasConsent: dto.con_consentimiento,
    source: SOURCE[dto.perfil_fuente] ?? 'DEFAULT',
    completeness: dto.completitud,
    signals: dto.senales.map((s) => ({ name: s.nombre, level: LEVEL[s.nivel] ?? 'MEDIUM' })),
  };
}

export function toCatalog(dto: CatalogDto): readonly Product[] {
  return dto.productos.map((p) => ({
    code: p.codigo,
    name: p.nombre,
    fields: p.campos.map((c) => ({
      name: c.nombre,
      kind: (c.tipo === 'entero' ? 'integer' : 'text') satisfies FieldKind,
      required: c.requerido,
      min: c.min,
      max: c.max,
      options: c.valores,
    })),
  }));
}

export function toQuoteRequestDto(request: QuoteRequest): QuoteRequestDto {
  const base = { producto: request.productCode, datos: { ...request.data } };
  return request.subject.kind === 'client'
    ? { cliente_id: request.subject.clientId, ...base }
    : {
        documento: { tipo: request.subject.document.type, numero: request.subject.document.number },
        ...base,
      };
}

export function toQuote(dto: QuoteDto): Quote {
  const at = (amount: number): Money => money(amount, dto.moneda);
  return {
    id: dto.id,
    productCode: dto.producto,
    annualPremium: at(dto.prima_anual),
    monthlyPremium: at(dto.prima_mensual),
    coverages: dto.coberturas.map((c) => ({
      type: c.tipo,
      amount: at(c.monto),
      deductible: at(c.deducible),
    })),
    validUntil: new Date(dto.vigente_hasta),
    estimated: dto.aproximada || dto.degradado,
    profileSource: SOURCE[dto.perfil_fuente] ?? 'DEFAULT',
    withoutAccount: dto.sin_cuenta,
    components: (dto.componentes ?? []).map((c) => ({ concept: c.concepto, amount: at(c.monto) })),
  };
}

const DATA_TYPE: Record<string, LineageDataType> = {
  FINANCIERO: 'FINANCIAL',
  SOCIOECONOMICO: 'SOCIOECONOMIC',
};

/** El valor por defecto manda sobre la caché; un respaldo viejo (caché + degradado) es «degradado». */
function originOf(f: LineageDto['fuentes'][number]): LineageOrigin {
  if (f.por_defecto) return 'DEFAULT';
  if (f.degradado) return 'DEGRADED';
  if (f.hit_cache) return 'CACHE';
  return 'LIVE';
}

export function toLineage(dto: LineageDto): ProfileLineage {
  return {
    profileId: dto.perfil_id,
    createdAt: new Date(dto.creado_en),
    entries: dto.fuentes.map((f) => ({
      source: f.fuente,
      dataType: DATA_TYPE[f.tipo_dato] ?? 'UNKNOWN',
      fields: f.campos,
      fetchedAt: f.obtenido_en ? new Date(f.obtenido_en) : null,
      ttlSeconds: f.ttl_s,
      origin: originOf(f),
      consentGranted: f.estado_consentimiento === 'OTORGADO',
    })),
    missing: Object.entries(dto.ausentes)
      .map(([field, reason]) => ({ field, reason }))
      .sort((a, b) => a.field.localeCompare(b.field)),
    conflicts: dto.conflictos.map((c) => ({
      field: c.campo,
      winner: c.ganadora,
      discarded: c.descartadas,
    })),
  };
}

// --- HU26: oferta de vida hipotecario ------------------------------------------------------

const OFFER_STEP: Record<string, OfferStepKind> = {
  prima_base: 'BASE',
  etapa_de_vida: 'LIFE_STAGE',
  senal: 'SIGNAL',
  recargo_degradado: 'DEGRADED',
};

/** Sin `suma_asegurada`, Perfilamiento usa la suma por defecto de sus reglas. */
export function toMortgageOfferRequestDto(request: MortgageOfferRequest): MortgageOfferRequestDto {
  return request.insuredSum === null
    ? { enriquecer: request.enrich }
    : { suma_asegurada: request.insuredSum, enriquecer: request.enrich };
}

export function toMortgageOffer(dto: MortgageOfferDto): MortgageOffer {
  const at = (amount: number): Money => money(amount, dto.moneda);
  return {
    quoteId: dto.cotizacion_id,
    offerId: dto.oferta_id,
    clientId: dto.cliente_id,
    insuredSum: at(dto.suma_asegurada),
    annualPremium: at(dto.prima_anual),
    monthlyPremium: at(dto.prima_mensual),
    lifeStage: dto.etapa_de_vida,
    rulesVersion: dto.version_reglas,
    profileCreatedAt: new Date(dto.perfil_creado_en),
    degraded: dto.degradado,
    coverages: dto.coberturas.map((c) => ({
      type: c.tipo,
      amount: at(c.monto),
      deductible: at(c.deducible),
    })),
    // El factor llega como texto decimal («1.30») para no perder precisión; se muestra con el idioma.
    steps: dto.ajustes.map((a) => ({
      kind: OFFER_STEP[a.paso] ?? 'OTHER',
      name: a.nombre,
      factor: a.factor === null ? null : Number(a.factor),
      adjustment: at(a.ajuste),
      accumulated: at(a.acumulado),
      missingData: a.sin_dato,
    })),
    validUntil: new Date(dto.vigente_hasta),
  };
}
