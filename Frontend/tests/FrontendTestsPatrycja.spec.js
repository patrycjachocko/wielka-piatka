import { test, expect } from '@playwright/test';

test.describe('mock', () => {

  async function setupStudentMocks(page) {
    await page.route('**/api/studia', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, nazwa: 'Informatyka' }]) });
    });
    await page.route('**/api/studia/*/semestry', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([1, 2]) });
    });
    await page.route('**/api/studia/*/specjalnosci*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, nazwa: 'Programowanie' }]) });
    });
    await page.route('**/api/studia/*/grupy*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ rodzaj: 'W', grupy: [1] }]) });
    });
  }

  async function setupTeacherMocks(page, teacherData = [{ id: 1, nazwa: 'Jan Kowalski' }]) {
    await page.route('**/api/nauczyciele', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(teacherData) });
    });
    //domyslny rozklad
    await page.route('**/api/rozklad/nauczyciel/*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/rozklad/nauczyciel/*/konsultacje', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  }

  test('Automatyczny wybór specjalności, gdy dostępna jest tylko jedna', async ({ page }) => {
    await setupStudentMocks(page);
    
    await page.route('**/api/studia/*/specjalnosci*', async route => {
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json', 
        body: JSON.stringify([{ id: 99, nazwa: 'Jedyna Specjalność' }]) 
      });
    });

    await page.goto('http://localhost:5173/plan-studenta');
    
    await page.locator('select').nth(0).selectOption({ index: 1 }); 
    await page.locator('select').nth(1).selectOption({ index: 1 }); 

    const selectSpecjalnosc = page.locator('select').nth(2);
    await expect(selectSpecjalnosc).toHaveValue('99');
  });

  test('Dynamiczne kolorowanie kafelków zgodnie z rodzajem zajęć w TimetableGrid', async ({ page }) => {
    await setupTeacherMocks(page, [{ id: 1, nazwa: 'Jan Kowalski' }]);
    
    await page.route('**/api/rozklad/nauczyciel/1', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 101, dzien: 1, godzina: 1, ilosc: 1, rodzaj: 'W', przedmiot: 'Bazy Danych' },
        { id: 102, dzien: 1, godzina: 2, ilosc: 1, rodzaj: 'L', przedmiot: 'Programowanie' }
      ])});
    });

    await page.goto('http://localhost:5173/plan-nauczyciela');
    await page.locator('select[size="8"]').selectOption('1');
    
    const wykladKafelek = page.locator('.border-l-4').filter({ hasText: 'Bazy Danych' });
    const labKafelek = page.locator('.border-l-4').filter({ hasText: 'Programowanie' });

    await expect(wykladKafelek).toBeVisible();
    await expect(wykladKafelek).toHaveClass(/bg-yellow-100/);
    
    await expect(labKafelek).toBeVisible();
    await expect(labKafelek).toHaveClass(/bg-blue-100/);
  });

  test('Wizualne oznaczanie aktualnej zakładki w menu głównym (App.vue)', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    
    const studentLink = page.getByRole('link', { name: 'Plan studenta', exact: true });
    await studentLink.click();
    await page.waitForLoadState('networkidle');
    
    await expect(studentLink).toHaveClass(/bg-blue-100/);

    const teacherLink = page.getByRole('link', { name: 'Plan nauczyciela', exact: true });
    await teacherLink.click();
    await page.waitForLoadState('networkidle');
    
    await expect(teacherLink).toHaveClass(/bg-blue-100/);
    await expect(studentLink).not.toHaveClass(/bg-blue-100/);
  });

  test('Wyszukiwarka nauczycieli poprawnie filtruje listę (TeacherScheduleView)', async ({ page }) => {
    await setupTeacherMocks(page, [
      { id: 1, nazwa: 'Anna Nowak' },
      { id: 2, nazwa: 'Jan Kowalski' }
    ]);
    
    await page.goto('http://localhost:5173/plan-nauczyciela');

    const selectBox = page.locator('select[size="8"]');
    await expect(selectBox.locator('option')).toHaveCount(2);

    const searchInput = page.getByPlaceholder('Szukaj po nazwisku...');
    await searchInput.fill('Kowalski');
    
    await expect(selectBox.locator('option')).toHaveCount(1);
    await expect(selectBox.locator('option')).toHaveText('Jan Kowalski');
  });

  test('Pokazuje komunikat po udanym zapisie planu nauczyciela', async ({ page }) => {
    await setupTeacherMocks(page, [{ id: 1, nazwa: 'Nauczyciel Testowy' }]);
    
    await page.route('**/api/rozklad/nauczyciel/1', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 101, dzien: 1, godzina: 1, ilosc: 1, rodzaj: 'W', przedmiot: 'Bazy' }
      ])});
    });
    
    await page.route('**/api/schedules', async route => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('http://localhost:5173/plan-nauczyciela');
    await page.locator('select[size="8"]').selectOption('1');

    const btnZapiszPlan = page.getByRole('button', { name: 'Zapisz plan' });
    await expect(btnZapiszPlan).toBeVisible();
    await btnZapiszPlan.click();
    
    const inputNazwa = page.getByPlaceholder('np. Moj plan - semestr 4');
    await inputNazwa.fill('Plan testowy Patrycji');
    await page.getByRole('button', { name: 'Zapisz', exact: true }).click();

    await expect(page.getByText('Plan "Plan testowy Patrycji" zostal zapisany!')).toBeVisible();
  });

  test('Pusty stan po nałożeniu filtrów niepowodujących znalezienia zajęć', async ({ page }) => {
    await setupStudentMocks(page);
    await page.route('**/api/rozklad*', async route => { 
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }); 
    });

    await page.goto('http://localhost:5173/plan-studenta');
    
    await page.locator('select').nth(0).selectOption({ index: 1 });
    await expect(page.locator('select').nth(1)).toBeEnabled();
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await expect(page.locator('select').nth(2)).toBeEnabled();
    await page.locator('select').nth(2).selectOption({ index: 1 });

    await expect(page.locator('.timetable-table')).toBeHidden();
  });

  test('Zmiana nauczyciela inicjuje pobieranie nowego rozkładu', async ({ page }) => {
    await setupTeacherMocks(page, [
      { id: 1, nazwa: 'Nauczyciel A' }, 
      { id: 2, nazwa: 'Nauczyciel B' }
    ]);
    
    await page.goto('http://localhost:5173/plan-nauczyciela');
    
    const requestPromise1 = page.waitForRequest(req => req.url().includes('rozklad/nauczyciel/1'));
    await page.locator('select[size="8"]').selectOption('1');
    await requestPromise1;

    const requestPromise2 = page.waitForRequest(req => req.url().includes('rozklad/nauczyciel/2'));
    await page.locator('select[size="8"]').selectOption('2');
    const req2 = await requestPromise2;
    
    expect(req2).toBeTruthy();
  });

  test('Wyświetla komunikat o błędzie, gdy zapis planu na serwerze się nie powiedzie', async ({ page }) => {
    await setupTeacherMocks(page, [{ id: 1, nazwa: 'Awaryjny Nauczyciel' }]);
    
    await page.route('**/api/rozklad/nauczyciel/1', async route => { 
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 1, dzien: 1, godzina: 1, ilosc: 1, rodzaj: 'W', przedmiot: 'Bazy danych' }
      ])}); 
    });

    await page.route('**/api/schedules', async route => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.goto('http://localhost:5173/plan-nauczyciela');
    await page.locator('select[size="8"]').selectOption('1');
    
    await page.getByRole('button', { name: 'Zapisz plan' }).click();
    await page.getByPlaceholder('np. Moj plan - semestr 4').fill('Mój pechowy plan');
    
    await page.getByRole('button', { name: 'Zapisz', exact: true }).click();

    const errorMessage = page.getByText('Blad podczas zapisywania planu');
    await expect(errorMessage).toBeVisible();
  });

  test('Zapis planu za pomocą klawisza ENTER w SavePlanModal bez użycia myszki', async ({ page }) => {
    await setupTeacherMocks(page, [{ id: 1, nazwa: 'Testowy Nauczyciel' }]);
    
    await page.route('**/api/rozklad/nauczyciel/1', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 101, dzien: 1, godzina: 1, ilosc: 1, rodzaj: 'W' }
      ])});
    });
    
    await page.route('**/api/schedules', async route => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('http://localhost:5173/plan-nauczyciela');
    await page.locator('select[size="8"]').selectOption('1');
    
    await page.getByRole('button', { name: 'Zapisz plan' }).click();
    const inputNazwa = page.getByPlaceholder('np. Moj plan - semestr 4');
    await inputNazwa.fill('Plan Enter');

    await inputNazwa.press('Enter');

    await expect(page.getByText('Plan "Plan Enter" zostal zapisany!')).toBeVisible();
  });

  test('Wyświetlanie poprawnych danych w tooltipie (title) z TimetableGrid', async ({ page }) => {
    await setupTeacherMocks(page, [{ id: 1, nazwa: 'Nauczyciel' }]);
    
    await page.route('**/api/rozklad/nauczyciel/1', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 1, dzien: 1, godzina: 1, ilosc: 1, rodzaj: 'W', przedmiot: 'Matematyka', isUpdated: true }
      ])});
    });

    await page.goto('http://localhost:5173/plan-nauczyciela');
    await page.locator('select[size="8"]').selectOption('1');

    const kafelek = page.locator('.border-l-4').filter({ hasText: 'Matematyka' });
    
    await expect(kafelek).toBeVisible();
    
    const titleAttr = await kafelek.getAttribute('title');
    expect(titleAttr).toContain('Matematyka');
    expect(titleAttr).toContain('*** ZAKTUALIZOWANO ***');
  });

  test('Przy braku angielskiego wybierany jest pierwszy dostępny język (fallback)', async ({ page }) => {
    await setupStudentMocks(page);
    
    await page.route('**/api/**/*grupy*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { rodzaj: 'W', grupy: [1] }, { rodzaj: 'J', grupy: [1, 2] }
      ])});
    });

    await page.route('**/api/**/*rozklad*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { idPrzedmiotu: 201, przedmiot: 'Język Niemiecki', rodzaj: 'J', grupa: 1, dzien: 1, godzina: 1, ilosc: 2 },
        { idPrzedmiotu: 202, przedmiot: 'Język Hiszpański', rodzaj: 'J', grupa: 2, dzien: 2, godzina: 2, ilosc: 2 }
      ])});
    });

    await page.goto('http://localhost:5173/plan-studenta');
    
    await page.locator('select').nth(0).selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.locator('select').nth(2).selectOption({ index: 1 });

    const labelJezyk = page.locator('label', { hasText: 'Język obcy:' });
    await expect(labelJezyk).toBeVisible();
    const jezykDropdown = labelJezyk.locator('..').locator('select');
    
    await expect(jezykDropdown).toHaveValue('201');
  });

  test('Zmiana języka aktualizuje listę dostępnych grup J', async ({ page }) => {
    await setupStudentMocks(page);
    
    await page.route('**/api/**/*grupy*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { rodzaj: 'W', grupy: [1] }, { rodzaj: 'J', grupy: [1, 2, 3] }
      ])});
    });

    await page.route('**/api/**/*rozklad*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { idPrzedmiotu: 200, przedmiot: 'Język Angielski', rodzaj: 'J', grupa: 1, dzien: 1, godzina: 1, ilosc: 2 },
        { idPrzedmiotu: 200, przedmiot: 'Język Angielski', rodzaj: 'J', grupa: 2, dzien: 2, godzina: 1, ilosc: 2 },
        { idPrzedmiotu: 201, przedmiot: 'Język Niemiecki', rodzaj: 'J', grupa: 3, dzien: 3, godzina: 1, ilosc: 2 }
      ])});
    });

    await page.goto('http://localhost:5173/plan-studenta');
    await page.locator('select').nth(0).selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.locator('select').nth(2).selectOption({ index: 1 });

    const labelJezyk = page.locator('label', { hasText: 'Język obcy:' });
    await expect(labelJezyk).toBeVisible();
    const jezykDropdown = labelJezyk.locator('..').locator('select');

    const labelGrupaJ = page.locator('label', { hasText: /^J:$/ });
    await expect(labelGrupaJ).toBeVisible();
    const jGroupSelect = labelGrupaJ.locator('..').locator('select');

    await expect(jezykDropdown).toHaveValue('200');
    await expect(jGroupSelect.locator('option')).toHaveCount(2);

    await jezykDropdown.selectOption('201');

    await expect(jGroupSelect.locator('option')).toHaveCount(1);
    await expect(jGroupSelect.locator('option').nth(0)).toHaveText('3');
  });

  test('Po zmianie języka nieprawidłowo wybrana grupa J jest korygowana', async ({ page }) => {
    await setupStudentMocks(page);
    
    await page.route('**/api/**/*grupy*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { rodzaj: 'W', grupy: [1] }, { rodzaj: 'J', grupy: [1, 2, 3] }
      ])});
    });
    
    await page.route('**/api/**/*rozklad*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { idPrzedmiotu: 200, przedmiot: 'Język Angielski', rodzaj: 'J', grupa: 1, dzien: 1, godzina: 1, ilosc: 2 },
        { idPrzedmiotu: 200, przedmiot: 'Język Angielski', rodzaj: 'J', grupa: 2, dzien: 2, godzina: 1, ilosc: 2 },
        { idPrzedmiotu: 201, przedmiot: 'Język Niemiecki', rodzaj: 'J', grupa: 3, dzien: 3, godzina: 1, ilosc: 2 }
      ])});
    });

    await page.goto('http://localhost:5173/plan-studenta');
    await page.locator('select').nth(0).selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.locator('select').nth(2).selectOption({ index: 1 });

    const labelJezyk = page.locator('label', { hasText: 'Język obcy:' });
    await expect(labelJezyk).toBeVisible();
    const jezykDropdown = labelJezyk.locator('..').locator('select');

    const labelGrupaJ = page.locator('label', { hasText: /^J:$/ });
    const jGroupSelect = labelGrupaJ.locator('..').locator('select');

    await jGroupSelect.selectOption('2');
    await expect(jGroupSelect).toHaveValue('2');

    await jezykDropdown.selectOption('201');

    await expect(jGroupSelect).toHaveValue('3');
  });

});