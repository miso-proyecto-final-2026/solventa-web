import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PUBLIC_REQUEST } from '@core/http/interceptors';
import { HttpSignLinkGateway } from './http-sign-link.gateway';

const BASE = '/api/suscripcion/v1/suscripciones/enlace-firma';

describe('HttpSignLinkGateway', () => {
  let gateway: HttpSignLinkGateway;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpSignLinkGateway, provideHttpClient(), provideHttpClientTesting()],
    });
    gateway = TestBed.inject(HttpSignLinkGateway);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should send the token in a header and never in the URL', () => {
    gateway.getPdf('tok').subscribe();
    const pdf = http.expectOne(`${BASE}/documento/pdf`);
    expect(pdf.request.headers.get('X-Enlace-Firma')).toBe('tok');
    expect(pdf.request.context.get(PUBLIC_REQUEST)).toBeTrue();
    expect(pdf.request.urlWithParams).not.toContain('tok');
    pdf.flush(new Blob(['%PDF']));

    gateway.requestCode('tok').subscribe();
    const code = http.expectOne(`${BASE}/codigo`);
    expect(code.request.headers.get('X-Enlace-Firma')).toBe('tok');
    code.flush(null, { status: 202, statusText: 'Accepted' });
  });

  it('should map the document', () => {
    let state = '';
    gateway.getDocument('tok').subscribe((d) => (state = d.state));

    http.expectOne(`${BASE}/documento`).flush({
      numero_poliza: 'N',
      documento_sha256: 'a',
      estado: 'FIRMADA',
      vence_en: null,
    });

    expect(state).toBe('SIGNED');
  });

  it('should send the signature with the backend field names', () => {
    gateway.sign('tok', { hash: 'h', reviewed: true, code: '123456' }).subscribe();

    const req = http.expectOne(`${BASE}/firma`);
    expect(req.request.body).toEqual({
      documento_sha256: 'h',
      documento_revisado: true,
      codigo: '123456',
    });
    req.flush({});
  });
});
