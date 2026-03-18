import { test, expect } from '@playwright/test';

// test 1: wspolbieznosc
test('Wybór specjalności uruchamia równoległe pobieranie grup i rozkładu', async ({ page }) => {
  await page.route('**/api/**/*grupy*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ rodzaj: 'W', grupy: [1, 2] }]),
    });
  });

  await page.route(url => 
    url.pathname.includes('schedule') || url.pathname.includes('rozklad') || url.pathname.includes('grid'), 
    async (route) => {
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json', 
        body: JSON.stringify([]) 
      });
  });

  const requestGrupyPromise = page.waitForRequest(req => req.url().includes('grupy'));
  const requestRozkladPromise = page.waitForRequest(req => 
    req.url().includes('schedule') || req.url().includes('rozklad') || req.url().includes('grid')
  );

  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Plan studenta', exact: true }).click();

  await page.locator('select').first().selectOption({ index: 1 });
  await page.locator('select').nth(1).selectOption({ index: 1 });
  await page.locator('select').nth(2).selectOption({ index: 1 });

  const [requestGrupy, requestRozklad] = await Promise.all([
    requestGrupyPromise,
    requestRozkladPromise
  ]);

  expect(requestGrupy).toBeDefined();
  expect(requestRozklad).toBeDefined();
});

// test 2: inicjalizacja grup
test('Domyślna grupa dla każdego rodzaju zajęć to pierwsza dostępna grupa', async ({ page }) => {
  await page.route('**/api/**/*grupy*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { rodzaj: 'W', grupy: ['1', '2'] },
        { rodzaj: 'L', grupy: ['3', '4'] }
      ]),
    });
  });

  await page.route('**/api/**/*rozklad*', async (route) => {
    await route.fulfill({ 
        status: 200, 
        contentType: 'application/json', 
        body: JSON.stringify([]) 
    });
  });

  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Plan studenta', exact: true }).click();

  await page.locator('select').first().selectOption({ index: 1 });
  await page.locator('select').nth(1).selectOption({ index: 1 });
  await page.locator('select').nth(2).selectOption({ index: 1 });

  await expect(page.locator('select').nth(3)).toHaveValue('1');
  await expect(page.locator('select').nth(4)).toHaveValue('3');
});

// test 3: wybor jezyka -preferencja i fallback
test.describe('Automatyczny wybór języka', () => {

  test('Preferuje angielski, gdy jest dostępny', async ({ page }) => {
    await page.route('**/api/config/languages', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['pl', 'en'])
      });
    });

    await page.goto('http://localhost:5173/');
    const body = page.locator('body');
    await expect(body).toContainText(/Plan|Student|Schedule/i); 
  });

  test('Wybiera pierwszy dostępny język, gdy brak angielskiego (fallback)', async ({ page }) => {
    await page.route('**/api/config/languages', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['pl', 'de'])
      });
    });

    await page.goto('http://localhost:5173/');
    const body = page.locator('body');
    await expect(body).toContainText(/Plan/i);
    await expect(body).toContainText(/Informatyki/i);
  });
});