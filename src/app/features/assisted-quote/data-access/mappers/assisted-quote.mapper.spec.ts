import {
  toCatalog,
  toClient,
  toProfile,
  toQuote,
  toQuoteRequestDto,
} from './assisted-quote.mapper';

describe('assisted quote mapper', () => {
  it('should map a client search result and its consent', () => {
    const client = toClient({
      cliente_id: 'c1',
      nombre: 'Ana',
      apellido_inicial: 'F.',
      tipo_documento: 'CC',
      numero_documento: '1000000001',
      estado_kyc: 'VERIFICADO',
      consentimiento: {
        estado: 'OTORGADO',
        version_texto: 'v1',
        fecha_otorgamiento: '2026-10-01T10:00:00Z',
      },
    });

    expect(client.id).toBe('c1');
    expect(client.document).toEqual({ type: 'CC', number: '1000000001' });
    expect(client.consent.state).toBe('GRANTED');
    expect(client.consent.grantedAt?.toISOString()).toBe('2026-10-01T10:00:00.000Z');
  });

  it('should map revoked and missing consent, and fall back for unknown values', () => {
    const base = {
      cliente_id: 'c',
      nombre: 'x',
      apellido_inicial: 'y',
      tipo_documento: 'RARO',
      numero_documento: '12345',
      estado_kyc: 'PENDIENTE',
    };

    expect(
      toClient({
        ...base,
        consentimiento: { estado: 'REVOCADO', version_texto: null, fecha_otorgamiento: null },
      }).consent,
    ).toEqual({ state: 'REVOKED', grantedAt: null });
    expect(
      toClient({
        ...base,
        consentimiento: { estado: 'NO_OTORGADO', version_texto: null, fecha_otorgamiento: null },
      }).consent.state,
    ).toBe('NOT_GRANTED');
    expect(
      toClient({
        ...base,
        consentimiento: { estado: '???', version_texto: null, fecha_otorgamiento: null },
      }).document.type,
    ).toBe('CC');
  });

  it('should map the profile source and risk levels', () => {
    const profile = toProfile({
      cliente_id: 'c1',
      con_consentimiento: true,
      perfil_fuente: 'POR_DEFECTO',
      fuentes: ['open_finance'],
      completitud: 0.5,
      senales: [
        { nombre: 'ratio_endeudamiento', nivel: 'ALTO' },
        { nombre: 'reportes_negativos', nivel: 'BAJO' },
      ],
      obtenido_en: '2026-10-20T15:00:00Z',
    });

    expect(profile.source).toBe('DEFAULT');
    expect(profile.signals).toEqual([
      { name: 'ratio_endeudamiento', level: 'HIGH' },
      { name: 'reportes_negativos', level: 'LOW' },
    ]);
  });

  it('should map the catalog fields to the front-end kinds', () => {
    const [vida] = toCatalog({
      version_reglas: 'v',
      moneda: 'COP',
      productos: [
        {
          codigo: 'microseguro_vida',
          nombre: 'Microseguro de vida',
          campos: [
            { nombre: 'edad', tipo: 'entero', requerido: true, min: 18, max: 65, valores: null },
            {
              nombre: 'tipo',
              tipo: 'texto',
              requerido: true,
              min: null,
              max: null,
              valores: ['a'],
            },
          ],
        },
      ],
    });

    expect(vida.code).toBe('microseguro_vida');
    expect(vida.fields.map((f) => f.kind)).toEqual(['integer', 'text']);
    expect(vida.fields[1].options).toEqual(['a']);
  });

  it('should build the request for an existing client or for a prospect', () => {
    const data = { edad: 35 };

    expect(
      toQuoteRequestDto({ subject: { kind: 'client', clientId: 'c1' }, productCode: 'p', data }),
    ).toEqual({ cliente_id: 'c1', producto: 'p', datos: data });
    expect(
      toQuoteRequestDto({
        subject: { kind: 'prospect', document: { type: 'CE', number: '55667788' } },
        productCode: 'p',
        data,
      }),
    ).toEqual({ documento: { tipo: 'CE', numero: '55667788' }, producto: 'p', datos: data });
  });

  it('should map a quote, flagging estimated prices and keeping the currency', () => {
    const dto = {
      id: 'q1',
      producto: 'microseguro_vida',
      moneda: 'COP',
      prima_anual: 175000,
      prima_mensual: 14583,
      coberturas: [{ tipo: 'muerte', monto: 50000000, deducible: 0 }],
      vigente_hasta: '2026-11-19T15:00:00Z',
      aproximada: false,
      degradado: true,
      componentes: [{ concepto: 'prima_base', monto: 175000 }],
      perfil_fuente: 'DEGRADADO',
      sin_cuenta: false,
    };

    const quote = toQuote(dto);

    expect(quote.estimated).toBeTrue();
    expect(quote.profileSource).toBe('DEGRADED');
    expect(quote.annualPremium).toEqual({ amount: 175000, currency: 'COP' });
    expect(quote.coverages[0].amount.amount).toBe(50_000_000);
    expect(quote.components).toEqual([
      { concept: 'prima_base', amount: { amount: 175000, currency: 'COP' } },
    ]);
    expect(toQuote({ ...dto, degradado: false, aproximada: false }).estimated).toBeFalse();
    expect(toQuote({ ...dto, componentes: null }).components).toEqual([]);
  });
});
