import { expectNoSeriousA11yViolations } from './support/journey';
import { expect, signIn, test } from './support/test';

test.describe('Menú de navegación (HU40)', () => {
  test('el asesor ve seis opciones y las pestañas de Cotizaciones y Cobros enlazan a las rutas de siempre', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/assisted-quote');

    const nav = page.getByRole('navigation', { name: 'Navegación principal' });
    await expect(nav.getByRole('link')).toHaveText([
      'Inicio',
      'Cotizaciones',
      'Consentimientos',
      'Pólizas',
      'Cobros',
      'Siniestros',
    ]);
    await expect(nav.getByRole('link', { name: 'Cotizaciones' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    const tabs = page.getByRole('navigation', { name: 'Secciones de Cotizaciones' });
    await expect(tabs.getByRole('link')).toHaveText([
      'Cotizar',
      'Cotización asistida',
      'Revisión asistida',
    ]);
    await tabs.getByRole('link', { name: 'Revisión asistida' }).click();
    await expect(page).toHaveURL(/\/assisted-review$/);
    await expect(nav.getByRole('link', { name: 'Cotizaciones' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await nav.getByRole('link', { name: 'Cobros' }).click();
    await expect(page).toHaveURL(/\/failed-payments$/);
    await expect(
      page
        .getByRole('navigation', { name: 'Secciones de Cobros' })
        .getByRole('link', { name: 'Suscripciones' }),
    ).toBeVisible();
  });

  test('el menú de cuenta se maneja con teclado: abre, recorre, cierra con Esc y devuelve el foco', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/');

    const account = page.locator('button[aria-haspopup="menu"]');
    await expect(account).toHaveAttribute('aria-expanded', 'false');
    await account.focus();
    await page.keyboard.press('Enter');

    await expect(account).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Perfil' })).toBeFocused();
    // Desde la primera opción, la flecha arriba da la vuelta a la última (con o sin la opción de idioma).
    await page.keyboard.press('ArrowUp');
    await expect(menu.getByRole('menuitem', { name: 'Cerrar sesión' })).toBeFocused();
    await expectNoSeriousA11yViolations(page);

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(account).toBeFocused();
  });

  test('cerrar sesión desde el menú de cuenta lleva al inicio', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    await page.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();

    await expect(page.getByRole('link', { name: 'Ingresar' })).toBeVisible();
    await expect(page.locator('button[aria-haspopup="menu"]')).toHaveCount(0);
  });

  test('en pantallas angostas el menú no desborda horizontalmente', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await signIn(page);
    await page.goto('/');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});

test.describe('Pantallas que todavía no existen (HU40)', () => {
  for (const [path, name] of [
    ['/quote', 'Cotizar'],
    ['/policies', 'Pólizas'],
    ['/claims', 'Siniestros'],
    ['/profile', 'Perfil'],
  ]) {
    test(`${path} explica que aún no está disponible y vuelve al inicio`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
      await expect(page.getByText('todavía no está disponible')).toBeVisible();
      await expectNoSeriousA11yViolations(page);

      await page.getByRole('link', { name: 'Volver al inicio' }).click();
      await expect(page).toHaveURL(/\/$/);
    });
  }
});
