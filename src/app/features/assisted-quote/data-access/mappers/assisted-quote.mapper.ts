import { Money, money } from '@core/money/money';
import {
  ClientIdentity,
  ConsentState,
  DOCUMENT_TYPES,
  DocumentType,
  FieldKind,
  Product,
  ProfileSource,
  ProfileSummary,
  Quote,
  QuoteRequest,
  RiskLevel,
} from '../../domain/models';
import {
  CatalogDto,
  ClientSearchDto,
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
