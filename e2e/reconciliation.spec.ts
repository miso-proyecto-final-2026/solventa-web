import { expectNoSeriousA11yViolations } from './support/journey';
import { expect, signIn, test } from './support/test';

test.describe('Conciliación de desembolsos (HU-31)', () => {
  test.describe('como operador', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, 'OPERADOR');
    });

    test('la lista muestra el evento, el pago y la conciliación, con el cliente enmascarado', async ({
      page,
    }) => {
      await page.goto('/reconciliation');

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Conciliación de desembolsos',
      );
      const rows = page.getByRole('row');
      // Encabezado + tres desembolsos.
      await expect(rows).toHaveCount(4);
      await expect(rows.nth(1)).toContainText('Sismo');
      await expect(rows.nth(1)).toContainText('Magnitud: 6.4');
      await expect(rows.nth(1)).toContainText('Pagado');
      await expect(rows.nth(1)).toContainText('Pendiente');
      await expect(rows.nth(2)).toContainText('Conciliado');
      await expect(page.locator('main')).toContainText('cli***01');
      await expect(page.locator('main')).not.toContainText(/cli-0|cta_|tok_/);
    });

    test('el resumen comprueba que no hubo pagos duplicados', async ({ page }) => {
      await page.goto('/reconciliation');

      await expect(page.getByText('Claves con más de un pago')).toBeVisible();
      await expect(page.getByText('Sin pagos duplicados')).toBeVisible();
    });

    test('los filtros por tipo de evento y estado llegan a Pagos y la lista se actualiza', async ({
      page,
      backend,
    }) => {
      await page.goto('/reconciliation');

      await page.getByLabel('Tipo de evento').selectOption('inundacion');
      await expect(page.getByRole('row')).toHaveCount(2);
      await page.getByLabel('Tipo de evento').selectOption('');
      await page.getByLabel('Conciliación', { exact: true }).selectOption('PENDING');
      await expect(page.getByRole('row')).toHaveCount(3);

      expect(backend.listQueries.some((q) => q.get('tipo_evento') === 'inundacion')).toBe(true);
      expect(backend.listQueries.at(-1)?.get('estado_conciliacion')).toBe('PENDIENTE');
      await page.getByRole('button', { name: 'Quitar filtros' }).click();
      await expect(page.getByRole('row')).toHaveCount(4);
    });

    test('conciliar un desembolso que coincide deja quién lo verificó', async ({ page }) => {
      await page.goto('/reconciliation');
      await page
        .getByRole('link', { name: /Ver detalle/ })
        .first()
        .click();

      await expect(page).toHaveURL(/\/reconciliation\/ds-1$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Desembolso');
      await expect(page.getByText('evt-1:pol-1')).toBeVisible();
      await expect(page.getByText('ninguna volvió a pagar')).toBeVisible();

      await page.getByRole('button', { name: 'Conciliar con la pasarela' }).click();

      await expect(page.getByText('Conciliado: el pago coincide con el extracto')).toBeVisible();
      // El nombre también sale en la cabecera: se busca solo en el contenido de la página.
      await expect(page.locator('#main-content').getByText('Operador Demo')).toBeVisible();
    });

    test('una diferencia se muestra y se escala con una nota obligatoria', async ({
      page,
      backend,
    }) => {
      backend.extractMode = 'DIFERENCIA';
      await page.goto('/reconciliation/ds-1');

      await page.getByRole('button', { name: 'Conciliar con la pasarela' }).click();
      await expect(page.getByText('El monto del extracto no coincide')).toBeVisible();
      await expect(page.getByText('Monto en la pasarela')).toBeVisible();

      const note = page.getByLabel('Nota para el equipo de pagos');
      await page.getByRole('button', { name: 'Escalar', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('1 a 500');
      await expect(note).toHaveAttribute('aria-invalid', 'true');

      await note.fill('El extracto dice 4,9 millones');
      await page.getByRole('button', { name: 'Escalar', exact: true }).click();

      await expect(page.getByText('Escalado. El equipo de pagos verá tu nota')).toBeVisible();
      expect(backend.escalations).toEqual([{ id: 'ds-1', nota: 'El extracto dice 4,9 millones' }]);
    });

    test('si la pasarela no tiene el pago lo dice y no cambia nada', async ({ page, backend }) => {
      backend.extractMode = 'SIN_PAGO';
      await page.goto('/reconciliation/ds-1');

      await page.getByRole('button', { name: 'Conciliar con la pasarela' }).click();

      await expect(page.getByRole('alert')).toContainText('No se cambió nada');
      await expect(page.getByText('Pendiente', { exact: true })).toBeVisible();
    });

    test('exporta el reporte en CSV y en PDF con los filtros elegidos', async ({
      page,
      backend,
    }) => {
      await page.goto('/reconciliation');
      await page.getByLabel('Tipo de evento').selectOption('sismo');

      const csv = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exportar CSV' }).click();
      expect((await csv).suggestedFilename()).toBe('conciliacion-desembolsos.csv');
      await expect(page.getByText('El reporte se descargó')).toBeAttached();

      const pdf = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exportar PDF' }).click();
      expect((await pdf).suggestedFilename()).toBe('conciliacion-desembolsos.pdf');
      expect(backend.exportRequests).toEqual(['csv', 'pdf']);
    });

    test('un desembolso que no existe se explica y no ofrece recargar', async ({ page }) => {
      await page.goto('/reconciliation/no-existe');

      await expect(page.getByRole('alert')).toContainText('no existe');
      await expect(page.getByRole('button', { name: 'Volver a cargar' })).toHaveCount(0);
    });

    test('la lista y el detalle no tienen violaciones graves de accesibilidad', async ({
      page,
    }) => {
      await page.goto('/reconciliation');
      await expect(page.getByRole('row')).toHaveCount(4);
      await expectNoSeriousA11yViolations(page);

      await page.goto('/reconciliation/ds-1');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Desembolso');
      await expectNoSeriousA11yViolations(page);
    });
  });

  test('un asesor no entra a la conciliación: vuelve al inicio', async ({ page }) => {
    await signIn(page, 'ASESOR');
    await page.goto('/reconciliation');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: 'Conciliación' })).toHaveCount(0);
  });

  test('el operador ve la opción Conciliación en el menú', async ({ page }) => {
    await signIn(page, 'OPERADOR');
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Conciliación' })).toBeVisible();
  });
});
