import { SERVER_ERROR, UNAUTHENTICATED } from './support/backend';
import { expectNoSeriousA11yViolations } from './support/journey';
import { expect, signIn, test } from './support/test';

test.describe('Cobros fallidos (HU-19)', () => {
  test.describe('como asesor', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await page.goto('/failed-payments');
    });

    test('la bandeja muestra monto, intentos, motivo y gracia, y resalta el que vence pronto', async ({
      page,
    }) => {
      const rows = page.getByRole('row');
      // Encabezado + dos casos, el más urgente primero.
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(1)).toContainText('Fondos insuficientes');
      await expect(rows.nth(1)).toContainText('Vence en menos de 24 h');
      await expect(rows.nth(1)).toHaveClass(/fp__row--urgent/);
      await expect(rows.nth(2)).toContainText('Tarjeta bloqueada por el banco');
      await expect(rows.nth(2)).toContainText('En gracia');
    });

    test('el detalle muestra el historial con el código de la pasarela y sin datos de contacto', async ({
      page,
    }) => {
      await page
        .getByRole('link', { name: /Ver detalle/ })
        .first()
        .click();

      await expect(page).toHaveURL(/\/failed-payments\/tx-urgente$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cobro fallido');
      await expect(page.getByText('Cobro original')).toBeVisible();
      await expect(page.getByRole('cell', { name: 'FONDOS_INSUFICIENTES' })).toBeVisible();
      await expect(page.getByText('VISA •••• 4242')).toBeVisible();
      await expect(page.locator('main')).not.toContainText(/@|celular|tok_/);
    });

    test('el reintento aprobado recupera el cobro y no se puede repetir', async ({
      page,
      backend,
    }) => {
      await page.goto('/failed-payments/tx-urgente');
      const retry = page.getByRole('button', { name: 'Reintentar cobro' });

      await retry.click();

      await expect(page.getByText('Cobro aprobado. El caso quedó recuperado.')).toBeVisible();
      expect(backend.retryKeys).toHaveLength(1);
      expect(backend.retryKeys[0]).toMatch(/^[0-9a-f-]{36}$/);
      await expect(page.getByText('Recuperado', { exact: true })).toBeVisible();
      await expect(retry).toBeDisabled();
    });

    test('un rechazo y la pasarela caída tienen mensajes distintos', async ({ page, backend }) => {
      await page.goto('/failed-payments/tx-normal');
      const retry = page.getByRole('button', { name: 'Reintentar cobro' });

      backend.retryMode = 'RECHAZADO';
      await retry.click();
      await expect(page.getByRole('alert')).toContainText(
        'La pasarela rechazó el cobro otra vez: Fondos insuficientes',
      );

      backend.retryMode = 'NO_DISPONIBLE';
      await retry.click();
      await expect(
        page.getByRole('status').filter({ hasText: 'no está disponible' }),
      ).toBeVisible();
      // Dos intenciones del usuario, dos claves distintas.
      expect(new Set(backend.retryKeys).size).toBe(2);
    });

    test('las notas quedan con autor y fecha, y no aceptan números de tarjeta', async ({
      page,
    }) => {
      await page.goto('/failed-payments/tx-normal');
      const note = page.getByLabel('Nueva nota');
      const save = page.getByRole('button', { name: 'Guardar nota' });

      await note.fill('Cliente contactado; paga mañana.');
      await save.click();
      await expect(page.getByText('Cliente contactado; paga mañana.')).toBeVisible();
      await expect(page.getByText(/Asesora Demo.*ASESOR/)).toBeVisible();
      await expect(note).toHaveValue('');

      await note.fill('paga con 4111111111111111');
      await save.click();
      await expect(page.getByText(/no puede llevar números de tarjeta/)).toBeVisible();
      await expect(note).toHaveAttribute('aria-invalid', 'true');
    });

    test('una bandeja vacía y un fallo del servidor tienen mensajes distintos', async ({
      page,
      backend,
    }) => {
      backend.cases = [];
      await page.getByLabel('Estado').selectOption({ label: 'Pendiente' });
      await expect(page.getByText('No hay cobros fallidos con estos filtros.')).toBeVisible();

      backend.failNextCases(SERVER_ERROR);
      await page.getByLabel('Estado').selectOption({ label: 'Abiertos' });
      await expect(page.getByRole('alert')).toContainText('problema del servidor');
    });

    test('una sesión vencida lleva al inicio de sesión y vuelve a la bandeja', async ({
      page,
      backend,
    }) => {
      // Con la bandeja ya cargada: el 401 llega en la consulta que dispara el filtro.
      await expect(page.getByRole('row')).toHaveCount(3);
      backend.failNextCases(UNAUTHENTICATED);

      await page.getByLabel('Solo los que vencen en menos de 24 h').check();

      await expect(page).toHaveURL(/\/login\?returnUrl=%2Ffailed-payments/);
    });

    test('sin fallos graves de accesibilidad en la bandeja y en el detalle', async ({ page }) => {
      await expect(page.getByRole('row')).toHaveCount(3);
      await expectNoSeriousA11yViolations(page);

      await page
        .getByRole('link', { name: /Ver detalle/ })
        .first()
        .click();
      await expect(page.getByText('Cobro original')).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });
  });

  test('el operador ve cobros fallidos en la navegación, pero no la cotización asistida', async ({
    page,
  }) => {
    await signIn(page, 'OPERADOR');
    await page.goto('/');

    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('link', { name: /Cobros fallidos/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Cotización asistida/ })).toHaveCount(0);

    await nav.getByRole('link', { name: /Cobros fallidos/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cobros fallidos');
  });
});
