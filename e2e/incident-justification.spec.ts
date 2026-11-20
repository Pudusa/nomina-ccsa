import { test, expect } from '@playwright/test';

const ADMIN_USER = process.env.SEED_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin123';

test.describe('Incidents Justification E2E Flow', () => {
  test('login, justificar una incidencia y verificar que se guarda', async ({ page }) => {
    await page.goto('/');

    // 1. Login con credenciales de administrador de prueba.
    await page.getByPlaceholder('Usuario').fill(ADMIN_USER);
    await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Ingresar al Sistema' }).click();

    // 2. Esperar a que carguen los datos y navigate a Incidencias.
    await expect(page.getByRole('button', { name: /Incidencias/ })).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: /Incidencias/ }).click();

    // 3. Esperar a que haya al menos una incidencia (falla si no hay, en vez de pasar en silencio).
    const firstIncident = page.locator('button.w-48').first();
    await expect(firstIncident).toBeVisible({ timeout: 20000 });

    // 4. Abrir el modal, escribir la nota y guardar.
    await firstIncident.click();
    await expect(page.getByText('Justificar / Clasificar Incidencia')).toBeVisible();
    await page.locator('textarea').fill('Justificación automática desde test E2E Playwright');
    await page.getByRole('button', { name: 'Guardar Justificación' }).click();

    // 5. Verificar que el guardado surtió efecto (mensaje de éxito y modal cerrado).
    await expect(page.getByText('El cambio quedó realizado')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Justificar / Clasificar Incidencia')).toBeHidden();

    // 6. El resumen de incidencias debe reflejar la búsqueda (no quedar con el total global).
    await page.getByPlaceholder('Nombre o No.').fill('zzz-no-existe-999');
    await expect(page.locator('.metrics-grid').getByText('Total Incidencias').locator('..').locator('.metric-value')).toHaveText('0');
  });
});
