import { expectNoSeriousA11yViolations, fillLifeInsurance, ui } from './support/journey';
import { expect, signIn, test } from './support/test';

// Este archivo corre solo en el proyecto `en-US` (build en inglés, puerto 4201).
test('el recorrido en inglés usa los textos y los formatos de en-US', async ({ page, backend }) => {
  await signIn(page);
  await page.goto('/assisted-quote');
  const controls = ui(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Assisted quote');
  await expect(controls.stepHeading).toHaveText('Find the client');

  await controls.documentNumber.fill('1000000001');
  await controls.search.click();
  await expect(controls.stepHeading).toHaveText('Client profile');
  await expect(page.getByText('Valid consent')).toBeVisible();
  await expect(
    page.getByText("The price is calculated with the client's real profile."),
  ).toBeVisible();
  await expect(page.getByRole('row', { name: /Debt level\s+Low/ })).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await controls.approve.click();
  await expect(controls.stepHeading).toHaveText('Insurance details');
  await expect(page.getByText('Allowed range: 18 – 65')).toBeVisible();
  await fillLifeInsurance(page);
  await controls.requestQuote.click();

  // Montos y fecha con las convenciones de en-US.
  await expect(controls.stepHeading).toHaveText('Result');
  await expect(page.getByText('$13,162').first()).toBeVisible();
  await expect(page.getByText(/Annual premium:\s*\$157,938/)).toBeVisible();
  await expect(page.getByRole('row', { name: /Death\s+\$50,000,000\s+\$0/ })).toBeVisible();
  await expect(page.getByText(/Valid until:\s*November 19, 2026/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How the price was calculated' })).toBeVisible();
  await expect(
    page.getByRole('row', { name: /Adjustment for the risk profile\s+-\$17,062/ }),
  ).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  expect(backend.quoteRequests).toHaveLength(1);
});

test('los errores de validación también salen en inglés', async ({ page }) => {
  await signIn(page);
  await page.goto('/assisted-quote');

  await ui(page).search.click();

  await expect(page.getByText('Enter the document number.')).toBeVisible();
});

test('los cobros fallidos (HU-19) se ven en inglés, con montos de en-US', async ({ page }) => {
  await signIn(page, 'OPERADOR');
  await page.goto('/failed-payments');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Failed payments');
  await expect(page.getByRole('row').nth(1)).toContainText('Due in less than 24 h');
  await expect(page.getByRole('row').nth(1)).toContainText('$55,500');
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();

  await page
    .getByRole('link', { name: /View details/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Payment history' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry payment' })).toBeEnabled();
  await expectNoSeriousA11yViolations(page);
});

test('la venta asistida (HU-39) usa los textos y los formatos de en-US', async ({ page }) => {
  await signIn(page);
  await page.goto('/subscriptions');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Subscriptions');
  await expect(page.getByRole('row').nth(1)).toContainText('Charge completed');
  await page.getByRole('link', { name: /Manage signature/ }).click();

  await expect(page.getByText('$40,000,000')).toBeVisible();
  await page.getByRole('button', { name: 'Manage signature' }).click();
  await expect(page.getByRole('button', { name: 'Send by email' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Open the document' })).toBeEnabled();
  await expectNoSeriousA11yViolations(page);

  await page.goto('/subscriptions/new/cot-e2e-1');
  await expect(page.getByLabel('Card number')).toBeVisible();
  await expect(page.getByLabel('The client is aware of this transaction')).not.toBeChecked();
  await expectNoSeriousA11yViolations(page);
});
