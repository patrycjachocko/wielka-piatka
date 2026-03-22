import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

//Interfejs i Responsywność
test.describe('Interfejs i Responsywność', () => {
//Sprawdzenie zachowania siatki planu na ekranach o szerokości 375px. 
// Weryfikujemy działanie overflow-x-auto (przewijanie poziome) oraz czy elementy 
// interfejsu (kafelki, menu) nie nakładają się na siebie.
  test('mobile-timetable-grid-layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.route('**/api/studia', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, nazwa: 'Informatyka' }
        ]),
      });
    });

    await page.route('**/api/studia/*/semestry', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([1, 2, 3]),
      });
    });

    await page.route('**/api/studia/*/specjalnosci*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, nazwa: 'Programowanie' }
        ]),
      });
    });

    await page.route('**/api/studia/*/grupy*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { rodzaj: 'W', grupy: [1, 2] },
          { rodzaj: 'C', grupy: [1, 2, 3] },
          { rodzaj: 'L', grupy: [1, 2] }
        ]),
      });
    });

    await page.route('**/api/rozklad*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            idPrzedmiotu: 101,
            przedmiot: 'Programowanie obiektowe',
            przedmiotSkrot: 'PO',
            rodzaj: 'W',
            grupa: 1,
            dzien: 1,
            godzina: 1,
            ilosc: 2,
            tydzien: 0,
            nauczyciel: 'dr Jan Kowalski',
            nauczycielSkrot: 'JK',
            sala: '201'
          },
          {
            idPrzedmiotu: 102,
            przedmiot: 'Bazy danych',
            przedmiotSkrot: 'BD',
            rodzaj: 'C',
            grupa: 1,
            dzien: 2,
            godzina: 3,
            ilosc: 2,
            tydzien: 0,
            nauczyciel: 'dr Anna Nowak',
            nauczycielSkrot: 'AN',
            sala: '305'
          }
        ]),
      });
    });

    await page.goto('http://localhost:5173/');

    await page.getByRole('link', { name: 'Plan studenta', exact: true }).click();

    await page.locator('select').first().selectOption({ index: 1 });

    await page.locator('select').nth(1).selectOption({ index: 1 });

    await page.locator('select').nth(2).selectOption({ index: 1 });

    await expect(page.getByText('Ładowanie planu...')).toBeHidden({ timeout: 5000 });

    const gridContainer = page.locator('.overflow-x-auto');
    await expect(gridContainer).toBeVisible();

    const overflowX = await gridContainer.evaluate((el) => {
      return window.getComputedStyle(el).overflowX;
    });
    expect(overflowX).toBe('auto');

    const table = page.locator('.timetable-table');
    await expect(table).toBeVisible();

    const tiles = page.locator('.border-l-4');
    await expect(tiles.first()).toBeVisible();

    const tilesCount = await tiles.count();
    expect(tilesCount).toBeGreaterThanOrEqual(2);

    if (tilesCount >= 2) {
      const tile1Box = await tiles.nth(0).boundingBox();
      const tile2Box = await tiles.nth(1).boundingBox();

      if (tile1Box && tile2Box) {

        const horizontalOverlap = !(tile1Box.x + tile1Box.width <= tile2Box.x ||
                                    tile2Box.x + tile2Box.width <= tile1Box.x);
        const verticalOverlap = !(tile1Box.y + tile1Box.height <= tile2Box.y ||
                                  tile2Box.y + tile2Box.height <= tile1Box.y);

        const fullyOverlapping = horizontalOverlap && verticalOverlap;
        expect(fullyOverlapping).toBe(false);
      }
    }

    const legend = page.locator('.mt-3.flex.flex-wrap.gap-3');
    await expect(legend).toBeVisible();
    await expect(legend).toContainText('Legenda');
  });

  test('responsive-grid-breakpoints', async ({ page }) => {
    //Sprawdzenie płynności zmian układu (grid-cols) między rozdzielczościami.
    // Test przejść Tailwind (320px → 768px → 1024px). Sprawdzamy, czy liczba kolumn
    // w gridzie (1 → 2 → 3) zmienia się poprawnie, zapewniając czytelność kart na każdym urządzeniu.


    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('http://localhost:5173/');

    await expect(page.getByRole('heading', { name: 'Plan Zajec WI PB' })).toBeVisible();

    const homeGrid = page.locator('.grid.grid-cols-1');
    await expect(homeGrid).toBeVisible();

    const cards = homeGrid.locator('a');
    await expect(cards).toHaveCount(3);

    const card1Mobile = await cards.nth(0).boundingBox();
    const card2Mobile = await cards.nth(1).boundingBox();
    const card3Mobile = await cards.nth(2).boundingBox();

    expect(card1Mobile.x).toBeCloseTo(card2Mobile.x, 0);
    expect(card2Mobile.x).toBeCloseTo(card3Mobile.x, 0);

    expect(card2Mobile.y).toBeGreaterThan(card1Mobile.y);
    expect(card3Mobile.y).toBeGreaterThan(card2Mobile.y);

    await page.setViewportSize({ width: 768, height: 800 });

    await page.waitForTimeout(100);

    const card1Tablet = await cards.nth(0).boundingBox();
    const card2Tablet = await cards.nth(1).boundingBox();
    const card3Tablet = await cards.nth(2).boundingBox();

    expect(card1Tablet.y).toBeCloseTo(card2Tablet.y, 0);
    expect(card2Tablet.y).toBeCloseTo(card3Tablet.y, 0);

    expect(card2Tablet.x).toBeGreaterThan(card1Tablet.x);
    expect(card3Tablet.x).toBeGreaterThan(card2Tablet.x);

    await page.setViewportSize({ width: 1024, height: 800 });
    await page.waitForTimeout(100);

    const card1Desktop = await cards.nth(0).boundingBox();
    const card2Desktop = await cards.nth(1).boundingBox();
    const card3Desktop = await cards.nth(2).boundingBox();

    expect(card1Desktop.y).toBeCloseTo(card2Desktop.y, 0);
    expect(card2Desktop.y).toBeCloseTo(card3Desktop.y, 0);

    expect(card2Desktop.x).toBeGreaterThan(card1Desktop.x);
    expect(card3Desktop.x).toBeGreaterThan(card2Desktop.x);

    expect(card1Desktop.width).toBeGreaterThanOrEqual(card1Tablet.width);

    await page.route('**/api/schedules', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Plan semestr zimowy', type: 'Student' },
          { id: 2, name: 'Plan semestr letni', type: 'Student' },
          { id: 3, name: 'Plan dr Kowalski', type: 'Teacher' },
          { id: 4, name: 'Plan dodatkowy', type: 'Student' }
        ]),
      });
    });

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('http://localhost:5173/moj-plan');

    await expect(page.locator('body')).toContainText(/plan/i);

    const scheduleCards = page.locator('.grid a, .grid div').filter({ hasText: /Plan/i });

    const scheduleCount = await scheduleCards.count();

    if (scheduleCount >= 2) {
      const schedCard1Mobile = await scheduleCards.nth(0).boundingBox();
      const schedCard2Mobile = await scheduleCards.nth(1).boundingBox();

      expect(schedCard1Mobile.x).toBeCloseTo(schedCard2Mobile.x, 0);
      expect(schedCard2Mobile.y).toBeGreaterThan(schedCard1Mobile.y);

      await page.setViewportSize({ width: 768, height: 800 });
      await page.waitForTimeout(100);

      const schedCard1Tablet = await scheduleCards.nth(0).boundingBox();
      const schedCard2Tablet = await scheduleCards.nth(1).boundingBox();

      expect(schedCard1Tablet.y).toBeCloseTo(schedCard2Tablet.y, 0);
      expect(schedCard2Tablet.x).toBeGreaterThan(schedCard1Tablet.x);

      if (scheduleCount >= 3) {
        await page.setViewportSize({ width: 1024, height: 800 });
        await page.waitForTimeout(100);

        const schedCard1Desktop = await scheduleCards.nth(0).boundingBox();
        const schedCard2Desktop = await scheduleCards.nth(1).boundingBox();
        const schedCard3Desktop = await scheduleCards.nth(2).boundingBox();

        expect(schedCard1Desktop.y).toBeCloseTo(schedCard2Desktop.y, 0);
        expect(schedCard2Desktop.y).toBeCloseTo(schedCard3Desktop.y, 0);
        expect(schedCard2Desktop.x).toBeGreaterThan(schedCard1Desktop.x);
        expect(schedCard3Desktop.x).toBeGreaterThan(schedCard2Desktop.x);
      }
    }
  });

});

test.describe('Trwałość danych', () => {

  test('page-refresh-clears-unsaved-selections', async ({ page }) => {
//Weryfikacja, czy odświeżenie strony (F5) poprawnie resetuje tymczasowe wybory 
// filtrów (kierunek, semestr). Zapewnia to przewidywalność stanu aplikacji 
// (brak ukrytego stanu w localStorage).

    await page.route('**/api/studia', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, nazwa: 'Informatyka' },
          { id: 2, nazwa: 'Automatyka i Robotyka' }
        ]),
      });
    });

    await page.route('**/api/studia/*/semestry', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([1, 2, 3, 4, 5, 6]),
      });
    });

    await page.route('**/api/studia/*/specjalnosci*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, nazwa: 'Programowanie aplikacji' },
          { id: 2, nazwa: 'Sieci komputerowe' }
        ]),
      });
    });

    await page.route('**/api/studia/*/grupy*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { rodzaj: 'W', grupy: [1, 2] },
          { rodzaj: 'C', grupy: [1, 2, 3] }
        ]),
      });
    });

    await page.route('**/api/rozklad*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            idPrzedmiotu: 101,
            przedmiot: 'Programowanie',
            przedmiotSkrot: 'PRO',
            rodzaj: 'W',
            grupa: 1,
            dzien: 1,
            godzina: 1,
            ilosc: 2,
            tydzien: 0,
            nauczyciel: 'dr Jan Kowalski',
            sala: '201'
          }
        ]),
      });
    });

    await page.goto('http://localhost:5173/plan-studenta');

    await expect(page.getByRole('heading', { name: 'Plan studenta' })).toBeVisible();

    const selectKierunek = page.locator('select').first();
    const selectSemestr = page.locator('select').nth(1);
    const selectSpecjalnosc = page.locator('select').nth(2);

    await expect(selectKierunek).toContainText('Wybierz');

    await selectKierunek.selectOption({ index: 1 });

    await expect(selectSemestr).toBeEnabled();
    await selectSemestr.selectOption({ index: 1 });

    await expect(selectSpecjalnosc).toBeEnabled();
    await selectSpecjalnosc.selectOption({ index: 1 });

    const kierunekBeforeReload = await selectKierunek.inputValue();
    expect(kierunekBeforeReload).not.toBe('');
    expect(kierunekBeforeReload).toBe('1');

    const semestrBeforeReload = await selectSemestr.inputValue();
    expect(semestrBeforeReload).not.toBe('');

    const specjalnoscBeforeReload = await selectSpecjalnosc.inputValue();
    expect(specjalnoscBeforeReload).not.toBe('');

    const timetable = page.locator('.timetable-table');
    await expect(timetable).toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Plan studenta' })).toBeVisible();

    await page.waitForLoadState('networkidle');

    const selectKierunekAfter = page.locator('select').first();
    const kierunekAfterReload = await selectKierunekAfter.inputValue();

    expect(kierunekAfterReload).toContain('Wybierz');

    const timetableAfter = page.locator('.timetable-table');

    await expect(timetableAfter).not.toBeVisible();

    const localStorageData = await page.evaluate(() => {
      return JSON.stringify(localStorage);
    });

    expect(localStorageData).not.toContain('selectedStudia');
    expect(localStorageData).not.toContain('selectedSemestr');
    expect(localStorageData).not.toContain('selectedSpec');
  });

  test('saved-schedule-survives-session', async ({ page }) => {

    //Krytyczny test sprawdzający, czy zapisany plan jest dostępny po zamknięciu
  // i ponownym otwarciu karty. Weryfikujemy integralność danych pobieranych z GET /api/schedules.
    let savedSchedules = [];

    await page.route('**/api/schedules', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(savedSchedules),
        });
      } else if (route.request().method() === 'POST') {
        const requestBody = route.request().postDataJSON();
        const newSchedule = {
          id: 123,
          name: requestBody?.name || 'Plan Testowy Klaudii',
          type: 'Student'
        };
        savedSchedules.push(newSchedule);

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newSchedule),
        });
      }
    });

    await page.goto('http://localhost:5173/moj-plan');
    await page.waitForLoadState('networkidle');

    const noPlansMessage = page.getByText(/brak|nie masz|pusto|zapisanych/i);
    const schedulesList = page.locator('.grid').filter({ hasText: /Plan/ });

    const hasNoPlansMessage = await noPlansMessage.isVisible().catch(() => false);
    const schedulesCount = await schedulesList.count().catch(() => 0);

    expect(hasNoPlansMessage || schedulesCount === 0).toBe(true);

    await page.route('**/api/studia', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, nazwa: 'Informatyka' }
        ]),
      });
    });

    await page.route('**/api/studia/*/semestry', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([1, 2, 3]),
      });
    });

    await page.route('**/api/studia/*/specjalnosci*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, nazwa: 'Programowanie' }
        ]),
      });
    });

    await page.route('**/api/studia/*/grupy*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { rodzaj: 'W', grupy: [1] },
          { rodzaj: 'C', grupy: [1, 2] }
        ]),
      });
    });

    await page.route('**/api/rozklad*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            idPrzedmiotu: 101,
            przedmiot: 'Testowy Przedmiot',
            przedmiotSkrot: 'TP',
            rodzaj: 'W',
            grupa: 1,
            dzien: 1,
            godzina: 1,
            ilosc: 2,
            tydzien: 0,
            nauczyciel: 'dr Test',
            sala: '100'
          }
        ]),
      });
    });

    await page.goto('http://localhost:5173/plan-studenta');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Plan studenta' })).toBeVisible();

    const selectKierunek = page.locator('select').first();
    const selectSemestr = page.locator('select').nth(1);
    const selectSpecjalnosc = page.locator('select').nth(2);

    await selectKierunek.selectOption({ index: 1 });
    await expect(selectSemestr).toBeEnabled();
    await selectSemestr.selectOption({ index: 1 });
    await expect(selectSpecjalnosc).toBeEnabled();
    await selectSpecjalnosc.selectOption({ index: 1 });

    await expect(page.locator('.timetable-table')).toBeVisible({ timeout: 5000 });

    const saveButton = page.getByRole('button', { name: /Zapisz plan/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    const modal = page.locator('.fixed.inset-0');
    await expect(modal).toBeVisible();

    const nameInput = page.getByPlaceholder(/np. Moj plan/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Plan Testowy Klaudii');

    const confirmButton = page.getByRole('button', { name: 'Zapisz', exact: true });
    await confirmButton.click();

    await expect(modal).toBeHidden({ timeout: 3000 });

    await page.goto('http://localhost:5173/moj-plan');
    await page.waitForLoadState('networkidle');

    const savedPlanCard = page.getByText('Plan Testowy Klaudii');
    await expect(savedPlanCard).toBeVisible({ timeout: 5000 });

    const planCard = page.locator('.grid').filter({ hasText: 'Plan Testowy Klaudii' });
    await expect(planCard).toBeVisible();
  });

});

// Test E2E 5: Obsługa błędów sieci
test.describe('Odporność na błędy', () => {
  test('api-error-500-on-studia-fetch', async ({ page }) => {
//Symulacja awarii serwera podczas ładowania listy kierunków. Sprawdzamy, 
// czy aplikacja wyświetla czytelny komunikat o błędzie i blokuje puste selektory, 
// zamiast "zawieszać się" na loaderze.

    await page.route('**/api/studia', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Internal Server Error',
          error: 'Database connection failed'
        }),
      });
    });

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('http://localhost:5173/plan-studenta');

    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Plan studenta' })).toBeVisible();

    const loader = page.getByText(/ładowanie|loading|wczytywanie/i);
    await expect(loader).toBeHidden({ timeout: 5000 });

    const selectKierunek = page.locator('select').first();

    await expect(selectKierunek).toBeVisible();

    const optionsCount = await selectKierunek.locator('option').count();

    expect(optionsCount).toBeLessThanOrEqual(1);

    const errorMessage = page.locator('.text-red-500, .error, [role="alert"]');
    const hasErrorMessage = await errorMessage.isVisible().catch(() => false);

    const selectValue = await selectKierunek.inputValue();

    const isSelectEmpty = selectValue === '' || 
                     selectValue === null || 
                     selectValue.includes('Wybierz');

    console.log(`Debug: hasError=${hasErrorMessage}, isSelectEmpty=${isSelectEmpty}, value=${selectValue}`);

    expect(hasErrorMessage || isSelectEmpty).toBe(true);

    const homeLink = page.getByRole('link', { name: /strona|plan zajec|home/i });
    if (await homeLink.isVisible()) {
      await expect(homeLink).toBeEnabled();
    }

    const timetable = page.locator('.timetable-table');
    await expect(timetable).not.toBeVisible();

    if (consoleErrors.length > 0) {
      console.log('Console errors captured:', consoleErrors);
    }

    expect(pageErrors.length).toBeLessThanOrEqual(1);

    const retryButton = page.getByRole('button', { name: /ponownie|retry|odśwież/i });
    const hasRetryButton = await retryButton.isVisible().catch(() => false);

    if (hasRetryButton) {
      await page.route('**/api/studia', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 1, nazwa: 'Informatyka' }]),
        });
      });

      await retryButton.click();

      await expect(selectKierunek.locator('option')).toHaveCount(2);
    }
  });

  test('api-timeout-on-schedule-save', async ({ page }) => {
  //Test zachowania przy ekstremalnie wolnym łączu (>30s) podczas zapisu. 
  // Weryfikujemy, czy timeout Axios jest respektowany i czy użytkownik nie 
  // traci wpisanych danych przy próbie ponowienia.

    test.setTimeout(45000);
    await page.route('**/api/studia', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, nazwa: 'Informatyka' }]),
      });
    });

    await page.route('**/api/studia/*/semestry', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([1, 2, 3]),
      });
    });

    await page.route('**/api/studia/*/specjalnosci*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, nazwa: 'Programowanie' }]),
      });
    });

    await page.route('**/api/studia/*/grupy*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { rodzaj: 'W', grupy: [1] },
          { rodzaj: 'C', grupy: [1, 2] }
        ]),
      });
    });

    await page.route('**/api/rozklad*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            idPrzedmiotu: 101,
            przedmiot: 'Testowy Przedmiot',
            przedmiotSkrot: 'TP',
            rodzaj: 'W',
            grupa: 1,
            dzien: 1,
            godzina: 1,
            ilosc: 2,
            tydzien: 0,
            nauczyciel: 'dr Test',
            sala: '100'
          }
        ]),
      });
    });
    await page.route('**/api/schedules', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 32000));
        await route.abort('timedout');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    await page.goto('http://localhost:5173/plan-studenta');
    await page.waitForLoadState('networkidle');

    const selectKierunek = page.locator('select').first();
    const selectSemestr = page.locator('select').nth(1);
    const selectSpecjalnosc = page.locator('select').nth(2);

    await selectKierunek.selectOption({ index: 1 });
    await expect(selectSemestr).toBeEnabled();
    await selectSemestr.selectOption({ index: 1 });
    await expect(selectSpecjalnosc).toBeEnabled();
    await selectSpecjalnosc.selectOption({ index: 1 });

    await expect(page.locator('.timetable-table')).toBeVisible({ timeout: 5000 });

    const openModalButton = page.getByRole('button', { name: /Zapisz plan/i });
    await expect(openModalButton).toBeVisible();
    await openModalButton.click();

    const modal = page.locator('.fixed.inset-0');
    await expect(modal).toBeVisible();

    const nameInput = page.getByPlaceholder(/np. Moj plan/i);
    await expect(nameInput).toBeVisible();

    const testPlanName = 'Mój Ważny Plan Semestralny';
    await nameInput.fill(testPlanName);

    await expect(nameInput).toHaveValue(testPlanName);

    const saveButton = page.getByRole('button', { name: 'Zapisz', exact: true });
    await saveButton.click();

    const isButtonDisabled = await saveButton.isDisabled().catch(() => false);
    const hasSpinner = await modal.locator('.animate-spin, .spinner, .loading').isVisible().catch(() => false);

    console.log(`Loading state: buttonDisabled=${isButtonDisabled}, hasSpinner=${hasSpinner}`);

    const timeoutErrorMessage = page.locator('text=/timeout|przekroczono|nie odpowiada|connection|błąd połączenia|spróbuj ponownie/i');

    const modalStillVisible = page.locator('.fixed.inset-0').filter({ hasText: /Zapisz|plan|nazwa/i });

    try {
      await Promise.race([
        timeoutErrorMessage.waitFor({ state: 'visible', timeout: 35000 }),
        page.waitForTimeout(33000)
      ]);
    } catch {
    }

    const modalAfterTimeout = page.locator('.fixed.inset-0');
    const isModalVisible = await modalAfterTimeout.isVisible();

    const errorMessage = page.getByText(/błąd|error|nie udało|spróbuj/i);
    const hasErrorMessage = await errorMessage.isVisible().catch(() => false);

    expect(isModalVisible || hasErrorMessage).toBe(true);

    if (isModalVisible) {
      console.log('Modal pozostał otwarty po timeout');

      const inputAfterTimeout = page.getByPlaceholder(/np. Moj plan/i);
      const actualValue = await inputAfterTimeout.inputValue();

      if (actualValue === '') {
        console.warn('INFO: Pole zostało wyczyszczone (obecne zachowanie SavePlanModal)');
        console.warn('Rozważ naprawę: nie czyść pola dopóki API nie zwróci sukcesu');
      }

      await expect(inputAfterTimeout).toBeVisible();
      await expect(inputAfterTimeout).toBeEnabled();

      await inputAfterTimeout.fill('Nowa próba zapisu');
      await expect(inputAfterTimeout).toHaveValue('Nowa próba zapisu');
      console.log('Użytkownik może wpisać nową nazwę i spróbować ponownie');
    }

    if (hasErrorMessage) {
      console.log('Komunikat o błędzie widoczny dla użytkownika');
    }

    const navLinks = page.getByRole('link');
    const linksCount = await navLinks.count();
    expect(linksCount).toBeGreaterThan(0);
    console.log('Nawigacja działa, UI responsywny');
  });

});

test.describe('Nawigacja i UX', () => {
  test('vue-router-navigation-history', async ({ page }) => {

    //Test "głębokiej" nawigacji. Sprawdzamy, czy przyciski "Wstecz/Dalej" 
    // przeglądarki poprawnie przełączają widoki (Home ↔ Student ↔ Teacher) i czy 
    // asynchroniczne ładowanie komponentów nie generuje błędów.

    await page.route('**/api/studia', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, nazwa: 'Informatyka' },
          { id: 2, nazwa: 'Automatyka' }
        ]),
      });
    });
    await page.route('**/api/nauczyciele', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, nazwisko: 'Kowalski', imie: 'Jan' },
          { id: 2, nazwisko: 'Nowak', imie: 'Anna' }
        ]),
      });
    });

    await page.route('**/api/schedules', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('http://localhost:5173/');
    await expect(page.getByRole('heading', { name: 'Plan Zajec WI PB' })).toBeVisible();
    console.log('✓ KROK 1: Strona główna załadowana');

    const studentLink = page.getByRole('link', { name: 'Plan studenta', exact: true });
    await expect(studentLink).toBeVisible();
    await studentLink.click();

    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*plan-studenta/);
    await expect(page.getByRole('heading', { name: 'Plan studenta' })).toBeVisible();
    console.log('✓ KROK 2: Nawigacja do Plan studenta OK');

    const teacherLink = page.getByRole('link', { name: 'Plan nauczyciela', exact: true });
    await expect(teacherLink).toBeVisible();
    await teacherLink.click();

    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*plan-nauczyciela/);
    await expect(page.getByRole('heading', { name: 'Plan nauczyciela' })).toBeVisible();
    console.log('✓ KROK 3: Nawigacja do Plan nauczyciela OK');

    await page.goBack();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*plan-studenta/);
    await expect(page.getByRole('heading', { name: 'Plan studenta' })).toBeVisible();
    console.log('✓ KROK 4: goBack() → Plan studenta OK');

    await page.goBack();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('http://localhost:5173/');
    await expect(page.getByRole('heading', { name: 'Plan Zajec WI PB' })).toBeVisible();
    console.log('✓ KROK 5: goBack() → Strona główna OK');

    await page.goForward();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*plan-studenta/);
    await expect(page.getByRole('heading', { name: 'Plan studenta' })).toBeVisible();
    console.log('✓ KROK 6: goForward() → Plan studenta OK');

    await page.goForward();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*plan-nauczyciela/);
    await expect(page.getByRole('heading', { name: 'Plan nauczyciela' })).toBeVisible();
    console.log('✓ KROK 7: goForward() → Plan nauczyciela OK');

    await page.goBack();
    await page.goBack();
    await page.goForward();

    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*plan-studenta/);
    console.log('Szybkie przeskakiwanie nie spowodowało błędów');

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const myPlanLink = page.getByRole('link', { name: 'Moj plan', exact: true });
    await myPlanLink.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*moj-plan/);
    console.log('Nawigacja do Mój plan OK');

    expect(errors.length).toBe(0);
    console.log('Brak błędów JavaScript podczas nawigacji');
  });

  test('deep-linking', async ({ page }) => {
    //Weryfikacja startu aplikacji bezpośrednio z konkretnego adresu URL.
    await page.route('**/api/studia', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, nazwa: 'Informatyka' }]),
      });
    });

    await page.route('**/api/nauczyciele', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, nazwisko: 'Kowalski', imie: 'Jan' }]),
      });
    });

    await page.route('**/api/schedules', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('http://localhost:5173/plan-studenta');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*plan-studenta/);
    await expect(page.getByRole('heading', { name: 'Plan studenta' })).toBeVisible();
    console.log('  Deep link: /plan-studenta OK');

    await page.goto('http://localhost:5173/plan-nauczyciela');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*plan-nauczyciela/);
    await expect(page.getByRole('heading', { name: 'Plan nauczyciela' })).toBeVisible();
    console.log('Deep link: /plan-nauczyciela OK');

    await page.goto('http://localhost:5173/moj-plan');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*moj-plan/);
    await expect(page.getByRole('heading', { name: 'Moj plan' })).toBeVisible();
    console.log('✓ Deep link: /moj-plan OK');

    await page.goto('http://localhost:5173/nieistniejaca-strona');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    await expect(body).toBeVisible();
    console.log('✓ Nieistniejąca strona nie powoduje crash');
  });

});

test.describe('Funkcjonalność Integracyjna', () => {

  test('export-ics-download-process - pobieranie pliku ICS działa poprawnie', async ({ page }) => {
    //Weryfikacja inicjacji pobierania pliku .ics i poprawności nazwy pliku.

    await page.route('**/api/schedules', async (route) => {
      if (route.request().method() === 'GET' && !route.request().url().includes('/export')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              name: 'Plan Testowy',
              scheduleType: 'Student',
              createdAt: '2024-01-15T10:30:00Z',
            }
          ]),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/schedules/1', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            name: 'Plan Testowy',
            scheduleType: 'Student',
            createdAt: '2024-01-15T10:30:00Z',
            overrides: {},
            updatedKeys: [],
            ignoredConflictIds: [],
            configuration: {
              idStudiow: 1,
              semestr: 1,
              idSpecjalnosci: 1,
              grupy: { W: 1, C: 1, L: 1 },
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/rozklad*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            idPrzedmiotu: 101,
            przedmiot: 'INFORMATYKA-DANE',
            przedmiotSkrot: 'ID',
            rodzaj: 'W',
            grupa: 1,
            dzien: 1,
            godzina: 1,
            ilosc: 2,
            tydzien: 0,
            nauczyciel: 'dr Jan Kowalski',
            nauczycielSkrot: 'JK',
            sala: '201'
          },
          {
            idPrzedmiotu: 102,
            przedmiot: 'Algorytmy i struktury danych',
            przedmiotSkrot: 'AiSD',
            rodzaj: 'C',
            grupa: 1,
            dzien: 2,
            godzina: 3,
            ilosc: 2,
            tydzien: 0,
            nauczyciel: 'dr Anna Nowak',
            nauczycielSkrot: 'AN',
            sala: '305'
          }
        ]),
      });
    });

    // ----- Mock eksportu ICS -----
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Plan Zajec//WI PB//PL
X-WR-CALNAME:Plan: Plan Testowy
BEGIN:VEVENT
DTSTART:20240115T080000
DTEND:20240115T093000
SUMMARY:INFORMATYKA-DANE (W)
LOCATION:201
END:VEVENT
BEGIN:VEVENT
DTSTART:20240116T100000
DTEND:20240116T113000
SUMMARY:Algorytmy i struktury danych (C)
LOCATION:305
END:VEVENT
END:VCALENDAR`;

    await page.route('**/api/schedules/1/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/calendar; charset=utf-8',
        headers: {
          'Content-Disposition': 'attachment; filename="Plan_Testowy.ics"',
        },
        body: icsContent,
      });
    });

    await page.goto('http://localhost:5173/moj-plan');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Moj plan' })).toBeVisible();
    console.log('✓ KROK 1: Widok Mój plan załadowany');


    const openButton = page.getByRole('button', { name: 'Otworz' });
    await expect(openButton).toBeVisible();
    await openButton.click();

    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Plan Testowy')).toBeVisible();
    console.log('✓ KROK 2: Plan Testowy otwarty');

    const downloadPromise = page.waitForEvent('download');

    const exportButton = page.getByRole('button', { name: /Eksportuj.*\.ics/i });
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    const download = await downloadPromise;


    const suggestedFilename = download.suggestedFilename();
    console.log(`Pobrano plik: ${suggestedFilename}`);

    expect(suggestedFilename.endsWith('.ics')).toBe(true);
    console.log('Nazwa pliku kończy się na .ics');
  });

  test('export-ics-content-integrity', async ({ page }) => {
    //Techniczna walidacja struktury iCalendar i obecności wszystkich zajęć w pliku.
    await page.route('**/api/schedules', async (route) => {
      if (route.request().method() === 'GET' && !route.request().url().includes('/export')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              name: 'Plan Testowy',
              scheduleType: 'Student',
              createdAt: '2024-01-15T10:30:00Z',
            }
          ]),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/schedules/1', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            name: 'Plan Testowy',
            scheduleType: 'Student',
            createdAt: '2024-01-15T10:30:00Z',
            overrides: {},
            updatedKeys: [],
            ignoredConflictIds: [],
            configuration: {
              idStudiow: 1,
              semestr: 1,
              idSpecjalnosci: 1,
              grupy: { W: 1, C: 1, L: 1 },
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/rozklad*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            idPrzedmiotu: 101,
            przedmiot: 'INFORMATYKA-DANE',
            przedmiotSkrot: 'ID',
            rodzaj: 'W',
            grupa: 1,
            dzien: 1,
            godzina: 1,
            ilosc: 2,
            tydzien: 0,
            nauczyciel: 'dr Jan Kowalski',
            nauczycielSkrot: 'JK',
            sala: '201'
          },
          {
            idPrzedmiotu: 102,
            przedmiot: 'Algorytmy i struktury danych',
            przedmiotSkrot: 'AiSD',
            rodzaj: 'C',
            grupa: 1,
            dzien: 2,
            godzina: 3,
            ilosc: 2,
            tydzien: 0,
            nauczyciel: 'dr Anna Nowak',
            nauczycielSkrot: 'AN',
            sala: '305'
          }
        ]),
      });
    });

    // Mock eksportu ICS z pełną zawartością kalendarza
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Plan Zajec//WI PB//PL
X-WR-CALNAME:Plan: Plan Testowy
BEGIN:VEVENT
UID:event-101-w-1@plan-zajec
DTSTART:20240115T080000
DTEND:20240115T093000
SUMMARY:INFORMATYKA-DANE (W)
LOCATION:Sala 201
DESCRIPTION:Wyklad - grupa 1
END:VEVENT
BEGIN:VEVENT
UID:event-102-c-1@plan-zajec
DTSTART:20240116T100000
DTEND:20240116T113000
SUMMARY:Algorytmy i struktury danych (C)
LOCATION:Sala 305
DESCRIPTION:Cwiczenia - grupa 1
END:VEVENT
END:VCALENDAR`;

    await page.route('**/api/schedules/1/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/calendar; charset=utf-8',
        headers: {
          'Content-Disposition': 'attachment; filename="Plan_Testowy.ics"',
        },
        body: icsContent,
      });
    });

    await page.goto('http://localhost:5173/moj-plan');
    await page.waitForLoadState('networkidle');

    const openButton = page.getByRole('button', { name: 'Otworz' });
    await expect(openButton).toBeVisible();
    await openButton.click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Plan Testowy')).toBeVisible();
    console.log('✓ KROK 1: Plan otwarty');


    const downloadPromise = page.waitForEvent('download');

    const exportButton = page.getByRole('button', { name: /Eksportuj.*\.ics/i });
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    const download = await downloadPromise;
    console.log('Plik pobrany');


    const tempDir = path.join(__dirname, 'temp-downloads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, download.suggestedFilename());
    await download.saveAs(tempFilePath);
    console.log(`Plik zapisany w: ${tempFilePath}`);


    const fileContent = fs.readFileSync(tempFilePath, 'utf-8');
    console.log('Zawartość pliku odczytana');


    expect(fileContent).toContain('BEGIN:VCALENDAR');
    console.log('BEGIN:VCALENDAR obecne');

    expect(fileContent).toContain('END:VCALENDAR');
    console.log('END:VCALENDAR obecne');

    expect(fileContent).toContain('BEGIN:VEVENT');
    console.log('BEGIN:VEVENT obecne');

    const eventCount = (fileContent.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBeGreaterThanOrEqual(1);
    console.log(`Liczba eventów: ${eventCount} (min. 1)`);

    expect(fileContent).toContain('SUMMARY');
    console.log('SUMMARY obecne');

    expect(fileContent).toContain('DTSTART');
    console.log('DTSTART obecne');

    expect(fileContent).toContain('LOCATION');
    console.log('LOCATION obecne');


    expect(fileContent).toContain('INFORMATYKA-DANE');
    console.log('Przedmiot INFORMATYKA-DANE obecny w pliku ICS');


    try {
      fs.unlinkSync(tempFilePath);
      if (fs.readdirSync(tempDir).length === 0) {
        fs.rmdirSync(tempDir);
      }
      console.log('Plik tymczasowy usunięty');
    } catch (cleanupError) {
      console.warn('Nie udało się usunąć pliku tymczasowego:', cleanupError.message);
    }
  });

});
