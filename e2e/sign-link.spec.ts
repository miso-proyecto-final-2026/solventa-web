import { expect, signIn, test } from './support/test';
import { expectNoSeriousA11yViolations } from './support/journey';

const failure = (status: number, code: string) => ({
  status,
  json: { error: { code, message: 'x', details: [], trace_id: 't' } },
});

test.describe('Firma por enlace (HU-39)', () => {
  test('el cliente firma sin sesión y el token sale de la barra de direcciones', async ({
    page,
    backend,
  }) => {
    await page.goto('/sign#t=token-e2e');

    await expect(page.getByRole('heading', { name: 'Firma de tu póliza' })).toBeVisible();
    await expect(page.getByText('SOLV-E2E-1')).toBeVisible();
    expect(page.url()).not.toContain('token-e2e');

    await page.getByRole('button', { name: 'Abrir el documento' }).click();
    await page.getByLabel('Revisé el documento completo.').check();
    await page.getByRole('button', { name: 'Enviarme el código' }).click();
    await page.getByLabel('Código de un solo uso').fill('123 456');
    await page.getByRole('button', { name: 'Firmar', exact: true }).click();

    await expect(page.getByText('Tu póliza está firmada')).toBeVisible();
    expect(backend.linkCodes).toEqual(['123456']);
    for (const headers of backend.linkHeaders) {
      expect(headers['x-enlace-firma']).toBe('token-e2e');
      expect(headers['authorization']).toBeUndefined();
    }
  });

  test('al abrir otro enlace en la misma pestaña usa el nuevo y lo saca de la URL', async ({
    page,
    backend,
  }) => {
    await page.goto('/sign#t=token-viejo');
    await expect(page.getByText('SOLV-E2E-1')).toBeVisible();

    await page.goto('/sign#t=token-nuevo');

    await expect(page.getByRole('button', { name: 'Abrir el documento' })).toBeVisible();
    await expect.poll(() => backend.linkHeaders.at(-1)?.['x-enlace-firma']).toBe('token-nuevo');
    await expect.poll(() => page.url()).not.toContain('token-nuevo');
  });

  test('cuenta los códigos erróneos sin cerrar la página', async ({ page }) => {
    await page.goto('/sign#t=token-e2e');
    await page.getByRole('button', { name: 'Abrir el documento' }).click();
    await page.getByLabel('Revisé el documento completo.').check();
    await page.getByRole('button', { name: 'Enviarme el código' }).click();
    await page.getByLabel('Código de un solo uso').fill('000000');
    await page.getByRole('button', { name: 'Firmar', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText('Intentos restantes: 2');
    await expect(page.getByRole('button', { name: 'Abrir el documento' })).toBeVisible();
  });

  for (const [nombre, respuesta, texto] of [
    ['inválido', failure(401, 'ENLACE_INVALIDO'), 'no es válido'],
    ['vencido', failure(410, 'ENLACE_VENCIDO'), 'venció'],
    ['reemplazado', failure(410, 'ENLACE_REEMPLAZADO'), 'fue reemplazado'],
    ['con la firma vencida', failure(409, 'FIRMA_VENCIDA'), 'el cobro se devolverá'],
  ] as const) {
    test(`explica un enlace ${nombre} y no deja firmar`, async ({ page, backend }) => {
      backend.linkDocument = respuesta;

      await page.goto('/sign#t=token-e2e');

      await expect(page.getByRole('alert')).toContainText(texto);
      await expect(page.getByRole('button', { name: 'Abrir el documento' })).toHaveCount(0);
    });
  }

  test('sin token no llama al servidor', async ({ page, backend }) => {
    await page.goto('/sign');

    await expect(page.getByRole('alert')).toContainText('no es válido');
    expect(backend.linkHeaders).toHaveLength(0);
  });

  test('un enlace ya usado dice que la póliza está firmada', async ({ page, backend }) => {
    backend.linkDocument = {
      status: 200,
      json: {
        numero_poliza: 'SOLV-E2E-1',
        documento_sha256: 'a'.repeat(64),
        estado: 'FIRMADA',
        vence_en: null,
      },
    };

    await page.goto('/sign#t=token-e2e');

    await expect(page.getByText('Tu póliza está firmada')).toBeVisible();
  });

  test('un enlace inválido no le cierra la sesión al asesor', async ({ page, backend }) => {
    await signIn(page);
    backend.linkDocument = failure(401, 'ENLACE_INVALIDO');

    await page.goto('/sign#t=token-e2e');
    await expect(page.getByRole('alert')).toContainText('no es válido');

    await page.goto('/subscriptions');
    await expect(page).toHaveURL(/\/subscriptions$/);
    expect(backend.linkHeaders[0]['authorization']).toBeUndefined();
  });

  test('no tiene violaciones graves de accesibilidad', async ({ page }) => {
    await page.goto('/sign#t=token-e2e');
    await page.getByRole('button', { name: 'Abrir el documento' }).click();
    await expectNoSeriousA11yViolations(page);
  });
});
