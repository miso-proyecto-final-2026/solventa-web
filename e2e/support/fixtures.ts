// Respuestas del backend tal como las define el contrato de Cotización 1.3.0 (ejemplos de
// `solventa-backend/services/cotizacion/docs/api/cotizacion.openapi.yaml`) y las de Identidad.
// Los clientes son los que siembra `services/identidad/scripts/sembrar_demo.py`.

export const ADVISOR = { email: 'asesor@solventa.test', password: 'Demo12345' } as const;

export const SESSION_DTO = {
  access_token: 'e2e-token',
  token_type: 'bearer',
  expira_en: 1800,
  usuario: { id: 'a-1', nombre: 'Asesora Demo', rol: 'ASESOR' },
};

type Level = 'BAJO' | 'MEDIO' | 'ALTO';

export interface DemoClient {
  readonly id: string;
  readonly nombre: string;
  readonly apellido_inicial: string;
  readonly consentimiento: 'OTORGADO' | 'REVOCADO' | 'NO_OTORGADO';
  /** Niveles por indicador; vacío cuando no se consultaron datos (sin consentimiento). */
  readonly niveles: readonly [Level, Level, Level] | null;
  readonly prima_anual: number;
}

/** Clave: número de documento (tipo CC). */
export const CLIENTS: Readonly<Record<string, DemoClient>> = {
  '1000000001': {
    id: '00000000-0000-4000-8000-0000000000a1',
    nombre: 'Ana',
    apellido_inicial: 'F.',
    consentimiento: 'OTORGADO',
    niveles: ['BAJO', 'BAJO', 'BAJO'],
    prima_anual: 157_938,
  },
  '1000000002': {
    id: '00000000-0000-4000-8000-0000000000b2',
    nombre: 'Bruno',
    apellido_inicial: 'R.',
    consentimiento: 'OTORGADO',
    niveles: ['ALTO', 'MEDIO', 'ALTO'],
    prima_anual: 276_719,
  },
  '1000000004': {
    id: '00000000-0000-4000-8000-0000000000d4',
    nombre: 'Diego',
    apellido_inicial: 'R.',
    consentimiento: 'REVOCADO',
    niveles: null,
    prima_anual: 175_000,
  },
  '1000000005': {
    id: '00000000-0000-4000-8000-0000000000e5',
    nombre: 'Elena',
    apellido_inicial: 'S.',
    consentimiento: 'NO_OTORGADO',
    niveles: null,
    prima_anual: 175_000,
  },
};

export const SEARCH_DTO = (documento: string, client: DemoClient) => ({
  cliente_id: client.id,
  nombre: client.nombre,
  apellido_inicial: client.apellido_inicial,
  tipo_documento: 'CC',
  numero_documento: documento,
  estado_kyc: 'VERIFICADO',
  consentimiento: {
    estado: client.consentimiento,
    version_texto: client.consentimiento === 'NO_OTORGADO' ? null : 'v1',
    fecha_otorgamiento: client.consentimiento === 'NO_OTORGADO' ? null : '2026-10-01T10:00:00Z',
  },
});

export const PROFILE_DTO = (client: DemoClient) => ({
  cliente_id: client.id,
  con_consentimiento: client.consentimiento === 'OTORGADO',
  perfil_fuente: client.consentimiento === 'OTORGADO' ? 'REAL' : 'POR_DEFECTO',
  fuentes: client.niveles ? ['open_finance', 'open_data'] : [],
  completitud: client.niveles ? 1 : 0,
  senales: client.niveles
    ? [
        { nombre: 'ratio_endeudamiento', nivel: client.niveles[0] },
        { nombre: 'reportes_negativos', nivel: client.niveles[1] },
        { nombre: 'ingresos_mensuales_cop', nivel: client.niveles[2] },
      ]
    : [],
  obtenido_en: '2026-10-20T15:00:00Z',
});

export const CATALOG_DTO = {
  version_reglas: '2026.10.1-prototipo',
  moneda: 'COP',
  productos: [
    {
      codigo: 'microseguro_vida',
      nombre: 'Microseguro de vida',
      campos: [
        { nombre: 'edad', tipo: 'entero', requerido: true, min: 18, max: 65, valores: null },
        {
          nombre: 'suma_asegurada',
          tipo: 'entero',
          requerido: true,
          min: 5_000_000,
          max: 100_000_000,
          valores: null,
        },
      ],
    },
    {
      codigo: 'proteccion_dispositivos',
      nombre: 'Protección de dispositivos',
      campos: [
        {
          nombre: 'tipo_dispositivo',
          tipo: 'texto',
          requerido: true,
          min: null,
          max: null,
          valores: ['celular', 'portatil', 'tableta'],
        },
        {
          nombre: 'valor_dispositivo',
          tipo: 'entero',
          requerido: true,
          min: 300_000,
          max: 15_000_000,
          valores: null,
        },
        {
          nombre: 'antiguedad_meses',
          tipo: 'entero',
          requerido: true,
          min: 0,
          max: 36,
          valores: null,
        },
      ],
    },
  ],
};

/** Cotización de microseguro de vida (edad 35, suma 50 M). Sin cliente con perfil real es estimada. */
export function quoteDto(client: DemoClient | null, sinCuenta: boolean) {
  const real = client?.consentimiento === 'OTORGADO';
  const anual = client?.prima_anual ?? 175_000;
  return {
    id: '3c6f5a52-7d0e-4b1c-9d52-0a7f6a9c1b11',
    cliente_id: client?.id ?? '5e0c1a44-2f6b-4d7a-9b3e-8c1d2a3b4c5d',
    producto: 'microseguro_vida',
    estado: 'EMITIDA',
    moneda: 'COP',
    prima_anual: anual,
    prima_mensual: Math.round(anual / 12),
    coberturas: [
      { tipo: 'muerte', monto: 50_000_000, deducible: 0 },
      { tipo: 'incapacidad_total', monto: 25_000_000, deducible: 0 },
    ],
    vigente_hasta: '2026-11-19T15:00:00Z',
    version_reglas: '2026.10.1-prototipo',
    degradado: false,
    aproximada: !real,
    aviso: real ? null : 'Este valor es aproximado y puede cambiar al momento de la compra.',
    componentes: [
      { concepto: 'prima_base', monto: 175_000 },
      { concepto: 'ajuste_datos', monto: 0 },
      { concepto: 'ajuste_riesgo', monto: anual - 175_000 },
      { concepto: 'recargo_degradado', monto: 0 },
    ],
    perfil_fuente: real ? 'REAL' : 'POR_DEFECTO',
    canal: 'WEB_ASESOR',
    sin_cuenta: sinCuenta,
  };
}

// --- MS Pagos: cobros fallidos (HU19), formas de `solventa-backend/services/pagos/docs/api/openapi.json` ---

const HOUR_MS = 60 * 60 * 1000;

export interface FailedCaseDto {
  id: string;
  suscripcion_id: string;
  cliente_id: string;
  estado: 'PENDIENTE' | 'VENCIDO' | 'RECUPERADO';
  monto: string;
  moneda: string;
  intentos: number;
  ultimo_intento_en: string;
  codigo_rechazo: string | null;
  motivo_rechazo: string | null;
  gracia_hasta: string;
  estado_gracia: 'VIGENTE' | 'POR_VENCER' | 'VENCIDA' | null;
  tarjeta: { marca: string | null; ultimos4: string | null };
}

/** Dos casos abiertos: uno vence en 6 h (resaltado) y otro en 2 días. */
export function failedCases(now = Date.now()): FailedCaseDto[] {
  const at = (hours: number) => new Date(now + hours * HOUR_MS).toISOString();
  return [
    {
      id: 'tx-urgente',
      suscripcion_id: 'sus-1',
      cliente_id: 'cli-1',
      estado: 'PENDIENTE',
      monto: '55500.00',
      moneda: 'COP',
      intentos: 1,
      ultimo_intento_en: at(-66),
      codigo_rechazo: 'FONDOS_INSUFICIENTES',
      motivo_rechazo: 'Fondos insuficientes',
      gracia_hasta: at(6),
      estado_gracia: 'POR_VENCER',
      tarjeta: { marca: 'VISA', ultimos4: '4242' },
    },
    {
      id: 'tx-normal',
      suscripcion_id: 'sus-2',
      cliente_id: 'cli-2',
      estado: 'PENDIENTE',
      monto: '81000.00',
      moneda: 'COP',
      intentos: 2,
      ultimo_intento_en: at(-20),
      codigo_rechazo: 'TARJETA_BLOQUEADA',
      motivo_rechazo: 'Tarjeta bloqueada por el banco',
      gracia_hasta: at(50),
      estado_gracia: 'VIGENTE',
      tarjeta: { marca: 'MASTERCARD', ultimos4: '5100' },
    },
  ];
}

export function failedCaseDetail(c: FailedCaseDto, notes: unknown[]): Record<string, unknown> {
  return {
    ...c,
    reintentos: c.intentos - 1,
    operador_notificado_en: null,
    resuelto_en: null,
    cobros: [
      {
        transaccion_id: c.id,
        es_reintento: false,
        estado: 'RECHAZADA',
        monto: c.monto,
        creado_en: c.ultimo_intento_en,
        resuelto_en: c.ultimo_intento_en,
        intentos: [
          {
            numero: 1,
            resultado: 'RECHAZADO',
            codigo: c.codigo_rechazo,
            motivo: c.motivo_rechazo,
            referencia_pasarela: 'sim-ref-1',
            fecha: c.ultimo_intento_en,
          },
        ],
      },
    ],
    notas: notes,
  };
}
