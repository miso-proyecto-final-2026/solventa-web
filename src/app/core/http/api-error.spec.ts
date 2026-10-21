import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

const response = (status: number, error: unknown = null) =>
  new HttpErrorResponse({ status, error, url: '/api/x' });

describe('toApiError', () => {
  it('should classify the status codes the screens care about', () => {
    expect(toApiError(response(0)).kind).toBe('network');
    expect(toApiError(response(401)).kind).toBe('unauthenticated');
    expect(toApiError(response(403)).kind).toBe('forbidden');
    expect(toApiError(response(404)).kind).toBe('not-found');
    expect(toApiError(response(422)).kind).toBe('validation');
    expect(toApiError(response(500)).kind).toBe('server');
    expect(toApiError(response(503)).kind).toBe('server');
  });

  it('should read the field errors of the quote service envelope', () => {
    const error = toApiError(
      response(422, {
        error: {
          code: 'VALIDATION_ERROR',
          details: [{ campo: 'datos.edad', motivo: 'debe ser mayor o igual a 18' }],
        },
      }),
    );

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.fields).toEqual([{ field: 'datos.edad', reason: 'debe ser mayor o igual a 18' }]);
  });

  it('should read the identity service detail, as text or as a list', () => {
    expect(toApiError(response(401, { detail: 'Credenciales inválidas' })).fields).toEqual([]);

    const error = toApiError(
      response(422, { detail: [{ loc: ['query', 'numero_documento'], msg: 'demasiado corto' }] }),
    );
    expect(error.fields).toEqual([{ field: 'numero_documento', reason: 'demasiado corto' }]);
  });

  it('should cope with an empty or unexpected body', () => {
    expect(toApiError(response(500, 'Internal Server Error')).fields).toEqual([]);
    expect(toApiError(response(500, {})).code).toBeNull();
  });
});
