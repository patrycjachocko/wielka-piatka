import { test, expect } from '@playwright/test'

// test1
test('Widok planu studenta pobiera liste kierunkow przy starcie', async ({ page }) => {
  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, nazwa: 'Informatyka' },
        { id: 2, nazwa: 'Matematyka' },
      ]),
    })
  })

  const studiaRequest = page.waitForRequest('**/api/studia')

  await page.goto('http://localhost:5173/plan-studenta')

  await expect(page.getByRole('heading', { name: 'Plan studenta' })).toBeVisible()
  await studiaRequest
})

// test2
test('Zmiana kierunku resetuje nizsze filtry i plan', async ({ page }) => {
  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, nazwa: 'Informatyka' },
        { id: 2, nazwa: 'Matematyka' },
      ]),
    })
  })

  await page.route('**/api/studia/*/semestry', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([1]),
    })
  })

  await page.route('**/api/studia/*/specjalnosci*', async (route) => {
    const url = new URL(route.request().url())
    const match = url.pathname.match(/\/studia\/(\d+)\/specjalnosci/)
    const idStudiow = match ? Number(match[1]) : 0

    const body = idStudiow === 1
      ? [
          { id: 11, nazwa: 'Programowanie' },
          { id: 12, nazwa: 'Sieci' },
        ]
      : [
          { id: 21, nazwa: 'Analiza danych' },
        ]

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })

  await page.route('**/api/studia/*/grupy*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { rodzaj: 'W', grupy: [1, 2] },
      ]),
    })
  })

  await page.route('**/api/rozklad*', async (route) => {
    const url = new URL(route.request().url())
    const idSpec = Number(url.searchParams.get('idSpec'))

    const body = idSpec === 11
      ? [
          {
            id: 1,
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
        ]
      : []

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })

  await page.goto('http://localhost:5173/plan-studenta')

  const kierunekSelect = page.locator('select').first()
  const semestrSelect = page.locator('select').nth(1)
  const specSelect = page.locator('select').nth(2)

  await kierunekSelect.selectOption('1')
  await semestrSelect.selectOption('1')
  await specSelect.selectOption('11')

  await expect(page.locator('.timetable-table')).toBeVisible()
  await expect(page.getByText('ALG')).toBeVisible()
  await expect(page.locator('select')).toHaveCount(4)

  await kierunekSelect.selectOption('2')

  await expect(semestrSelect.locator('option:checked')).toHaveText(/Wybierz semestr/i)
  await expect(specSelect.locator('option:checked')).toHaveText(/Wybierz specjalno/i)
  await expect(specSelect).toBeDisabled()

  await expect(page.locator('.timetable-table')).toHaveCount(0)
  await expect(page.locator('select')).toHaveCount(3)
  await expect(page.getByText(/Wybierz kierunek, semestr/i)).toBeVisible()
})

// test3
test('Przy jednej specjalnosci jest ona wybierana automatycznie', async ({ page }) => {
  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, nazwa: 'Informatyka' }]),
    })
  })

  await page.route('**/api/studia/*/semestry', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([1]),
    })
  })

  await page.route('**/api/studia/*/specjalnosci*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 501, nazwa: 'Programowanie' }]),
    })
  })

  await page.route('**/api/studia/*/grupy*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { rodzaj: 'W', grupy: [1] },
      ]),
    })
  })

  await page.route('**/api/rozklad*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 10,
          dzien: 1,
          godzina: 1,
          ilosc: 1,
          tydzien: 0,
          rodzaj: 'W',
          grupa: 1,
          przedmiot: 'Programowanie 1',
          przedmiotSkrot: 'PROG1',
          nauczyciel: 'dr Anna Nowak',
          nauczycielSkrot: 'dr A. Nowak',
          sala: '201',
        },
      ]),
    })
  })

  await page.goto('http://localhost:5173/plan-studenta')

  const kierunekSelect = page.locator('select').first()
  const semestrSelect = page.locator('select').nth(1)
  const specSelect = page.locator('select').nth(2)

  const requestGrupy = page.waitForRequest((req) => req.url().includes('/api/studia/1/grupy') && req.url().includes('idSpec=501'))
  const requestRozklad = page.waitForRequest((req) => req.url().includes('/api/rozklad') && req.url().includes('idSpec=501'))

  await kierunekSelect.selectOption('1')
  await semestrSelect.selectOption('1')

  await Promise.all([requestGrupy, requestRozklad])

  await expect(specSelect).toHaveValue('501')
  await expect(specSelect.locator('option:checked')).toHaveText('Programowanie')
  await expect(page.locator('.timetable-table')).toBeVisible()
  await expect(page.getByText('PROG1')).toBeVisible()
})

// test4
test('Na starcie semestr i specjalnosc sa zablokowane', async ({ page }) => {
  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, nazwa: 'Informatyka' },
      ]),
    })
  })

  await page.goto('http://localhost:5173/plan-studenta')

  const semestrSelect = page.locator('select').nth(1)
  const specSelect = page.locator('select').nth(2)

  await expect(semestrSelect).toBeDisabled()
  await expect(specSelect).toBeDisabled()
  await expect(page.getByText(/Wybierz kierunek, semestr/i)).toBeVisible()
})

// test5
test('Zmiana kierunku pobiera semestry i aktualizuje ich liste', async ({ page }) => {
  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, nazwa: 'Informatyka' },
        { id: 2, nazwa: 'Matematyka' },
      ]),
    })
  })

  await page.route('**/api/studia/*/semestry', async (route) => {
    const url = new URL(route.request().url())
    const match = url.pathname.match(/\/studia\/(\d+)\/semestry/)
    const idStudiow = match ? Number(match[1]) : 0

    const body = idStudiow === 1 ? [1, 2] : [3]

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })

  await page.goto('http://localhost:5173/plan-studenta')

  const kierunekSelect = page.locator('select').first()
  const semestrSelect = page.locator('select').nth(1)

  await kierunekSelect.selectOption('1')
  await expect(semestrSelect).toContainText('Semestr 1')
  await expect(semestrSelect).toContainText('Semestr 2')

  const requestSemestry = page.waitForRequest((req) =>
    req.url().includes('/api/studia/2/semestry'),
  )

  await kierunekSelect.selectOption('2')
  await requestSemestry

  await expect(semestrSelect).toContainText('Semestr 3')
  await expect(semestrSelect).not.toContainText('Semestr 1')
})

// test6
test('Pobieranie specjalnosci przekazuje parametr semestr', async ({ page }) => {
  let capturedSemestr = null

  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, nazwa: 'Informatyka' }]),
    })
  })

  await page.route('**/api/studia/*/semestry', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([1, 2]),
    })
  })

  await page.route('**/api/studia/*/specjalnosci*', async (route) => {
    const url = new URL(route.request().url())
    capturedSemestr = url.searchParams.get('semestr')

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 11, nazwa: 'Programowanie' },
      ]),
    })
  })

  await page.goto('http://localhost:5173/plan-studenta')

  const kierunekSelect = page.locator('select').first()
  const semestrSelect = page.locator('select').nth(1)

  await kierunekSelect.selectOption('1')

  const requestSpecjalnosci = page.waitForRequest((req) =>
    req.url().includes('/api/studia/1/specjalnosci') && req.url().includes('semestr=2'),
  )

  await semestrSelect.selectOption('2')

  const req = await requestSpecjalnosci
  const requestUrl = new URL(req.url())

  expect(requestUrl.searchParams.get('semestr')).toBe('2')
  expect(capturedSemestr).toBe('2')
})

// test7
test('Specjalnosc <ogolna>/<ogolne> jest pokazana jako brak', async ({ page }) => {
  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, nazwa: 'Informatyka' }]),
    })
  })

  await page.route('**/api/studia/*/semestry', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([1]),
    })
  })

  await page.route('**/api/studia/*/specjalnosci*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 11, nazwa: '<og\u00f3lna>' },
        { id: 12, nazwa: '<og\u00f3lne>' },
        { id: 13, nazwa: 'Programowanie' },
      ]),
    })
  })

  await page.goto('http://localhost:5173/plan-studenta')

  const kierunekSelect = page.locator('select').first()
  const semestrSelect = page.locator('select').nth(1)
  const specSelect = page.locator('select').nth(2)

  await kierunekSelect.selectOption('1')
  await semestrSelect.selectOption('1')

  const options = specSelect.locator('option')
  await expect(options).toContainText(['brak', 'brak', 'Programowanie'])
  await expect(specSelect).not.toContainText('<ogol')
})

// test8
test('W trakcie pobierania rozkladu widoczny jest loading, potem tabela', async ({ page }) => {
  let releaseRozklad
  const unlockRozklad = new Promise((resolve) => {
    releaseRozklad = resolve
  })

  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, nazwa: 'Informatyka' }]),
    })
  })

  await page.route('**/api/studia/*/semestry', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([1]),
    })
  })

  await page.route('**/api/studia/*/specjalnosci*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 11, nazwa: 'Programowanie' }]),
    })
  })

  await page.route('**/api/studia/*/grupy*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ rodzaj: 'W', grupy: [1] }]),
    })
  })

  await page.route('**/api/rozklad*', async (route) => {
    await unlockRozklad
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
    })
  })

  await page.goto('http://localhost:5173/plan-studenta')

  const kierunekSelect = page.locator('select').first()
  const semestrSelect = page.locator('select').nth(1)
  const specSelect = page.locator('select').nth(2)

  await kierunekSelect.selectOption('1')
  await semestrSelect.selectOption('1')

  const requestRozklad = page.waitForRequest((req) => req.url().includes('/api/rozklad'))
  const responseRozklad = page.waitForResponse((res) => res.url().includes('/api/rozklad'))
  await specSelect.selectOption('11')

  await requestRozklad
  await expect(page.getByText(/planu/i)).toBeVisible()
  releaseRozklad()
  await responseRozklad

  await expect(page.getByText(/planu/i)).toHaveCount(0)
  await expect(page.locator('.timetable-table')).toBeVisible()
})

// test9
test('Blad pobierania rozkladu pokazuje komunikat o bledzie', async ({ page }) => {
  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, nazwa: 'Informatyka' }]),
    })
  })

  await page.route('**/api/studia/*/semestry', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([1]),
    })
  })

  await page.route('**/api/studia/*/specjalnosci*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 11, nazwa: 'Programowanie' }]),
    })
  })

  await page.route('**/api/studia/*/grupy*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ rodzaj: 'W', grupy: [1] }]),
    })
  })

  await page.route('**/api/rozklad*', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'error' }),
    })
  })

  await page.goto('http://localhost:5173/plan-studenta')

  const kierunekSelect = page.locator('select').first()
  const semestrSelect = page.locator('select').nth(1)
  const specSelect = page.locator('select').nth(2)

  await kierunekSelect.selectOption('1')
  await semestrSelect.selectOption('1')
  await specSelect.selectOption('11')

  await expect(page.getByText(/Nie uda.*pobra.*rozk/i)).toBeVisible()
  await expect(page.locator('.timetable-table')).toHaveCount(0)
})

// test10
test('Anulowanie zapisu zamyka modal i czysci wpisana nazwe', async ({ page }) => {
  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, nazwa: 'Informatyka' }]),
    })
  })

  await page.route('**/api/studia/*/semestry', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([1]),
    })
  })

  await page.route('**/api/studia/*/specjalnosci*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 11, nazwa: 'Programowanie' }]),
    })
  })

  await page.route('**/api/studia/*/grupy*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ rodzaj: 'W', grupy: [1] }]),
    })
  })

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
    })
  })

  await page.goto('http://localhost:5173/plan-studenta')

  const kierunekSelect = page.locator('select').first()
  const semestrSelect = page.locator('select').nth(1)
  const specSelect = page.locator('select').nth(2)

  await kierunekSelect.selectOption('1')
  await semestrSelect.selectOption('1')
  await specSelect.selectOption('11')

  await page.getByRole('button', { name: 'Zapisz plan' }).click()
  await expect(page.getByRole('heading', { name: 'Zapisz plan' })).toBeVisible()

  const modalInput = page.locator('input[placeholder*="Moj plan"]')
  await modalInput.fill('Plan tymczasowy')
  await page.getByRole('button', { name: 'Anuluj' }).click()

  await expect(page.getByRole('heading', { name: 'Zapisz plan' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Zapisz plan' }).click()
  await expect(modalInput).toHaveValue('')
})

// test11
test('Zapis planu studenta wysyla poprawny payload i trimuje nazwe', async ({ page }) => {
  let savedPayload = null

  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, nazwa: 'Informatyka' }]),
    })
  })

  await page.route('**/api/studia/*/semestry', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([2]),
    })
  })

  await page.route('**/api/studia/*/specjalnosci*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 11, nazwa: 'Programowanie' }]),
    })
  })

  await page.route('**/api/studia/*/grupy*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { rodzaj: 'W', grupy: [2] },
        { rodzaj: 'J', grupy: [4] },
      ]),
    })
  })

  await page.route('**/api/rozklad*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          idPrzedmiotu: 1001,
          dzien: 1,
          godzina: 1,
          ilosc: 1,
          tydzien: 0,
          rodzaj: 'W',
          grupa: 2,
          przedmiot: 'Algebra',
          przedmiotSkrot: 'ALG',
          nauczyciel: 'dr Jan Kowalski',
          nauczycielSkrot: 'dr J. Kowalski',
          sala: '101',
        },
        {
          id: 2,
          idPrzedmiotu: 9001,
          dzien: 2,
          godzina: 3,
          ilosc: 1,
          tydzien: 0,
          rodzaj: 'J',
          grupa: 4,
          przedmiot: 'Jezyk angielski',
          przedmiotSkrot: 'JANG',
          nauczyciel: 'mgr Anna Nowak',
          nauczycielSkrot: 'A. Nowak',
          sala: '203',
        },
        {
          id: 3,
          idPrzedmiotu: 9002,
          dzien: 3,
          godzina: 3,
          ilosc: 1,
          tydzien: 0,
          rodzaj: 'J',
          grupa: 4,
          przedmiot: 'Jezyk niemiecki',
          przedmiotSkrot: 'JNIEM',
          nauczyciel: 'mgr Tomasz Wysocki',
          nauczycielSkrot: 'T. Wysocki',
          sala: '204',
        },
      ]),
    })
  })

  await page.route('**/api/schedules', async (route) => {
    if (route.request().method() === 'POST') {
      savedPayload = JSON.parse(route.request().postData() || '{}')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1 }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.goto('http://localhost:5173/plan-studenta')

  const kierunekSelect = page.locator('select').first()
  const semestrSelect = page.locator('select').nth(1)
  const specSelect = page.locator('select').nth(2)

  await kierunekSelect.selectOption('1')
  await semestrSelect.selectOption('2')
  await specSelect.selectOption('11')
  await expect(page.locator('.timetable-table')).toBeVisible()

  await page.getByRole('button', { name: 'Zapisz plan' }).click()
  await page.locator('input[placeholder*="Moj plan"]').fill('  Moj plan test  ')

  const requestSave = page.waitForRequest((req) =>
    req.url().includes('/api/schedules') && req.method() === 'POST',
  )

  await page.locator('.fixed.inset-0').getByRole('button', { name: 'Zapisz' }).click()
  await requestSave

  expect(savedPayload).not.toBeNull()
  expect(savedPayload.name).toBe('Moj plan test')
  expect(savedPayload.scheduleType).toBe('Student')
  expect(savedPayload.configuration).toEqual({
    idStudiow: 1,
    semestr: 2,
    idSpecjalnosci: 11,
    grupy: {
      W: 2,
      J: 4,
    },
    idJezyka: 9001,
  })
})

// test12
test('W widoku Moj plan cofanie i ponawianie przywraca nadpisania', async ({ page }) => {
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
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

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
    })
  })

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
          idStudiow: 1,
          semestr: 1,
          idSpecjalnosci: 11,
        },
      ]),
    })
  })

  await page.goto('http://localhost:5173/moj-plan')

  await page.getByRole('button', { name: 'Otworz' }).click()
  await expect(page.locator('.timetable-table')).toBeVisible()
  await expect(page.getByText('ALG')).toBeVisible()

  await page.locator('.border-l-4').first().click()
  await page.getByRole('button', { name: 'Ukryj zajecia' }).click()

  await expect(page.getByText('UKRYTE')).toBeVisible()
  await expect(page.getByText(/Niezapisane zmiany \(1\)/)).toBeVisible()

  await page.locator('button[title="Cofnij ostatnia zmiane"]').click()
  await expect(page.getByText('UKRYTE')).toHaveCount(0)
  await expect(page.getByText(/Niezapisane zmiany/i)).toHaveCount(0)

  await page.locator('button[title="Ponow ostatnia cofnieta zmiane"]').click()
  await expect(page.getByText('UKRYTE')).toBeVisible()
  await expect(page.getByText(/Niezapisane zmiany \(1\)/)).toBeVisible()
})

// test13
test('Przy niezapisanych zmianach guard blokuje opuszczenie strony', async ({ page }) => {
  let confirmMessage = ''

  await page.route('**/api/studia', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, nazwa: 'Informatyka' }]),
    })
  })

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
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

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
    })
  })

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
          idStudiow: 1,
          semestr: 1,
          idSpecjalnosci: 11,
        },
      ]),
    })
  })

  await page.goto('http://localhost:5173/moj-plan')

  await page.getByRole('button', { name: 'Otworz' }).click()
  await expect(page.locator('.timetable-table')).toBeVisible()

  await page.locator('.border-l-4').first().click()
  await page.getByRole('button', { name: 'Ukryj zajecia' }).click()
  await expect(page.getByText(/Niezapisane zmiany \(1\)/)).toBeVisible()

  page.once('dialog', async (dialog) => {
    confirmMessage = dialog.message()
    await dialog.dismiss()
  })

  await page.getByRole('link', { name: 'Plan studenta', exact: true }).click()
  await expect(page).toHaveURL(/\/moj-plan$/)
  expect(confirmMessage).toContain('Masz niezapisane zmiany')
})

// test14
test('Pelny E2E: filtracja, zapis planu, edycja grupy w Moj plan i zapis poprawek', async ({ page, request }) => {
  const apiBase = 'http://localhost:5289/api'
  const planName = `Plan E2E UI ${Date.now()}`
  let createdScheduleId = null

  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  async function getJson(url) {
    const response = await request.get(url)
    if (!response.ok()) return null
    return response.json()
  }

  async function findFlowConfig() {
    const kierunki = await getJson(`${apiBase}/studia`)
    if (!Array.isArray(kierunki) || kierunki.length === 0) return null

    const preferredName = 'stac. i st., kier. informatyka'
    const sortedKierunki = [...kierunki].sort((a, b) => {
      const aPreferred = String(a?.nazwa || '').toLowerCase() === preferredName ? 0 : 1
      const bPreferred = String(b?.nazwa || '').toLowerCase() === preferredName ? 0 : 1
      return aPreferred - bPreferred
    })

    for (const kierunek of sortedKierunki) {
      const semestry = await getJson(`${apiBase}/studia/${kierunek.id}/semestry`)
      if (!Array.isArray(semestry) || semestry.length === 0) continue

      const sortedSemestry = [...semestry].sort((a, b) => {
        const aPreferred = Number(a) === 2 ? 0 : 1
        const bPreferred = Number(b) === 2 ? 0 : 1
        return aPreferred - bPreferred
      })

      for (const semestr of sortedSemestry) {
        const specjalnosci = await getJson(`${apiBase}/studia/${kierunek.id}/specjalnosci?semestr=${semestr}`)
        if (!Array.isArray(specjalnosci) || specjalnosci.length === 0) continue

        const sortedSpecjalnosci = [...specjalnosci].sort((a, b) => {
          const aPreferred = String(a?.nazwa || '').toLowerCase().includes('og')
          const bPreferred = String(b?.nazwa || '').toLowerCase().includes('og')
          if (aPreferred === bPreferred) return 0
          return aPreferred ? -1 : 1
        })

        for (const spec of sortedSpecjalnosci) {
          const rozklad = await getJson(`${apiBase}/rozklad?idStudiow=${kierunek.id}&semestr=${semestr}&idSpec=${spec.id}`)
          if (!Array.isArray(rozklad) || rozklad.length === 0) continue

          const grouped = new Map()
          for (const entry of rozklad) {
            if (entry?.idPrzedmiotu == null || !entry?.rodzaj || entry?.grupa == null) continue

            const key = `${entry.idPrzedmiotu}_${entry.rodzaj}`
            if (!grouped.has(key)) {
              grouped.set(key, { groups: new Set(), entries: [] })
            }

            const value = grouped.get(key)
            value.groups.add(Number(entry.grupa))
            value.entries.push(entry)
          }

          for (const value of grouped.values()) {
            if (value.groups.size < 2) continue

            const groups = Array.from(value.groups).sort((a, b) => a - b)
            const fromGroup = groups[0]
            const toGroup = groups[1]
            const baseEntry = value.entries.find((e) => Number(e.grupa) === fromGroup) || value.entries[0]

            return {
              idStudiow: kierunek.id,
              semestr,
              idSpecjalnosci: spec.id,
              rodzaj: baseEntry.rodzaj,
              fromGroup,
              toGroup,
              subjectLabel: baseEntry.przedmiotSkrot || baseEntry.przedmiot || '',
            }
          }
        }
      }
    }

    return null
  }

  let flowConfig = null
  try {
    flowConfig = await findFlowConfig()
  } catch {
    flowConfig = null
  }

  test.skip(!flowConfig, 'Brak dostepnego zestawu danych backendowych do stabilnego flow E2E (kierunek/semestr/spec + min. 2 grupy jednego przedmiotu).')

  try {
    await page.goto('http://localhost:5173/plan-studenta')

    const kierunekSelect = page.locator('select').first()
    const semestrSelect = page.locator('select').nth(1)
    const specSelect = page.locator('select').nth(2)

    await kierunekSelect.selectOption(String(flowConfig.idStudiow))
    await semestrSelect.selectOption(String(flowConfig.semestr))
    await expect(specSelect).toBeEnabled({ timeout: 10000 })
    await specSelect.selectOption(String(flowConfig.idSpecjalnosci))

    await expect(page.locator('.timetable-table')).toBeVisible({ timeout: 15000 })

    const groupLabel = page.locator('label', { hasText: new RegExp(`^${escapeRegex(flowConfig.rodzaj)}:$`) }).first()
    test.skip(await groupLabel.count() === 0, `Brak selektora grupy dla rodzaju ${flowConfig.rodzaj}.`)

    const groupSelect = groupLabel.locator('..').locator('select')
    await groupSelect.selectOption(String(flowConfig.fromGroup))
    await expect(groupSelect).toHaveValue(String(flowConfig.fromGroup))

    await page.getByRole('button', { name: 'Zapisz plan' }).click()
    await page.locator('input[placeholder*="Moj plan"]').fill(planName)

    const savePlanResponsePromise = page.waitForResponse((res) =>
      res.url().includes('/api/schedules') &&
      res.request().method() === 'POST' &&
      res.ok(),
    )

    await page.locator('.fixed.inset-0').getByRole('button', { name: 'Zapisz' }).click()
    const savePlanResponse = await savePlanResponsePromise
    const savedPlan = await savePlanResponse.json()
    createdScheduleId = savedPlan?.id ?? null

    await expect(page.getByText(`Plan "${planName}" zostal zapisany!`)).toBeVisible()

    await page.getByRole('link', { name: 'Moj plan', exact: true }).click()
    await expect(page).toHaveURL(/\/moj-plan$/)

    const scheduleCard = page.locator('div.bg-white.rounded-lg.shadow-sm.border').filter({ hasText: planName }).first()
    await expect(scheduleCard).toBeVisible({ timeout: 15000 })
    await scheduleCard.getByRole('button', { name: 'Otworz' }).click()

    await expect(page.locator('.timetable-table')).toBeVisible({ timeout: 15000 })

    let editedTile = page
      .locator('.border-l-4')
      .filter({
        hasText: new RegExp(`${escapeRegex(flowConfig.subjectLabel)}.*${escapeRegex(flowConfig.rodzaj)}\\s+gr\\.\\s*${flowConfig.fromGroup}`, 'i'),
      })
      .first()

    if (await editedTile.count() === 0) {
      editedTile = page
        .locator('.border-l-4')
        .filter({
          hasText: new RegExp(`${escapeRegex(flowConfig.rodzaj)}\\s+gr\\.\\s*${flowConfig.fromGroup}`, 'i'),
        })
        .first()
    }

    await expect(editedTile).toBeVisible({ timeout: 10000 })
    await editedTile.click()
    await page.getByRole('button', { name: 'Zmien grupe' }).click()
    await page.getByRole('button', { name: new RegExp(`gr\\.\\s*${flowConfig.toGroup}\\b`, 'i') }).first().click()

    await expect(page.getByText(/Niezapisane zmiany \([1-9]\d*\)/)).toBeVisible()

    const saveOverridesRequest = page.waitForRequest((req) =>
      req.url().includes('/api/schedules/') &&
      req.url().includes('/overrides') &&
      req.method() === 'PUT',
    )

    await page.getByRole('button', { name: 'Zapisz zmiany' }).click()
    await saveOverridesRequest

    await expect(page.getByText(/zapisanych nadpisan/)).toBeVisible()
    await expect(page.getByText(/Niezapisane zmiany/)).toHaveCount(0)
  } finally {
    if (createdScheduleId != null) {
      try {
        await request.delete(`${apiBase}/schedules/${createdScheduleId}`)
      } catch {
        // Best-effort cleanup only.
      }
    }
  }
})
