import { SERVER_ERROR } from './support/backend';
import { expectNoSeriousA11yViolations } from './support/journey';
import { expect, signIn, test } from './support/test';

const CARD = '4242 4242 4242 4242';

test.describe('Venta asistida (HU-39)', () => {
  test.describe('como asesor', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
    });

    test('inicia la suscripción y envía solo el token, nunca el número de la tarjeta', async ({
      page,
      backend,
    }) => {
      await page.goto('/subscriptions/new/cot-e2e-1');

      await page.getByLabel('Número de tarjeta').fill(CARD);
      await page.getByLabel('El cliente está al tanto de esta transacción').check();
      await page.getByRole('button', { name: 'Iniciar suscripción' }).click();

      await expect(page).toHaveURL(/\/subscriptions\/sus-e2e-1$/);
      expect(backend.startRequests).toHaveLength(1);
      const [{ body, key }] = backend.startRequests;
      expect(key).toBeTruthy();
      expect(body).toMatchObject({
        cotizacion_id: 'cot-e2e-1',
        acepta_terminos: true,
        periodicidad_pago: 'ANUAL',
      });
      expect(body.metodo_pago).toMatch(/^tok_sim_/);
      expect(JSON.stringify(body)).not.toContain('4242');
    });

    test('no deja iniciar sin la declaración del asesor', async ({ page, backend }) => {
      await page.goto('/subscriptions/new/cot-e2e-1');

      await page.getByLabel('Número de tarjeta').fill(CARD);
      await page.getByRole('button', { name: 'Iniciar suscripción' }).click();

      await expect(page.getByText('Confirma que el cliente aceptó')).toBeVisible();
      expect(backend.startRequests).toHaveLength(0);
    });

    test('firma en pantalla, emite y descarga la póliza', async ({ page, backend }) => {
      await page.goto('/subscriptions');
      await expect(page.getByRole('row').nth(1)).toContainText('Ana P.');
      await expect(page.getByRole('row').nth(1)).toContainText('Cobro realizado');
      await page.getByRole('link', { name: /Gestionar firma/ }).click();

      await expect(page.getByRole('listitem').filter({ hasText: 'Firma' }).last()).toHaveAttribute(
        'aria-current',
        'step',
      );
      await page.getByRole('button', { name: 'Gestionar firma' }).click();
      await page.getByRole('button', { name: 'Abrir el documento' }).click();
      await expect(page.getByTitle('Documento de la póliza por firmar')).toBeVisible();
      await page.getByLabel('El cliente revisó el documento completo.').check();
      await page.getByRole('button', { name: 'Enviar código al cliente' }).click();
      await page.getByLabel('Código de un solo uso').fill('123456');
      await page.getByRole('button', { name: 'Firmar', exact: true }).click();

      await expect(page.getByText('Póliza firmada y emitida')).toBeVisible();
      expect(backend.signCodes).toEqual(['123456']);
      await expect(page.getByRole('button', { name: 'Gestionar firma' })).toHaveCount(0);

      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Descargar póliza firmada' }).click();
      expect((await download).suggestedFilename()).toBe('poliza-SOLV-E2E-1-firmada.pdf');
    });

    test('avisa los intentos que quedan y, al agotarlos, explica la devolución del cobro', async ({
      page,
    }) => {
      await page.goto('/subscriptions/sus-e2e-1');
      await page.getByRole('button', { name: 'Gestionar firma' }).click();
      await page.getByRole('button', { name: 'Abrir el documento' }).click();
      await page.getByLabel('El cliente revisó el documento completo.').check();
      await page.getByRole('button', { name: 'Enviar código al cliente' }).click();

      await page.getByLabel('Código de un solo uso').fill('000000');
      await page.getByRole('button', { name: 'Firmar', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Intentos restantes: 2');

      await page.getByLabel('Código de un solo uso').fill('000000');
      await page.getByRole('button', { name: 'Firmar', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Intentos restantes: 1');

      await page.getByLabel('Código de un solo uso').fill('000000');
      await page.getByRole('button', { name: 'Firmar', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('el cobro se devolverá');
      await expect(page.getByText('Se solicitó la devolución del cobro')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Gestionar firma' })).toHaveCount(0);
    });

    test('solo ofrece gestionar la firma cuando el backend lo permite', async ({
      page,
      backend,
    }) => {
      backend.subscription = {
        ...backend.subscription,
        estado_saga: 'APROBADA',
        paso_actual: 'COBRO',
        cobro_estado: 'RECHAZADO',
        puede_gestionar_firma: false,
      };

      await page.goto('/subscriptions/sus-e2e-1');

      await expect(page.getByText('La pasarela rechazó el cobro')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Gestionar firma' })).toHaveCount(0);
    });

    test('el correo aparece deshabilitado y explica por qué', async ({ page }) => {
      await page.goto('/subscriptions/sus-e2e-1');
      await page.getByRole('button', { name: 'Gestionar firma' }).click();

      await expect(page.getByRole('button', { name: 'Enviar por correo' })).toBeDisabled();
      await expect(page.getByText('cuando exista el servicio de notificaciones')).toBeVisible();
    });

    test('explica el 403 de una suscripción de un cliente que no atendió', async ({
      page,
      backend,
    }) => {
      backend.subscriptionForbidden = true;

      await page.goto('/subscriptions/sus-e2e-1');

      await expect(page.getByRole('alert')).toContainText('no atendiste');
    });

    test('explica una falla del servicio al iniciar y deja reintentar con la misma clave', async ({
      page,
      backend,
    }) => {
      backend.nextStartFailure = SERVER_ERROR;
      await page.goto('/subscriptions/new/cot-e2e-1');

      await page.getByLabel('Número de tarjeta').fill(CARD);
      await page.getByLabel('El cliente está al tanto de esta transacción').check();
      await page.getByRole('button', { name: 'Iniciar suscripción' }).click();
      await expect(page.getByRole('alert')).toContainText('problema del servidor');
      await expect(page.getByLabel('Número de tarjeta')).toHaveValue('');

      await page.getByLabel('Número de tarjeta').fill(CARD);
      await page.getByRole('button', { name: 'Iniciar suscripción' }).click();

      await expect(page).toHaveURL(/\/subscriptions\/sus-e2e-1$/);
      expect(backend.startRequests[1].key).toBe(backend.startRequests[0].key);
    });

    test('las pantallas no tienen violaciones graves de accesibilidad', async ({ page }) => {
      await page.goto('/subscriptions');
      await expect(page.getByRole('row').nth(1)).toBeVisible();
      await expectNoSeriousA11yViolations(page);

      await page.goto('/subscriptions/new/cot-e2e-1');
      await expect(page.getByLabel('Número de tarjeta')).toBeVisible();
      await expectNoSeriousA11yViolations(page);

      await page.goto('/subscriptions/sus-e2e-1');
      await page.getByRole('button', { name: 'Gestionar firma' }).click();
      await expect(page.getByRole('button', { name: 'Enviar por correo' })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });
  });

  test('un operador no entra a las suscripciones', async ({ page }) => {
    await signIn(page, 'OPERADOR');

    await page.goto('/subscriptions');

    await expect(page).not.toHaveURL(/subscriptions/);
    await expect(page.getByRole('link', { name: 'Suscripciones' })).toHaveCount(0);
  });

  test('sin sesión lleva al inicio de sesión', async ({ page }) => {
    await page.goto('/subscriptions');

    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fsubscriptions/);
  });
});
