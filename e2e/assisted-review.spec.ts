import { UNAUTHENTICATED } from './support/backend';
import { expectNoSeriousA11yViolations } from './support/journey';
import { expect, signIn, test } from './support/test';

const JUSTIFICATION = 'Se revisaron los soportes de ingresos del cliente.';

test.describe('Revisión asistida (HU-16)', () => {
  test.describe('como asesor', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await page.goto('/assisted-review');
    });

    test('la bandeja muestra prioridad con texto e icono, fecha, motivo, cliente y monto, el más antiguo primero', async ({
      page,
    }) => {
      const rows = page.getByRole('row');
      // Encabezado + tres casos.
      await expect(rows).toHaveCount(4);
      await expect(rows.nth(1)).toContainText('Alta');
      await expect(rows.nth(1)).toContainText('Datos incompletos o inconsistentes');
      await expect(rows.nth(1)).toContainText('Ana María P.');
      await expect(rows.nth(1)).toContainText('Microseguro de vida');
      await expect(rows.nth(1)).toContainText(/40\.000\.000/);
      await expect(rows.nth(2)).toContainText('Media');
      await expect(rows.nth(3)).toContainText('Baja');
      await expect(rows.nth(1).locator('.ar__badge [aria-hidden="true"]').first()).toHaveText('▲');
    });

    test('camino feliz: de la bandeja al detalle y aprobar con justificación', async ({
      page,
      backend,
    }) => {
      await page
        .getByRole('link', { name: /Ver detalle/ })
        .first()
        .click();

      await expect(page).toHaveURL(/\/assisted-review\/rev-1$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Caso en revisión asistida');
      await expect(page.getByText('******300')).toBeVisible();
      await expect(page.getByText('Nivel de endeudamiento')).toBeVisible();
      await expect(page.locator('main')).not.toContainText(/Pérez|tok_|@/);

      await page.getByLabel('Aprobar').check();
      await page.getByLabel('Justificación').fill(JUSTIFICATION);
      await page.getByRole('button', { name: 'Revisar decisión' }).click();
      await expect(page.getByText('Se cobrará la prima de la cotización')).toBeVisible();
      await page.getByRole('button', { name: 'Confirmar decisión' }).click();

      await expect(page.getByText('Caso aprobado. Se cobrará la prima')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Decisión del asesor' })).toBeVisible();
      expect(backend.reviewDecisions).toEqual([
        { id: 'rev-1', body: { decision: 'APROBADA', justificacion: JUSTIFICATION } },
      ]);
    });

    test('ajustar con un monto inválido y luego con uno válido', async ({ page, backend }) => {
      await page.goto('/assisted-review/rev-1');
      await page.getByLabel('Ajustar la cobertura').check();
      await page.getByLabel('Justificación').fill(JUSTIFICATION);

      await page.getByLabel('Nuevo monto asegurado').fill('45000000');
      await page.getByRole('button', { name: 'Revisar decisión' }).click();
      await expect(
        page.getByText('El nuevo monto debe ser menor que el actual.').first(),
      ).toBeVisible();
      expect(backend.reviewDecisions).toHaveLength(0);

      await page.getByLabel('Nuevo monto asegurado').fill('30000000');
      await page.getByRole('button', { name: 'Revisar decisión' }).click();
      await expect(page.getByText('Se cobrará la prima ajustada')).toBeVisible();
      await page.getByRole('button', { name: 'Confirmar decisión' }).click();

      await expect(page.getByText('Cobertura ajustada.')).toBeVisible();
      expect(backend.reviewDecisions[0].body).toEqual({
        decision: 'AJUSTADA',
        justificacion: JUSTIFICATION,
        monto_asegurado: 30000000,
      });
    });

    test('rechazar sin justificación muestra el resumen de errores con el foco', async ({
      page,
      backend,
    }) => {
      await page.goto('/assisted-review/rev-1');
      await page.getByLabel('Rechazar').check();

      await page.getByRole('button', { name: 'Revisar decisión' }).click();

      const summary = page.getByRole('alert').filter({ hasText: 'Revisa estos datos' });
      await expect(summary).toBeVisible();
      await expect(summary).toContainText('al menos 20 caracteres');
      await expect(summary.getByRole('heading')).toBeFocused();
      expect(backend.reviewDecisions).toHaveLength(0);

      await page.getByLabel('Justificación').fill(JUSTIFICATION);
      await page.getByRole('button', { name: 'Revisar decisión' }).click();
      await expect(page.getByText('La compra se cerrará sin cobro')).toBeVisible();
      await page.getByRole('button', { name: 'Confirmar decisión' }).click();
      await expect(page.getByText('Caso rechazado. La compra se cerró sin cobro.')).toBeVisible();
    });

    test('con la cotización vencida, aprobar y ajustar están deshabilitados y rechazar funciona', async ({
      page,
      backend,
    }) => {
      await page.goto('/assisted-review/rev-venc');

      await expect(
        page.getByText('Solo se puede cerrar el caso; el cliente debe volver a cotizar'),
      ).toBeVisible();
      await expect(page.getByLabel('Aprobar')).toBeDisabled();
      await expect(page.getByLabel('Ajustar la cobertura')).toBeDisabled();
      await expect(page.getByLabel('Rechazar')).toBeEnabled();
      await expect(page.getByLabel('Aprobar')).toHaveAttribute(
        'aria-describedby',
        'ar-expired-reason',
      );

      await page.getByRole('button', { name: 'Cerrar por cotización vencida' }).click();
      await expect(page.getByLabel('Rechazar')).toBeChecked();
      await expect(page.getByLabel('Justificación')).toHaveValue(/La cotización venció el/);
      await page.getByRole('button', { name: 'Revisar decisión' }).click();
      await page.getByRole('button', { name: 'Confirmar decisión' }).click();

      await expect(page.getByText('Caso rechazado. La compra se cerró sin cobro.')).toBeVisible();
      expect(backend.reviewDecisions[0].body['decision']).toBe('RECHAZADA');
    });

    test('la cotización vencida se ve con su insignia y el aviso con el conteo, y el filtro la aísla', async ({
      page,
    }) => {
      await expect(
        page
          .getByRole('status')
          .filter({ hasText: '1 caso tiene la cotización vencida y solo se puede cerrar' }),
      ).toBeVisible();
      const expired = page.getByRole('row').filter({ hasText: 'Cotización vencida' });
      await expect(expired).toHaveCount(1);
      await expect(expired.locator('.ar__badge--expired')).toHaveAttribute(
        'aria-label',
        /Cotización vencida el/,
      );
      await expect(expired).toHaveClass(/ar__row--expired/);

      await page.getByLabel('Solo cotizaciones vencidas').check();

      await expect(page.getByRole('row')).toHaveCount(2);
      await expect(page.getByRole('row').nth(1)).toContainText('Monto asegurado sobre el límite');
    });

    test('«Cerrar por cotización vencida» desde la bandeja rechaza con la justificación sugerida y saca el caso de los pendientes', async ({
      page,
      backend,
    }) => {
      await page.getByRole('button', { name: 'Cerrar por cotización vencida' }).click();
      const area = page.getByLabel('Justificación del cierre');
      await expect(area).toHaveValue(
        /La cotización venció el .* antes de decidir; el cliente debe volver a cotizar\./,
      );
      const suggested = await area.inputValue();
      await expect(page.getByRole('dialog')).toHaveCount(0); // en línea, sin modal

      await page.getByRole('button', { name: 'Confirmar cierre sin cobro' }).click();

      await expect(page.locator('#ar-announcement')).toContainText('sin cobro');
      await expect(page.getByRole('row')).toHaveCount(3); // encabezado + los dos que siguen pendientes
      await expect(page.getByRole('row').filter({ hasText: 'Cotización vencida' })).toHaveCount(0);
      expect(backend.reviewDecisions).toEqual([
        { id: 'rev-venc', body: { decision: 'RECHAZADA', justificacion: suggested } },
      ]);
    });

    test('una segunda decisión concurrente muestra quién ganó y recarga el caso', async ({
      page,
      backend,
    }) => {
      await page.goto('/assisted-review/rev-3');
      await page.getByLabel('Aprobar').check();
      await page.getByLabel('Justificación').fill(JUSTIFICATION);
      await page.getByRole('button', { name: 'Revisar decisión' }).click();
      // Otro asesor decide primero.
      Object.assign(backend.reviewCases[2], {
        estado: 'DECIDIDA',
        puede_decidir: false,
        decisiones_permitidas: [],
        decision_humana: {
          decision: 'APROBADA',
          justificacion: 'Otra justificación.',
          asesor_id: 'a-2',
          asesor_nombre: 'Laura Gómez',
          decidido_en: new Date().toISOString(),
          ajuste: null,
        },
      });

      await page.getByRole('button', { name: 'Confirmar decisión' }).click();

      await expect(page.getByText('Otro asesor ya decidió este caso.').first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Decisión del asesor' })).toBeVisible();
      await expect(page.getByText('Laura Gómez')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Confirmar decisión' })).toHaveCount(0);
    });

    test('una sesión vencida al decidir lleva al login', async ({ page, backend }) => {
      await page.goto('/assisted-review/rev-1');
      await page.getByLabel('Aprobar').check();
      await page.getByLabel('Justificación').fill(JUSTIFICATION);
      await page.getByRole('button', { name: 'Revisar decisión' }).click();
      backend.nextReviewDecisionFailure = UNAUTHENTICATED;

      await page.getByRole('button', { name: 'Confirmar decisión' }).click();

      await expect(page).toHaveURL(/\/login/);
    });

    test('la bandeja y el detalle no tienen violaciones críticas o serias de accesibilidad', async ({
      page,
    }) => {
      await expect(page.getByRole('row')).toHaveCount(4);
      await expectNoSeriousA11yViolations(page);

      await page.goto('/assisted-review/rev-1');
      await expect(page.getByRole('heading', { name: 'Perfilamiento' })).toBeVisible();
      await expect(page.getByText('Nivel de endeudamiento')).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });
  });

  test('un operador no entra a la revisión asistida', async ({ page }) => {
    await signIn(page, 'OPERADOR');

    await page.goto('/assisted-review');

    await expect(page).not.toHaveURL(/assisted-review/);
    await expect(page.getByRole('link', { name: 'Revisión asistida' })).toHaveCount(0);
  });

  test('la opción de navegación aparece solo para el asesor', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Revisión asistida' })).toBeVisible();
  });
});
