import AxeBuilder from '@axe-core/playwright';
import { Page, expect } from '@playwright/test';

/**
 * Controles del recorrido por su nombre accesible, en español o inglés (el proyecto `en-US` corre
 * el mismo recorrido contra el build en inglés).
 */
export const ui = (page: Page) => ({
  documentNumber: page.getByLabel(/^(Número de documento|Document number)$/),
  search: page.getByRole('button', { name: /^(Buscar cliente|Find client)$/ }),
  approve: page.getByRole('button', {
    name: /^(Aprobar y continuar|Continuar sin cuenta|Approve and continue|Continue without an account)$/,
  }),
  searchAnother: page.getByRole('button', { name: /^(Buscar otro cliente|Find another client)$/ }),
  product: page.getByLabel(/^(Producto|Product)$/),
  age: page.getByLabel(/^(Edad|Age)$/),
  insuredSum: page.getByLabel(/^(Suma asegurada|Sum insured)$/),
  requestQuote: page.getByRole('button', { name: /^(Solicitar cotización|Request quote)$/ }),
  newQuote: page.getByRole('button', { name: /^(Nueva cotización|New quote)$/ }),
  stepHeading: page.getByRole('heading', { level: 2 }),
});

/** Abre la pantalla y completa los datos del seguro de vida con valores válidos. */
export async function fillLifeInsurance(page: Page, age = '35', sum = '50000000'): Promise<void> {
  const controls = ui(page);
  await controls.age.fill(age);
  await controls.insuredSum.fill(sum);
}

/** Del documento al formulario del seguro, con un cliente que existe. */
export async function goToInsuranceStep(page: Page, document: string): Promise<void> {
  const controls = ui(page);
  await controls.documentNumber.fill(document);
  await controls.search.click();
  await expect(controls.stepHeading).toHaveText(/^(Perfil del cliente|Client profile)$/);
  await controls.approve.click();
  await expect(controls.stepHeading).toHaveText(/^(Datos del seguro|Insurance details)$/);
}

/** Falla si la pantalla tiene violaciones críticas o serias de WCAG 2.1 AA. */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodo(s))`),
    'violaciones críticas o serias de accesibilidad',
  ).toEqual([]);
}
