import { Failure } from './support/backend';
import {
  expectNoSeriousA11yViolations,
  fillLifeInsurance,
  goToInsuranceStep,
  ui,
} from './support/journey';
import { expect, signIn, test } from './support/test';

const UNAVAILABLE: Failure = {
  status: 503,
  body: {
    error: {
      code: 'LINAJE_NO_DISPONIBLE',
      message: 'El linaje no está disponible en este momento. Intente de nuevo más tarde.',
      details: [],
      trace_id: 't',
    },
  },
};

test.describe('Cotización asistida: linaje de fuentes (HU24)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/assisted-quote');
  });

  async function quoteFor(page: Parameters<typeof goToInsuranceStep>[0], document: string) {
    const controls = ui(page);
    await goToInsuranceStep(page, document);
    await fillLifeInsurance(page);
    await controls.requestQuote.click();
    await expect(controls.stepHeading).toHaveText('Resultado');
  }

  test('el asesor abre la pestaña y ve de dónde salió cada dato, sin valores del cliente', async ({
    page,
    backend,
  }) => {
    await quoteFor(page, '1000000001');
    const lineageTab = page.getByRole('tab', { name: 'Linaje de fuentes' });
    await expect(page.getByRole('tab', { name: 'Cotización' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(backend.lineageRequests).toEqual([]);

    await lineageTab.click();

    await expect(lineageTab).toHaveAttribute('aria-selected', 'true');
    const panel = page.getByRole('tabpanel', { name: 'Linaje de fuentes' });
    await expect(panel.getByRole('heading', { name: 'Linaje de fuentes' })).toBeVisible();
    // El panel de la cotización se oculta: antes seguía visible encima del linaje.
    await expect(page.locator('#panel-quote')).toBeHidden();
    await expect(page.getByText(/Prima anual/)).toBeHidden();
    // Entre el texto y la fecha hay un espacio («el 15/11/2026», no «el15/11/2026»).
    await expect(panel.getByText(/^Perfil enriquecido el \S/)).toBeVisible();
    await expect(
      panel.getByRole('row', {
        name: /Open Finance\s+Financiero\s+Ingresos mensuales.*Consulta en vivo\s+Otorgado/,
      }),
    ).toBeVisible();
    await expect(
      panel.getByRole('row', {
        name: /Open Data\s+Socioeconómico\s+Ninguno\s+Sin consulta\s+24 h\s+Por defecto/,
      }),
    ).toBeVisible();
    await expect(panel.getByText('Estrato: La fuente no estaba disponible')).toBeVisible();
    await expect(
      panel.getByText('Puede no ser el perfil con el que se calculó este precio'),
    ).toBeVisible();
    await expect(panel).not.toContainText('4.500.000');
    expect(backend.lineageRequests).toEqual(['00000000-0000-4000-8000-0000000000a1']);

    // Las acciones siguen disponibles y la pestaña de la cotización conserva el resultado.
    await expect(page.getByRole('link', { name: 'Iniciar suscripción' })).toBeVisible();
    await page.getByRole('tab', { name: 'Cotización' }).click();
    await expect(page.getByText(/Prima anual:\s*\$\s?157\.938/)).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test('en una pantalla de escritorio (1366 px) la tabla cabe completa', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await quoteFor(page, '1000000001');
    await page.getByRole('tab', { name: 'Linaje de fuentes' }).click();
    const panel = page.getByRole('tabpanel', { name: 'Linaje de fuentes' });
    await expect(panel.getByRole('row', { name: /Open Finance/ })).toBeVisible();

    // Sin anchos fijos: el ancho del texto depende de las fuentes del sistema (Windows y Linux difieren). Se compara
    // cada caja con la de su contenedor, con 1 px de tolerancia por el redondeo.
    type Box = { x: number; y: number; width: number; height: number };
    const inside = (inner: Box, outer: Box) =>
      inner.x >= outer.x - 1 &&
      inner.y >= outer.y - 1 &&
      inner.x + inner.width <= outer.x + outer.width + 1 &&
      inner.y + inner.height <= outer.y + outer.height + 1;

    // La columna del consentimiento (la última) se ve completa dentro de la región, sin desplazarla.
    const region = panel.getByRole('region', { name: 'Tabla de fuentes del perfil' });
    const regionBox = (await region.boundingBox())!;
    const consentCells = [
      panel.getByRole('columnheader', { name: 'Consentimiento' }),
      ...(await panel.locator('tbody tr > :last-child').all()),
    ];
    expect(consentCells.length).toBeGreaterThan(1);
    for (const cell of consentCells) {
      expect(inside((await cell.boundingBox())!, regionBox), await cell.innerText()).toBe(true);
    }

    // Cada etiqueta de origen queda dentro de su celda, aunque se parta en dos renglones.
    const cells = await panel.locator('td:has(.lineage__origin)').all();
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      const label = cell.locator('.lineage__origin');
      expect(
        inside((await label.boundingBox())!, (await cell.boundingBox())!),
        await label.innerText(),
      ).toBe(true);
    }
  });

  test('con el teclado se cambia de pestaña con las flechas', async ({ page }) => {
    await quoteFor(page, '1000000001');

    await page.getByRole('tab', { name: 'Cotización' }).focus();
    await page.keyboard.press('ArrowRight');

    await expect(page.getByRole('tab', { name: 'Linaje de fuentes' })).toBeFocused();
    await expect(page.getByRole('tabpanel', { name: 'Linaje de fuentes' })).toBeVisible();
  });

  test('si el linaje no está disponible se informa y se puede reintentar', async ({
    page,
    backend,
  }) => {
    await quoteFor(page, '1000000001');
    backend.failNextLineage(UNAVAILABLE);

    await page.getByRole('tab', { name: 'Linaje de fuentes' }).click();

    const panel = page.getByRole('tabpanel', { name: 'Linaje de fuentes' });
    await expect(panel.getByRole('alert')).toContainText(
      'El linaje no está disponible en este momento',
    );
    await panel.getByRole('button', { name: 'Reintentar' }).click();
    await expect(panel.getByRole('row', { name: /Open Finance/ })).toBeVisible();
    expect(backend.lineageRequests.length).toBe(2);
  });

  test('un cliente sin perfil enriquecido ve el aviso en lugar de la tabla', async ({ page }) => {
    await quoteFor(page, '1000000004');

    await page.getByRole('tab', { name: 'Linaje de fuentes' }).click();

    const panel = page.getByRole('tabpanel', { name: 'Linaje de fuentes' });
    await expect(panel.getByText('todavía no tiene un perfil enriquecido')).toBeVisible();
    await expect(panel.getByRole('table')).toHaveCount(0);
  });

  test('a una persona sin cuenta no se le ofrece el linaje', async ({ page }) => {
    const controls = ui(page);
    await controls.documentNumber.fill('55667788');
    await controls.search.click();
    await controls.approve.click();
    await fillLifeInsurance(page);
    await controls.requestQuote.click();
    await expect(controls.stepHeading).toHaveText('Resultado');

    await expect(page.getByRole('tab')).toHaveCount(0);
  });
});
