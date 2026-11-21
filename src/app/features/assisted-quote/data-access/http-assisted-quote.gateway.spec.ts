import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error';
import { apiErrorInterceptor } from '@core/http/interceptors';
import { HttpAssistedQuoteGateway } from './http-assisted-quote.gateway';

describe('HttpAssistedQuoteGateway', () => {
  let gateway: HttpAssistedQuoteGateway;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpAssistedQuoteGateway,
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    gateway = TestBed.inject(HttpAssistedQuoteGateway);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('should look the client up in Identidad by document', () => {
    let result: unknown;
    gateway.findClient({ type: 'CC', number: '1000000001' }).subscribe((c) => (result = c));

    const req = backend.expectOne(
      (r) => r.url === '/api/identidad/v1/clientes/busqueda' && r.method === 'GET',
    );
    expect(req.request.params.get('tipo_documento')).toBe('CC');
    expect(req.request.params.get('numero_documento')).toBe('1000000001');
    req.flush({
      cliente_id: 'c1',
      nombre: 'Ana',
      apellido_inicial: 'F.',
      tipo_documento: 'CC',
      numero_documento: '1000000001',
      estado_kyc: 'VERIFICADO',
      consentimiento: { estado: 'OTORGADO', version_texto: 'v1', fecha_otorgamiento: null },
    });

    expect((result as { id: string }).id).toBe('c1');
  });

  it('should answer null, not an error, when the document does not exist', () => {
    let result: unknown = 'sin respuesta';
    gateway.findClient({ type: 'CC', number: '99999999' }).subscribe((c) => (result = c));

    backend
      .expectOne((r) => r.url === '/api/identidad/v1/clientes/busqueda')
      .flush({ detail: 'Cliente no encontrado' }, { status: 404, statusText: '' });

    expect(result).toBeNull();
  });

  it('should let other failures through as ApiError', () => {
    let failure: unknown;
    gateway
      .findClient({ type: 'CC', number: '1000000001' })
      .subscribe({ error: (e: unknown) => (failure = e) });

    backend
      .expectOne((r) => r.url === '/api/identidad/v1/clientes/busqueda')
      .flush(null, { status: 500, statusText: '' });

    expect((failure as ApiError).kind).toBe('server');
  });

  it('should read the advisor profile summary from Cotización', () => {
    let source = '';
    gateway.getProfile('c 1').subscribe((p) => (source = p.source));

    const req = backend.expectOne('/api/cotizacion/v1/asesor/clientes/c%201/perfil');
    req.flush({
      cliente_id: 'c 1',
      con_consentimiento: false,
      perfil_fuente: 'POR_DEFECTO',
      fuentes: [],
      completitud: 0,
      senales: [],
      obtenido_en: '2026-10-20T15:00:00Z',
    });

    expect(source).toBe('DEFAULT');
  });

  it('should read the product catalog', () => {
    let count = -1;
    gateway.getCatalog().subscribe((c) => (count = c.length));

    backend
      .expectOne('/api/cotizacion/v1/productos')
      .flush({ version_reglas: 'v', moneda: 'COP', productos: [] });

    expect(count).toBe(0);
  });

  it('should post the quote request to the advisor endpoint', () => {
    gateway
      .requestQuote({
        subject: { kind: 'client', clientId: 'c1' },
        productCode: 'microseguro_vida',
        data: { edad: 35 },
      })
      .subscribe();

    const req = backend.expectOne('/api/cotizacion/v1/asesor/cotizaciones');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      cliente_id: 'c1',
      producto: 'microseguro_vida',
      datos: { edad: 35 },
    });
    req.flush({
      id: 'q1',
      producto: 'microseguro_vida',
      moneda: 'COP',
      prima_anual: 1,
      prima_mensual: 1,
      coberturas: [],
      vigente_hasta: '2026-11-19T15:00:00Z',
      aproximada: false,
      degradado: false,
      componentes: [],
      perfil_fuente: 'REAL',
      sin_cuenta: false,
    });
  });

  describe('lineage (HU24)', () => {
    const lineageDto = (fuentes: Record<string, unknown>[]) => ({
      perfil_id: 'p1',
      cliente_id: 'c 1',
      creado_en: '2026-11-14T15:00:00Z',
      consentimiento_id: 'cons-1',
      fuentes,
      ausentes: { zona_riesgo: 'sin_datos', estrato: 'sin_datos' },
      conflictos: [{ campo: 'estrato', ganadora: 'open_data', descartadas: ['open_finance'] }],
    });
    const source = (overrides: Record<string, unknown>) => ({
      fuente: 'open_finance',
      tipo_dato: 'FINANCIERO',
      campos: ['score_crediticio'],
      obtenido_en: '2026-11-14T15:00:00Z',
      ttl_s: 3600,
      hit_cache: false,
      degradado: false,
      por_defecto: false,
      estado_consentimiento: 'OTORGADO',
      ...overrides,
    });

    it('should read the lineage from the advisor endpoint and map it to the feature model', () => {
      let result: unknown;
      gateway.getLineage('c 1').subscribe((l) => (result = l));

      const req = backend.expectOne('/api/cotizacion/v1/asesor/clientes/c%201/linaje');
      expect(req.request.method).toBe('GET');
      req.flush(lineageDto([source({})]));

      expect(result).toEqual({
        profileId: 'p1',
        createdAt: new Date('2026-11-14T15:00:00Z'),
        entries: [
          {
            source: 'open_finance',
            dataType: 'FINANCIAL',
            fields: ['score_crediticio'],
            fetchedAt: new Date('2026-11-14T15:00:00Z'),
            ttlSeconds: 3600,
            origin: 'LIVE',
            consentGranted: true,
          },
        ],
        missing: [
          { field: 'estrato', reason: 'sin_datos' },
          { field: 'zona_riesgo', reason: 'sin_datos' },
        ],
        conflicts: [{ field: 'estrato', winner: 'open_data', discarded: ['open_finance'] }],
      });
    });

    it('should mark default over cache, and an old backup (cache + degraded) as degraded', () => {
      let origins: string[] = [];
      gateway.getLineage('c1').subscribe((l) => (origins = l!.entries.map((e) => e.origin)));

      backend
        .expectOne('/api/cotizacion/v1/asesor/clientes/c1/linaje')
        .flush(
          lineageDto([
            source({ hit_cache: true }),
            source({ hit_cache: true, degradado: true }),
            source({ degradado: true, por_defecto: true, obtenido_en: null, tipo_dato: 'NUEVO' }),
          ]),
        );

      expect(origins).toEqual(['CACHE', 'DEGRADED', 'DEFAULT']);
    });

    it('should answer null, not an error, when the client has no enriched profile', () => {
      let result: unknown = 'sin respuesta';
      gateway.getLineage('c1').subscribe((l) => (result = l));

      backend.expectOne('/api/cotizacion/v1/asesor/clientes/c1/linaje').flush(
        {
          error: {
            code: 'PERFIL_NO_ENCONTRADO',
            message: 'El cliente no tiene un perfil enriquecido.',
            details: [],
            trace_id: 't',
          },
        },
        { status: 404, statusText: '' },
      );

      expect(result).toBeNull();
    });

    it('should let an unavailable lineage (503) through as a server ApiError', () => {
      let failure: unknown;
      gateway.getLineage('c1').subscribe({ error: (e: unknown) => (failure = e) });

      backend.expectOne('/api/cotizacion/v1/asesor/clientes/c1/linaje').flush(
        {
          error: {
            code: 'LINAJE_NO_DISPONIBLE',
            message: 'El linaje no está disponible.',
            details: [],
            trace_id: 't',
          },
        },
        { status: 503, statusText: '' },
      );

      expect((failure as ApiError).kind).toBe('server');
      expect((failure as ApiError).code).toBe('LINAJE_NO_DISPONIBLE');
    });
  });
});
