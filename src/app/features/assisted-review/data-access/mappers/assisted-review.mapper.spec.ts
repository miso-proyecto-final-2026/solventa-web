import { ReviewDetailDto, ReviewRowDto } from '../dto/assisted-review.dto';
import {
  toDecisionRequestDto,
  toListParams,
  toProfileLevels,
  toReviewDetail,
  toReviewPage,
  toRow,
} from './assisted-review.mapper';

const ROW_DTO: ReviewRowDto = {
  id: 'sus-1',
  cliente: {
    nombre: 'Ana María',
    inicial_apellido: 'P',
    tipo_documento: 'CC',
    documento_enmascarado: '******300',
  },
  producto: 'microseguro_vida',
  moneda: 'COP',
  monto_asegurado: 40_000_000,
  categorias: ['MONTO_SOBRE_LIMITE', 'PERFIL_FUERA_DE_RANGO'],
  motivo: 'Motivo',
  creada_en: '2026-11-09T08:00:00Z',
  prioridad: 'ALTA',
  estado: 'PENDIENTE',
  decision: null,
  cotizacion_vencida: true,
  vigente_hasta: '2026-11-08T12:00:00Z',
};

const DETAIL_DTO: ReviewDetailDto = {
  id: 'sus-1',
  cliente_id: 'cli-1',
  cliente: null,
  cotizacion: {
    cotizacion_id: 'cot-1',
    producto: 'microseguro_vida',
    moneda: 'COP',
    monto_asegurado: 40_000_000,
    prima_mensual: 14_583,
    prima_anual: 175_000,
    periodicidad_pago: 'MENSUAL',
    coberturas: [{ tipo: 'muerte', monto: 40_000_000, deducible: 0 }],
    vigente_hasta: null,
  },
  decision_automatica: {
    motivos: [{ categoria: 'DATOS_INCOMPLETOS_O_INCONSISTENTES', texto: 'Falta un dato' }],
    reglas_version: '2026.10.1',
    decidido_en: '2026-11-09T08:00:05Z',
  },
  decision_humana: {
    decision: 'AJUSTADA',
    justificacion: 'Texto',
    asesor_id: 'ase-1',
    asesor_nombre: 'Laura',
    decidido_en: '2026-11-10T09:00:00Z',
    ajuste: {
      factor: 0.75,
      monto_original: 40_000_000,
      monto_asegurado: 30_000_000,
      prima_mensual_original: 14_583,
      prima_mensual: 10_937,
      prima_anual_original: 175_000,
      prima_anual: 131_250,
    },
  },
  prioridad: 'MEDIA',
  estado: 'DECIDIDA',
  creada_en: '2026-11-09T08:00:00Z',
  cotizacion_vencida: false,
  puede_decidir: false,
  decisiones_permitidas: [],
};

describe('assisted review mapper', () => {
  it('should translate priority, categories and the expired quote of a row', () => {
    const row = toRow(ROW_DTO);

    expect(row.priority).toBe('HIGH');
    expect(row.categories).toEqual(['AMOUNT_OVER_LIMIT', 'RISK_PROFILE_OUT_OF_RANGE']);
    expect(row.quoteExpired).toBeTrue();
    expect(row.validUntil?.toISOString()).toBe('2026-11-08T12:00:00.000Z');
    expect(row.insuredAmount).toEqual({ amount: 40_000_000, currency: 'COP' });
    expect(row.client?.lastNameInitial).toBe('P');
  });

  it('should keep a row without client or known validity', () => {
    const row = toRow({
      ...ROW_DTO,
      cliente: null,
      vigente_hasta: null,
      cotizacion_vencida: false,
    });

    expect(row.client).toBeNull();
    expect(row.validUntil).toBeNull();
    expect(row.quoteExpired).toBeFalse();
  });

  it('should carry the expired total of the page', () => {
    const page = toReviewPage({
      items: [ROW_DTO],
      total: 7,
      total_vencidas: 3,
      pagina: 2,
      tamano: 20,
    });

    expect(page).toEqual(
      jasmine.objectContaining({ total: 7, expiredTotal: 3, page: 2, size: 20 }),
    );
  });

  it('should map the detail, the human decision and the adjustment', () => {
    const d = toReviewDetail(DETAIL_DTO);

    expect(d.clientId).toBe('cli-1');
    expect(d.quote.paymentPeriod).toBe('MONTHLY');
    expect(d.quote.validUntil).toBeNull();
    expect(d.automatic.reasons).toEqual([
      { category: 'INCOMPLETE_OR_INCONSISTENT_DATA', text: 'Falta un dato' },
    ]);
    expect(d.human?.decision).toBe('ADJUSTED');
    expect(d.human?.adjustment?.adjustedAmount).toBe(30_000_000);
    expect(d.state).toBe('DECIDED');
    expect(d.canDecide).toBeFalse();
  });

  it('should translate the allowed decisions the backend computed', () => {
    const d = toReviewDetail({
      ...DETAIL_DTO,
      decision_humana: null,
      puede_decidir: true,
      decisiones_permitidas: ['RECHAZADA'],
    });

    expect(d.allowedDecisions).toEqual(['REJECTED']);
  });

  it('should map the profile to levels only', () => {
    const p = toProfileLevels({
      cliente_id: 'cli-1',
      con_consentimiento: true,
      perfil_fuente: 'DEGRADADO',
      fuentes: [],
      completitud: 0.5,
      senales: [
        { nombre: 'ratio_endeudamiento', nivel: 'ALTO' },
        { nombre: 'x', nivel: 'otro' },
      ],
      obtenido_en: '2026-11-09T08:00:00Z',
    });

    expect(p.source).toBe('DEGRADED');
    expect(p.signals).toEqual([
      { name: 'ratio_endeudamiento', level: 'HIGH' },
      { name: 'x', level: 'MEDIUM' },
    ]);
  });

  it('should build the list params only for the filters in use', () => {
    const base = {
      state: 'PENDING',
      category: null,
      mineOnly: false,
      expiredOnly: false,
      page: 1,
    } as const;

    expect(toListParams(base, 20)).toEqual({ estado: 'PENDIENTE', pagina: 1, tamano: 20 });
    expect(
      toListParams(
        {
          state: 'DECIDED',
          category: 'AMOUNT_OVER_LIMIT',
          mineOnly: true,
          expiredOnly: true,
          page: 3,
        },
        20,
      ),
    ).toEqual({
      estado: 'DECIDIDA',
      pagina: 3,
      tamano: 20,
      categoria: 'MONTO_SOBRE_LIMITE',
      mias: true,
      vencidas: true,
    });
  });

  it('should send the amount only when adjusting and trim the justification', () => {
    expect(
      toDecisionRequestDto({ decision: 'APPROVED', justification: '  texto  ', insuredAmount: 5 }),
    ).toEqual({ decision: 'APROBADA', justificacion: 'texto' });
    expect(
      toDecisionRequestDto({
        decision: 'ADJUSTED',
        justification: 'texto',
        insuredAmount: 30_000_000,
      }),
    ).toEqual({ decision: 'AJUSTADA', justificacion: 'texto', monto_asegurado: 30_000_000 });
    expect(
      toDecisionRequestDto({ decision: 'REJECTED', justification: 'texto', insuredAmount: null }),
    ).toEqual({ decision: 'RECHAZADA', justificacion: 'texto' });
  });
});
