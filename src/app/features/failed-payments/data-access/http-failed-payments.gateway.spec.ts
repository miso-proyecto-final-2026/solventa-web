import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error';
import { apiErrorInterceptor } from '@core/http/interceptors';
import { CaseDetail, CasePage, RetryResult } from '../domain/models';
import { CaseDetailDto, CaseDto } from './dto/failed-payments.dto';
import { HttpFailedPaymentsGateway } from './http-failed-payments.gateway';

const BASE = '/api/pagos/v1/pagos/cobros-fallidos';

const CASE_DTO: CaseDto = {
  id: 'tx-1',
  suscripcion_id: 'sus-1',
  cliente_id: 'cli-1',
  estado: 'PENDIENTE',
  monto: '55500.00',
  moneda: 'COP',
  intentos: 2,
  ultimo_intento_en: '2026-10-28T15:00:00Z',
  codigo_rechazo: 'FONDOS_INSUFICIENTES',
  motivo_rechazo: 'Fondos insuficientes',
  gracia_hasta: '2026-10-29T10:00:00Z',
  estado_gracia: 'POR_VENCER',
  tarjeta: { marca: 'VISA', ultimos4: '4242' },
};

describe('HttpFailedPaymentsGateway', () => {
  let gateway: HttpFailedPaymentsGateway;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpFailedPaymentsGateway,
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    gateway = TestBed.inject(HttpFailedPaymentsGateway);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('should ask Pagos for the open cases of a page, without a status filter', () => {
    let page: CasePage | undefined;
    gateway.listCases({ status: 'OPEN', dueSoonOnly: false, page: 2 }).subscribe((p) => (page = p));

    const req = backend.expectOne((r) => r.url === BASE && r.method === 'GET');
    expect(req.request.params.get('pagina')).toBe('2');
    expect(req.request.params.get('tamano')).toBe('20');
    expect(req.request.params.has('estado')).toBeFalse();
    expect(req.request.params.has('por_vencer')).toBeFalse();
    req.flush({ items: [CASE_DTO], total: 21, pagina: 2, tamano: 20 });

    expect(page?.total).toBe(21);
    expect(page?.items[0].amount).toEqual({ amount: 55500, currency: 'COP' });
    expect(page?.items[0].grace).toBe('DUE_SOON');
  });

  it('should send the status and the due-soon filter when chosen', () => {
    gateway.listCases({ status: 'EXPIRED', dueSoonOnly: true, page: 1 }).subscribe();

    const req = backend.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('estado')).toBe('VENCIDO');
    expect(req.request.params.get('por_vencer')).toBe('true');
    req.flush({ items: [], total: 0, pagina: 1, tamano: 20 });
  });

  it('should load the detail with its charges, attempts and notes', () => {
    let detail: CaseDetail | undefined;
    gateway.getCase('tx/1').subscribe((d) => (detail = d));

    const dto: CaseDetailDto = {
      ...CASE_DTO,
      reintentos: 1,
      operador_notificado_en: null,
      resuelto_en: null,
      cobros: [
        {
          transaccion_id: 'tx-1',
          es_reintento: false,
          estado: 'RECHAZADA',
          monto: '55500.00',
          creado_en: '2026-10-28T15:00:00Z',
          resuelto_en: '2026-10-28T15:00:01Z',
          intentos: [
            {
              numero: 1,
              resultado: 'RECHAZADO',
              codigo: 'FONDOS_INSUFICIENTES',
              motivo: 'Fondos insuficientes',
              referencia_pasarela: 'ref-1',
              fecha: '2026-10-28T15:00:00Z',
            },
          ],
        },
      ],
      notas: [
        {
          id: 3,
          autor_id: 'a-1',
          autor_nombre: 'Asesora Demo',
          autor_rol: 'ASESOR',
          texto: 'Llamar mañana',
          creada_en: '2026-10-28T16:00:00Z',
        },
      ],
    };
    backend.expectOne(`${BASE}/tx%2F1`).flush(dto);

    expect(detail?.retries).toBe(1);
    expect(detail?.charges[0].attempts[0].code).toBe('FONDOS_INSUFICIENTES');
    expect(detail?.notes[0].authorName).toBe('Asesora Demo');
  });

  it('should post a note as texto', () => {
    gateway.addNote('tx-1', 'Llamar mañana').subscribe();

    const req = backend.expectOne(`${BASE}/tx-1/notas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ texto: 'Llamar mañana' });
    req.flush({
      id: 1,
      autor_id: 'a',
      autor_nombre: 'A',
      autor_rol: 'ASESOR',
      texto: 'Llamar mañana',
      creada_en: '2026-10-28T16:00:00Z',
    });
  });

  it('should retry with the Idempotency-Key and read an in-progress result', () => {
    let result: RetryResult | undefined;
    gateway.retry('tx-1', 'clave-1').subscribe((r) => (result = r));

    const req = backend.expectOne(`${BASE}/tx-1/reintentar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-1');
    req.flush({
      caso_id: 'tx-1',
      transaccion_id: 'tx-9',
      numero_reintento: 1,
      resultado: 'EN_PROCESO',
      codigo_rechazo: null,
      motivo_rechazo: null,
      detalle_pasarela: 'NO_DISPONIBLE',
      estado_caso: 'PENDIENTE',
      repeticion: false,
    });

    expect(result).toEqual({
      outcome: 'IN_PROGRESS',
      gatewayDetail: 'UNAVAILABLE',
      declineReason: null,
      caseStatus: 'PENDING',
      replay: false,
    });
  });

  it('should turn a 409 of an already recovered case into an ApiError with its code', () => {
    let error: unknown;
    gateway.retry('tx-1', 'k').subscribe({ error: (e: unknown) => (error = e) });

    backend
      .expectOne(`${BASE}/tx-1/reintentar`)
      .flush(
        { error: { code: 'CASO_YA_RECUPERADO', message: 'x', details: [], trace_id: 't' } },
        { status: 409, statusText: 'Conflict' },
      );

    expect(error).toEqual(jasmine.any(ApiError));
    expect((error as ApiError).code).toBe('CASO_YA_RECUPERADO');
  });
});
