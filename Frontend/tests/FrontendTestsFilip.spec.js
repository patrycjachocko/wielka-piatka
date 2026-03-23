import { test, expect } from '@playwright/test';

// helper do mockowania podstawowych API - uzywa sie go w kilku testach
async function setupBasicMocks(page) {
  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, nazwa: 'Informatyka' },
        { id: 2, nazwa: 'Automatyka i Robotyka' },
      ]),
    });
  });

  await page.route('**/api/studia/*/semestry', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([1, 2, 3, 4]),
    });
  });

  await page.route('**/api/studia/*/specjalnosci*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 11, nazwa: 'Programowanie' },
        { id: 12, nazwa: 'Sieci komputerowe' },
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
        { rodzaj: 'L', grupy: [1, 2] },
      ]),
    });
  });
}

// test 1 - sprawdzam czy eksport ics wysyla request do api
test('Eksport planu do ICS wysyla request do API', async ({ page }) => {
  await page.route('**/api/schedules', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            name: 'Moj plan zimowy',
            scheduleType: 'Student',
            createdAt: '2026-01-10T08:00:00Z',
          },
        ]),
      });
    }
  });

  await page.route('**/api/schedules/1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        name: 'Moj plan zimowy',
        scheduleType: 'Student',
        createdAt: '2026-01-10T08:00:00Z',
        overrides: {},
        updatedKeys: [],
        ignoredConflictIds: [],
        configuration: {
          idStudiow: 1,
          semestr: 1,
          idSpecjalnosci: 11,
          grupy: { W: 1, C: 1 },
          idJezyka: null,
        },
      }),
    });
  });

  await page.route('**/api/rozklad*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          idPrzedmiotu: 101,
          dzien: 1,
          godzina: 1,
          ilosc: 2,
          tydzien: 0,
          rodzaj: 'W',
          grupa: 1,
          przedmiot: 'Programowanie obiektowe',
          przedmiotSkrot: 'PO',
          nauczyciel: 'dr Jan Kowalski',
          nauczycielSkrot: 'dr J. Kowalski',
          sala: '201',
        },
      ]),
    });
  });

  // mockuje endpoint eksportu ics zeby sprawdzic czy request poszedl
  let exportRequestSent = false;
  await page.route('**/api/schedules/1/export', async (route) => {
    exportRequestSent = true;
    await route.fulfill({
      status: 200,
      contentType: 'text/calendar',
      headers: { 'content-disposition': 'attachment; filename="plan.ics"' },
      body: 'BEGIN:VCALENDAR\nEND:VCALENDAR',
    });
  });

  await page.goto('http://localhost:5173/moj-plan');
  await page.getByRole('button', { name: 'Otworz' }).click();
  await expect(page.locator('.timetable-table')).toBeVisible();

  // klikam eksportuj i sprawdzam czy request poszedl
  await page.getByRole('button', { name: /Eksportuj.*ics/i }).click();
  await page.waitForTimeout(500); // daje chwile na wykonanie requestu
  expect(exportRequestSent).toBe(true);
});

// test 2 - usuwanie planu z wlasnym przyciskiem potwierdzenia (nie window.confirm)
test('Usuwanie planu - klikamy Usun potem Potwierdz', async ({ page }) => {
  let schedules = [
    { id: 1, name: 'Plan do usuniecia', scheduleType: 'Student', createdAt: '2026-01-10T08:00:00Z' },
    { id: 2, name: 'Plan do zachowania', scheduleType: 'Student', createdAt: '2026-01-11T08:00:00Z' },
  ];

  await page.route('**/api/schedules', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(schedules),
      });
    }
  });

  await page.route('**/api/schedules/1', async (route) => {
    if (route.request().method() === 'DELETE') {
      schedules = schedules.filter((s) => s.id !== 1);
      await route.fulfill({ status: 204 });
    }
  });

  await page.goto('http://localhost:5173/moj-plan');

  await expect(page.getByText('Plan do usuniecia')).toBeVisible();
  await expect(page.getByText('Plan do zachowania')).toBeVisible();

  // najpierw klikam usun - pojawi sie przycisk potwierdz
  const firstCard = page.locator('.grid > div').first();
  await firstCard.getByRole('button', { name: 'Usun' }).click();

  // teraz klikam potwierdz (nie window.confirm tylko przycisk w ui)
  await firstCard.getByRole('button', { name: 'Potwierdz' }).click();

  // czekam az plan zniknie z listy
  await expect(page.getByText('Plan do usuniecia')).toHaveCount(0);
  await expect(page.getByText('Plan do zachowania')).toBeVisible();
});

// test 3 - pusta lista planow pokazuje komunikat
test('Brak zapisanych planow - komunikat o pustej liscie', async ({ page }) => {
  await page.route('**/api/schedules', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.goto('http://localhost:5173/moj-plan');

  // sprawdzam czy pokazuje sie komunikat o braku planow
  await expect(page.getByText(/Brak zapisanych plan/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Otworz' })).toHaveCount(0);
});

// test 4 - strona glowna ma 3 karty nawigacyjne w gridzie (nie w navbarze)
test('Strona glowna - 3 karty nawigacyjne z linkami', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  await expect(page.getByRole('heading', { name: 'Plan Zajec WI PB' })).toBeVisible();

  // szukam kart w gridzie (nie w navbarze) - uzywa selektora css
  const grid = page.locator('.grid.grid-cols-1');
  const cards = grid.locator('a');

  await expect(cards).toHaveCount(3);

  // sprawdzam czy linki prowadza gdzie trzeba
  await expect(cards.nth(0)).toHaveAttribute('href', '/plan-studenta');
  await expect(cards.nth(1)).toHaveAttribute('href', '/plan-nauczyciela');
  await expect(cards.nth(2)).toHaveAttribute('href', '/moj-plan');

  // sprawdzam tez tytuly kart
  await expect(grid.getByRole('heading', { name: 'Plan studenta' })).toBeVisible();
  await expect(grid.getByRole('heading', { name: 'Plan nauczyciela' })).toBeVisible();
  await expect(grid.getByRole('heading', { name: 'Moj plan' })).toBeVisible();
});

// test 5 - zajecia wielogodzinne maja rowspan wiekszy niz 1
test('Zajecia wielogodzinne - kafelek rozciaga sie na wiele slotow', async ({ page }) => {
  await setupBasicMocks(page);

  await page.route('**/api/rozklad*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          idPrzedmiotu: 101,
          dzien: 1,
          godzina: 1,
          ilosc: 3, // 3 godziny - powinno miec rowspan 3
          tydzien: 0,
          rodzaj: 'W',
          grupa: 1,
          przedmiot: 'Programowanie zaawansowane',
          przedmiotSkrot: 'PZ',
          nauczyciel: 'dr Jan Kowalski',
          nauczycielSkrot: 'dr J. Kowalski',
          sala: '201',
        },
      ]),
    });
  });

  await page.goto('http://localhost:5173/plan-studenta');

  await page.locator('select').first().selectOption('1');
  await page.locator('select').nth(1).selectOption('1');
  await page.locator('select').nth(2).selectOption('11');

  await expect(page.locator('.timetable-table')).toBeVisible();

  // sprawdzam czy td ma rowspan 3 (zajecia 3-godzinne)
  const cellWithEntry = page.locator('td:has(.border-l-4)').first();
  const rowspan = await cellWithEntry.getAttribute('rowspan');
  expect(Number(rowspan)).toBeGreaterThanOrEqual(3);
});

// test 6 - konsultacje nauczyciela wyswietlane jako Konsultacje
test('Konsultacje nauczyciela - wyswietlane w rozkładzie', async ({ page }) => {
  await page.route('**/api/nauczyciele', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, nazwa: 'dr hab. Jan Kowalski' }]),
    });
  });

  await page.route('**/api/rozklad/nauczyciel/1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 101,
          dzien: 1,
          godzina: 1,
          ilosc: 2,
          rodzaj: 'W',
          przedmiot: 'Algorytmy',
          przedmiotSkrot: 'ALG',
          sala: '201',
        },
        // konsultacje maja rodzaj 'Kon'
        {
          id: 501,
          dzien: 3,
          godzina: 5,
          ilosc: 2,
          rodzaj: 'Kon',
          opis: 'Pokoj 312',
        },
      ]),
    });
  });

  await page.goto('http://localhost:5173/plan-nauczyciela');
  await page.locator('select[size="8"]').selectOption('1');

  await expect(page.locator('.timetable-table')).toBeVisible();

  // szukam kafelkow z konsultacjami - moze byc ich wiele
  const konsultacjeKafelki = page.locator('.border-l-4').filter({ hasText: 'Konsultacje' });
  // sprawdzam ze jest co najmniej jeden kafelek konsultacji
  await expect(konsultacjeKafelki.first()).toBeVisible();
});

// test 7 - zajecia dwutygodniowe pokazuja etykiete "Tyg. parzyste" lub "Tyg. nieparzyste"
test('Zajecia co 2 tygodnie - etykieta Tyg parzyste/nieparzyste', async ({ page }) => {
  await setupBasicMocks(page);

  await page.route('**/api/rozklad*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          idPrzedmiotu: 101,
          dzien: 1,
          godzina: 1,
          ilosc: 1,
          tydzien: 1, // parzyste
          rodzaj: 'W',
          grupa: 1,
          przedmiot: 'Zajecia parzyste',
          przedmiotSkrot: 'ZP',
          nauczyciel: 'dr Jan Kowalski',
          nauczycielSkrot: 'dr J. Kowalski',
          sala: '201',
        },
        {
          id: 2,
          idPrzedmiotu: 102,
          dzien: 2,
          godzina: 1,
          ilosc: 1,
          tydzien: 2, // nieparzyste
          rodzaj: 'L',
          grupa: 1,
          przedmiot: 'Zajecia nieparzyste',
          przedmiotSkrot: 'ZN',
          nauczyciel: 'dr Anna Nowak',
          nauczycielSkrot: 'dr A. Nowak',
          sala: '305',
        },
      ]),
    });
  });

  await page.goto('http://localhost:5173/plan-studenta');

  await page.locator('select').first().selectOption('1');
  await page.locator('select').nth(1).selectOption('1');
  await page.locator('select').nth(2).selectOption('11');

  await expect(page.locator('.timetable-table')).toBeVisible();

  // sprawdzam czy sa etykiety tyg parzyste i nieparzyste
  const kafelekParzysty = page.locator('.border-l-4').filter({ hasText: 'ZP' });
  const kafelekNieparzysty = page.locator('.border-l-4').filter({ hasText: 'ZN' });

  await expect(kafelekParzysty).toBeVisible();
  await expect(kafelekNieparzysty).toBeVisible();

  // w kodzie jest "Tyg. parzyste" i "Tyg. nieparzyste" nie (P) i (N)
  await expect(kafelekParzysty).toContainText('Tyg. parzyste');
  await expect(kafelekNieparzysty).toContainText('Tyg. nieparzyste');
});

// test 8 - walidacja modalu zapisu blokuje pusta nazwe
test('Modal zapisu - blokuje zapis bez nazwy', async ({ page }) => {
  await setupBasicMocks(page);

  await page.route('**/api/rozklad*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          idPrzedmiotu: 101,
          dzien: 1,
          godzina: 1,
          ilosc: 1,
          tydzien: 0,
          rodzaj: 'W',
          grupa: 1,
          przedmiot: 'Algebra',
          przedmiotSkrot: 'ALG',
          nauczyciel: 'dr Jan Kowalski',
          nauczycielSkrot: 'dr J. Kowalski',
          sala: '101',
        },
      ]),
    });
  });

  await page.goto('http://localhost:5173/plan-studenta');

  await page.locator('select').first().selectOption('1');
  await page.locator('select').nth(1).selectOption('1');
  await page.locator('select').nth(2).selectOption('11');

  await expect(page.locator('.timetable-table')).toBeVisible();

  // otwieram modal zapisu
  await page.getByRole('button', { name: 'Zapisz plan' }).click();
  await expect(page.getByRole('heading', { name: 'Zapisz plan' })).toBeVisible();

  // probuje zapisac bez wpisania nazwy
  const modalOverlay = page.locator('.fixed.inset-0').last();
  await modalOverlay.getByRole('button', { name: 'Zapisz' }).click();

  // powinien pokazac sie blad walidacji
  await expect(page.getByText(/Nazwa planu jest wymagana/i)).toBeVisible();
  // modal nadal powinien byc otwarty
  await expect(page.getByRole('heading', { name: 'Zapisz plan' })).toBeVisible();
});

// test 9 - przycisk cofnij wszystkie zmiany przywraca stan
test('Cofnij wszystkie zmiany - przywraca stan planu', async ({ page }) => {
  await page.route('**/api/schedules', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            name: 'Plan testowy',
            scheduleType: 'Student',
            createdAt: '2026-01-15T10:30:00Z',
          },
        ]),
      });
    }
  });

  await page.route('**/api/schedules/1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        name: 'Plan testowy',
        scheduleType: 'Student',
        createdAt: '2026-01-15T10:30:00Z',
        overrides: {},
        updatedKeys: [],
        ignoredConflictIds: [],
        configuration: {
          idStudiow: 1,
          semestr: 1,
          idSpecjalnosci: 11,
          grupy: { W: 1 },
          idJezyka: null,
        },
      }),
    });
  });

  await page.route('**/api/rozklad*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          idPrzedmiotu: 101,
          dzien: 1,
          godzina: 1,
          ilosc: 1,
          tydzien: 0,
          rodzaj: 'W',
          grupa: 1,
          przedmiot: 'Algebra',
          przedmiotSkrot: 'ALG',
          nauczyciel: 'dr Jan Kowalski',
          nauczycielSkrot: 'dr J. Kowalski',
          sala: '101',
        },
      ]),
    });
  });

  await page.goto('http://localhost:5173/moj-plan');

  await page.getByRole('button', { name: 'Otworz' }).click();
  await expect(page.locator('.timetable-table')).toBeVisible();

  // klikam na kafelek zeby otworzyc menu edycji
  await page.locator('.border-l-4').first().click();

  // klikam ukryj zajecia
  await page.getByRole('button', { name: /Ukryj zaj/i }).click();

  // sprawdzam czy pojawil sie overlay UKRYTE
  await expect(page.getByText('UKRYTE')).toBeVisible();
  // i info o niezapisanych zmianach
  await expect(page.getByText(/Niezapisane zmiany/i)).toBeVisible();

  // klikam "Cofnij wszystkie zmiany" (tak sie nazywa przycisk w kodzie)
  await page.getByRole('button', { name: /Cofnij wszystkie zmiany/i }).click();

  // po cofnieciu nie powinno byc UKRYTE ani info o zmianach
  await expect(page.getByText('UKRYTE')).toHaveCount(0);
  await expect(page.getByText(/Niezapisane zmiany/i)).toHaveCount(0);
});

// test 10 - legenda kolorow jest widoczna pod siatka
test('Legenda rodzajow zajec - widoczna pod siatka', async ({ page }) => {
  await setupBasicMocks(page);

  await page.route('**/api/rozklad*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          idPrzedmiotu: 101,
          dzien: 1,
          godzina: 1,
          ilosc: 1,
          tydzien: 0,
          rodzaj: 'W',
          grupa: 1,
          przedmiot: 'Wyklad',
          przedmiotSkrot: 'WYK',
          nauczyciel: 'dr Jan Kowalski',
          nauczycielSkrot: 'dr J. Kowalski',
          sala: '201',
        },
      ]),
    });
  });

  await page.goto('http://localhost:5173/plan-studenta');

  await page.locator('select').first().selectOption('1');
  await page.locator('select').nth(1).selectOption('1');
  await page.locator('select').nth(2).selectOption('11');

  await expect(page.locator('.timetable-table')).toBeVisible();

  // sprawdzam czy jest legenda
  const legenda = page.getByText('Legenda:');
  await expect(legenda).toBeVisible();

  // legenda pokazuje tylko skroty (W, C, L itp) bez pelnych nazw
  // w kodzie TimetableGrid.vue jest petla po typeColors ktory ma klucze W, C, L, Ps, P, S, J, Cw, Kon, Inne
  await expect(page.locator('.flex-wrap').filter({ hasText: 'Legenda' })).toContainText('W');
  await expect(page.locator('.flex-wrap').filter({ hasText: 'Legenda' })).toContainText('C');
  await expect(page.locator('.flex-wrap').filter({ hasText: 'Legenda' })).toContainText('L');
});
