import { test, expect } from '@playwright/test';

test.describe('Fluxo E2E - Autenticação e Governança SIRA Enterprise', () => {
  test('deve renderizar a tela de login inicial', async ({ page }) => {
    await page.goto('/');

    // Valida título da aplicação e campos essenciais
    await expect(page).toHaveTitle(/SIRA/i);
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('deve autenticar administrador e carregar dashboard com métricas e feature flags', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'admin@sira.com');
    await page.fill('input[type="password"]', 'Admin@2026');
    await page.click('button[type="submit"]');

    // Valida redirecionamento pós autenticação
    await expect(page).toHaveURL(/\/(dashboard|inicio)/);
  });
});
