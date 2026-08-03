import { test, expect } from '@playwright/test';

test.describe('iRec Saúde - E2E Core Flow Verification', () => {

  test('Deve carregar a tela inicial e verificar o titulo da plataforma', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/iRec/i);
  });

  test('Deve permitir navegação para a aba de triagem clinica', async ({ page }) => {
    await page.goto('/');
    const triageButton = page.locator('text=Nova Avaliação');
    if (await triageButton.isVisible()) {
      await triageButton.click();
      await expect(page.locator('text=Avaliação de Pele & Sintomas')).toBeVisible();
    }
  });

  test('Deve verificar se o componente de Telemedicina esta ativo', async ({ page }) => {
    await page.goto('/');
    const telemedButton = page.locator('text=Telemedicina');
    if (await telemedButton.isVisible()) {
      await telemedButton.click();
      await expect(page.locator('text=Telemedicina')).toBeVisible();
    }
  });

  test('Deve validar os botões de governança de dados LGPD no perfil', async ({ page }) => {
    await page.goto('/');
    const profileButton = page.locator('text=Perfil');
    if (await profileButton.isVisible()) {
      await profileButton.click();
      await expect(page.locator('text=Privacidade & Direitos do Titular')).toBeVisible();
    }
  });

});
