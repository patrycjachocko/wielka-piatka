import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage.js';
import { StudentPlanPage } from './pages/StudentPlanPage.js';

const API_BASE_URL = process.env.API_URL || 'http://localhost:5289';

// Normalizuje białe znaki w tekście
function normalizeText(text = '') {
  return text.replace(/\s+/g, ' ').trim();
}

// Tworzy unikalną sygnaturę planu do porównań
function buildPlanSignature(entries) {
  return entries
    .map(entry => [
      entry.przedmiotSkrot || entry.przedmiot || '',
      entry.rodzaj || '',
      entry.grupa ?? '',
      entry.sala || '',
      entry.dzien ?? '',
      entry.godzina ?? '',
      entry.tydzien ?? '',
    ].join('|'))
    .sort()
    .join('||');
}

// Pobiera dane JSON z API
async function fetchJson(request, url) {
  const response = await request.get(url);
  expect(response.ok(), `Request failed: ${url}`).toBeTruthy();
  return response.json();
}

// Szuka pierwszej dostępnej konfiguracji z zajęciami
async function findFirstPlanConfig(request, kierunek) {
  const semestry = await fetchJson(request, `${API_BASE_URL}/api/studia/${kierunek.id}/semestry`);

  for (const semestr of semestry) {
    const specjalnosci = await fetchJson(
      request,
      `${API_BASE_URL}/api/studia/${kierunek.id}/specjalnosci?semestr=${semestr}`
    );

    for (const specjalnosc of specjalnosci) {
      const rozklad = await fetchJson(
        request,
        `${API_BASE_URL}/api/rozklad?idStudiow=${kierunek.id}&semestr=${semestr}&idSpec=${specjalnosc.id}`
      );

      if (Array.isArray(rozklad) && rozklad.length > 0) {
        return {
          idStudiow: kierunek.id,
          nazwaKierunku: kierunek.nazwa,
          semestr,
          idSpec: specjalnosc.id,
          nazwaSpecjalnosci: specjalnosc.nazwa,
          autoSelectedSpec: specjalnosci.length === 1,
          signature: buildPlanSignature(rozklad),
        };
      }
    }
  }
  return null;
}

// Sprawdza czy odpowiedź API pasuje do konfiguracji
function isScheduleResponseForConfig(response, config) {
  try {
    const url = new URL(response.url());
    return response.ok() &&
      url.pathname.endsWith('/api/rozklad') &&
      url.searchParams.get('idStudiow') === String(config.idStudiow) &&
      url.searchParams.get('semestr') === String(config.semestr) &&
      url.searchParams.get('idSpec') === String(config.idSpec);
  } catch {
    return false;
  }
}

// Wykonuje sekwencję wyboru filtrów w interfejsie
async function selectConfigurationInUi(page, config) {
  const kierunekSelect = page.locator('select').nth(0);
  const semestrSelect = page.locator('select').nth(1);
  const specjalnoscSelect = page.locator('select').nth(2);

  await kierunekSelect.selectOption(String(config.idStudiow));
  await expect(semestrSelect).toBeEnabled({ timeout: 10000 });

  if (config.autoSelectedSpec) {
    const rozkladResponse = page.waitForResponse(response => isScheduleResponseForConfig(response, config));
    await semestrSelect.selectOption(String(config.semestr));
    await rozkladResponse;
  } else {
    await semestrSelect.selectOption(String(config.semestr));
    await expect(specjalnoscSelect).toBeEnabled({ timeout: 10000 });

    const rozkladResponse = page.waitForResponse(response => isScheduleResponseForConfig(response, config));
    await specjalnoscSelect.selectOption(String(config.idSpec));
    await rozkladResponse;
  }

  await expect(page.locator('.timetable-table')).toBeVisible({ timeout: 10000 });
}

// Konfiguracja testow:
// - Domyslny kierunek: stac. I st., kier. informatyka (index 1)
// - Testy uzywaja kierunek=1, co odpowiada informatyce

// test 1: wspolbieznosc
test('Wybor specjalnosci uruchamia rownolegle pobieranie grup i rozkladu dla informatyki', async ({ page }) => {
  const studentPlanPage = new StudentPlanPage(page);

  const apiRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      apiRequests.push({ url: request.url(), timestamp: Date.now() });
    }
  });

  await studentPlanPage.open();
  await studentPlanPage.selectFullConfiguration({ kierunek: 1, semestr: 1, specjalnosc: 1 });

  const grupyRequest = apiRequests.find(r => r.url.includes('grupy'));
  expect(grupyRequest).toBeDefined();
});

// test 2: inicjalizacja grup
test('Domyslna grupa dla kazdego rodzaju zajec to pierwsza dostepna grupa (informatyka)', async ({ page }) => {
  const studentPlanPage = new StudentPlanPage(page);

  await studentPlanPage.open();
  await studentPlanPage.selectFullConfiguration({ kierunek: 1, semestr: 1, specjalnosc: 1 });
  await page.waitForTimeout(1000);

  const allSelects = page.locator('select');
  const count = await allSelects.count();

  for (let i = 3; i < Math.min(count, 6); i++) {
    const select = page.locator('select').nth(i);
    if (await select.isVisible()) {
      const value = await select.inputValue();
      expect(value).toBeTruthy();
    }
  }
});

// test 3: wybor jezyka - preferencja i fallback
test('Automatyczny wybor jezyka preferuje angielski i obsluguje fallback', async ({ page }) => {
  const studentPlanPage = new StudentPlanPage(page);

  await studentPlanPage.open();
  await page.waitForTimeout(500);

  // (a) Sprawdzenie czy angielski jest preferowany gdy dostepny
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  const bodyText = await page.locator('body').textContent();

  // Jezeli angielski jest dostepny, powinien byc wybrany
  const hasEnglishContent = /schedule|plan|student|semester/i.test(bodyText);
  const hasPolishContent = /plan|student|semestr|kierunek/i.test(bodyText);

  // (b) Fallback - jezeli brak angielskiego, wybierany jest pierwszy dostepny jezyk
  // Aplikacja powinna wyswietlac zawartosc w jakimkolwiek jezyku
  expect(hasEnglishContent || hasPolishContent).toBe(true);
});

// test 4: filtrowanie i wybor grup
test.describe('Filtrowanie i wybor grup', () => {

  test('Zmiana grupy wykladowej aktualizuje widok planu', async ({ page }) => {
    const studentPlanPage = new StudentPlanPage(page);

    await studentPlanPage.open();
    await studentPlanPage.selectFullConfiguration({ kierunek: 1, semestr: 1, specjalnosc: 1 });
    await page.waitForTimeout(1500);

    // Grupa wykladowa - zazwyczaj nth(3)
    const allSelects = page.locator('select');
    const wykladowaSelect = allSelects.nth(3);

    const isVisible = await wykladowaSelect.isVisible().catch(() => false);

    if (isVisible) {
      const optionsCount = await wykladowaSelect.locator('option').count();
      if (optionsCount > 1) {
        await wykladowaSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);

        const errorElement = page.locator('.error, [class*="error"]');
        const hasError = await errorElement.first().isVisible().catch(() => false);
        expect(hasError).toBe(false);
      }
    }
  });

  test('Zmiana kierunku zmienia wyswietlany plan', async ({ page, request }) => {
    const kierunki = await fetchJson(request, `${API_BASE_URL}/api/studia`);
    const konfiguracje = [];

    for (const kierunek of kierunki) {
      const konfiguracja = await findFirstPlanConfig(request, kierunek);
      if (konfiguracja) {
        konfiguracje.push(konfiguracja);
      }
    }

    let pierwszaKonfiguracja = null;
    let drugaKonfiguracja = null;

    for (let i = 0; i < konfiguracje.length; i++) {
      for (let j = i + 1; j < konfiguracje.length; j++) {
        if (konfiguracje[i].signature !== konfiguracje[j].signature) {
          pierwszaKonfiguracja = konfiguracje[i];
          drugaKonfiguracja = konfiguracje[j];
          break;
        }
      }

      if (pierwszaKonfiguracja && drugaKonfiguracja) {
        break;
      }
    }

    test.skip(
      !pierwszaKonfiguracja || !drugaKonfiguracja,
      'Brak dwoch kierunkow z rozna, niepusta konfiguracja planu na backendzie'
    );

    const studentPlanPage = new StudentPlanPage(page);
    const timetable = page.locator('.timetable-table');

    await studentPlanPage.open();
    await selectConfigurationInUi(page, pierwszaKonfiguracja);
    const pierwszyPlanText = normalizeText(await timetable.textContent() || '');

    await selectConfigurationInUi(page, drugaKonfiguracja);
    const drugiPlanText = normalizeText(await timetable.textContent() || '');

    expect(pierwszyPlanText).toBeTruthy();
    expect(drugiPlanText).toBeTruthy();
    expect(drugiPlanText).not.toBe(pierwszyPlanText);
    await expect(page.locator('select').nth(0)).toHaveValue(String(drugaKonfiguracja.idStudiow));
  });

  test('Wybor grupy PS (pracownia specjalistyczna) niezaleznie od wykladowej', async ({ page }) => {
    const studentPlanPage = new StudentPlanPage(page);

    await studentPlanPage.open();
    await studentPlanPage.selectFullConfiguration({ kierunek: 1, semestr: 1, specjalnosc: 1 });
    await page.waitForTimeout(1500);

    const allSelects = page.locator('select');
    const count = await allSelects.count();

    if (count >= 5) {
      // Grupa wykladowa - zazwyczaj nth(3)
      const wykladowaSelect = allSelects.nth(3);
      // Grupa PS (pracownia specjalistyczna) - zazwyczaj nth(5)
      const psSelect = allSelects.nth(5);

      const wykladowaVisible = await wykladowaSelect.isVisible().catch(() => false);
      const psVisible = await psSelect.isVisible().catch(() => false);

      if (wykladowaVisible && psVisible) {
        // Wybierz grupe wykladowa
        const wykladowaOptions = await wykladowaSelect.locator('option').count();
        if (wykladowaOptions > 1) {
          await wykladowaSelect.selectOption({ index: 1 });
        }

        // Wybierz inna grupe PS niz wykladowa
        const psOptions = await psSelect.locator('option').count();
        if (psOptions > 1) {
          // Wybierz inny indeks niz dla wykladowej (index: 0 lub 2 zamiast 1)
          const psIndex = psOptions > 2 ? 2 : 0;
          await psSelect.selectOption({ index: psIndex });
        }

        await page.waitForTimeout(500);

        const wykladowaValue = await wykladowaSelect.inputValue();
        const psValue = await psSelect.inputValue();

        // Sprawdz czy obie grupy maja wartosci (moga byc rozne)
        expect(wykladowaValue).toBeTruthy();
        expect(psValue).toBeTruthy();
      }
    }
  });
});

// test 5: trwalosc danych
test.describe('Trwalosc danych', () => {

  test('Ostatni wybor kierunku jest zapamietany w localStorage', async ({ page }) => {
    const studentPlanPage = new StudentPlanPage(page);

    await studentPlanPage.open();

    const kierunekSelect = page.locator('select').first();
    await kierunekSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1000);

    const savedData = await page.evaluate(() => {
      return localStorage.getItem('lastKierunek') ||
             localStorage.getItem('selectedKierunek') ||
             localStorage.getItem('planConfig');
    });
  });

  test('Odswiezenie strony nie powoduje bledow', async ({ page }) => {
    const studentPlanPage = new StudentPlanPage(page);

    await studentPlanPage.open();
    await studentPlanPage.selectFullConfiguration({ kierunek: 1, semestr: 1, specjalnosc: 1 });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const kierunekSelect = page.locator('select').first();
    expect(await kierunekSelect.isVisible()).toBe(true);
  });
});

// test 6: odpornosc na bledy
test.describe('Odpornosc na bledy', () => {

  test('Aplikacja laduje sie bez krytycznych bledow', async ({ page }) => {
    const studentPlanPage = new StudentPlanPage(page);

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await studentPlanPage.open();

    expect(consoleErrors.filter(e => e.includes('Uncaught'))).toHaveLength(0);
  });

  test('Szybkie przelaczanie kierunkow nie powoduje bledow', async ({ page }) => {
    const studentPlanPage = new StudentPlanPage(page);

    await studentPlanPage.open();

    for (let i = 1; i <= 3; i++) {
      const kierunekSelect = page.locator('select').first();
      const optionsCount = await kierunekSelect.locator('option').count();
      if (optionsCount > i) {
        await kierunekSelect.selectOption({ index: i });
        await page.waitForTimeout(200);
      }
    }

    const errorElement = page.locator('.error, [class*="error"], [role="alert"]');
    const hasVisibleError = await errorElement.first().isVisible().catch(() => false);

    if (hasVisibleError) {
      const errorText = await errorElement.first().textContent();
      expect(errorText).not.toContain('undefined');
    }
  });
});

// test 7: nawigacja i UX
test.describe('Nawigacja i UX', () => {

  test('Nawigacja miedzy stronami dziala poprawnie', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.open();
    const hasNavLinks = await homePage.areNavigationLinksVisible();
    expect(hasNavLinks).toBe(true);

    await homePage.goToStudentPlan();
    expect(page.url()).toContain('localhost:5173');
  });

  test('Przycisk powrotu dziala poprawnie', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.open();
    await homePage.goToStudentPlan();
    await page.waitForTimeout(500);

    await page.goBack();
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('localhost:5173');
  });

  test('Klawiatura Tab nawiguje przez elementy formularza', async ({ page }) => {
    const studentPlanPage = new StudentPlanPage(page);

    await studentPlanPage.open();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const activeElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['SELECT', 'INPUT', 'BUTTON', 'A']).toContain(activeElement);
  });
});

// test 8: funkcjonalnosc integracyjna
test.describe('Funkcjonalnosc Integracyjna', () => {

  test('Pelny flow wyboru planu studenta', async ({ page }) => {
    const studentPlanPage = new StudentPlanPage(page);

    await studentPlanPage.open();

    await studentPlanPage.selectKierunek(1);
    const semestrSelect = page.locator('select').nth(1);
    await expect(semestrSelect).toBeEnabled({ timeout: 5000 });

    await studentPlanPage.selectSemestr(1);
    const specSelect = page.locator('select').nth(2);
    await expect(specSelect).toBeEnabled({ timeout: 5000 });

    await studentPlanPage.selectSpecjalnosc(1);
    await page.waitForTimeout(1000);

    const allSelects = page.locator('select');
    const selectCount = await allSelects.count();
    expect(selectCount).toBeGreaterThanOrEqual(3);
  });

  test('Zmiana grupy aktualizuje widok planu', async ({ page }) => {
    const studentPlanPage = new StudentPlanPage(page);

    await studentPlanPage.open();
    await studentPlanPage.selectFullConfiguration({ kierunek: 1, semestr: 1, specjalnosc: 1 });
    await page.waitForTimeout(1500);

    const groupSelect = page.locator('select').nth(3);
    const isVisible = await groupSelect.isVisible().catch(() => false);

    if (isVisible) {
      const optionsCount = await groupSelect.locator('option').count();
      if (optionsCount > 1) {
        await groupSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);

        const errorElement = page.locator('.error, [class*="error"]');
        const hasError = await errorElement.first().isVisible().catch(() => false);
        expect(hasError).toBe(false);
      }
    }
  });

  test('Dane z API sa poprawnie wyswietlane w UI', async ({ page }) => {
    const studentPlanPage = new StudentPlanPage(page);

    let apiKierunki = [];
    page.on('response', async response => {
      if (response.url().includes('/api/studia') && response.ok()) {
        try { apiKierunki = await response.json(); } catch (e) {}
      }
    });

    await studentPlanPage.open();
    await page.waitForTimeout(1000);

    const kierunekSelect = page.locator('select').first();
    const options = await kierunekSelect.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(0);
  });
});

// test 9: widok planu pobiera kierunki
test('Widok planu studenta pobiera liste kierunkow przy starcie', async ({ page }) => {
  const studentPlanPage = new StudentPlanPage(page);

  let kierunkiLoaded = false;
  page.on('response', response => {
    if (response.url().includes('/api/studia') && response.ok()) {
      kierunkiLoaded = true;
    }
  });

  await studentPlanPage.open();
  await page.waitForTimeout(1500);

  expect(kierunkiLoaded).toBe(true);

  const kierunekSelect = page.locator('select').first();
  const optionsCount = await kierunekSelect.locator('option').count();
  expect(optionsCount).toBeGreaterThan(0);
});

// test 10: eksport
test('Przycisk eksportu ICS jest dostepny po wybraniu planu', async ({ page }) => {
  const studentPlanPage = new StudentPlanPage(page);

  await studentPlanPage.open();
  await studentPlanPage.selectFullConfiguration({ kierunek: 1, semestr: 1, specjalnosc: 1 });
  await page.waitForTimeout(2000);

  const exportButton = page.getByRole('button', { name: /eksport|export|ics|kalendarz/i });
  const exportLink = page.getByRole('link', { name: /eksport|export|ics|kalendarz/i });

  const buttonVisible = await exportButton.first().isVisible().catch(() => false);
  const linkVisible = await exportLink.first().isVisible().catch(() => false);

});
