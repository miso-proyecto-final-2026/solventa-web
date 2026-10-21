import { Page, expect, test as base } from '@playwright/test';
import { Backend } from './backend';

/** Deja una sesión de asesor vigente antes de cargar la app (atajo para no pasar por el login). */
export async function signIn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Solo en la primera carga: si la sesión vence durante la prueba, no se vuelve a crear.
    if (sessionStorage.getItem('e2e.seeded')) return;
    sessionStorage.setItem('e2e.seeded', '1');
    sessionStorage.setItem(
      'solventa.session',
      JSON.stringify({
        token: 'e2e-token',
        user: { id: 'a-1', name: 'Asesora Demo', role: 'ASESOR' },
        expiresAt: Date.now() + 30 * 60 * 1000,
      }),
    );
  });
}

/**
 * `backend` se instala solo en todas las pruebas (`auto`) para que ninguna llegue al proxy real y,
 * al terminar, verifica que no hubo llamadas sin simular.
 */
export const test = base.extend<{ backend: Backend }>({
  backend: [
    async ({ page }, use) => {
      const backend = new Backend(page);
      await backend.install();
      await use(backend);
      expect(backend.unhandled, 'llamadas al API que la prueba no simuló').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
