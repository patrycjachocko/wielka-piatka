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
