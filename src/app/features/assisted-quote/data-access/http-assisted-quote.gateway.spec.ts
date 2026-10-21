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
});
