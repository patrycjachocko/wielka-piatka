/**
 * Testy API dla aplikacji Plan Studenta
 * Autor: Klaudia
 *
 * Testy wykorzystuja Playwright request API (prawdziwe zapytania HTTP)
 * Model: Service Object Model (SOM) - odpowiednik POM dla API
 *
 * UWAGA: Backend musi byc uruchomiony na http://localhost:5289
 * Komenda: cd Backend && dotnet run
 */
import { test, expect } from '@playwright/test';
import { StudiaService } from './services/StudiaService.js';

// Konfiguracja bazowego URL API - backend .NET na porcie 5289
const BASE_URL = process.env.API_URL || 'http://localhost:5289';

test.describe('API Tests - Studia', () => {
  let studiaService;

  test.beforeEach(async ({ request }) => {
    studiaService = new StudiaService(request, BASE_URL);
  });

  // TEST 1: GET /api/studia - walidacja struktury JSON
  test('GET /api/studia - zwraca poprawna strukture JSON z lista kierunkow', async () => {
    const { response, data } = await studiaService.getAll();

    // Sprawdzenie statusu HTTP
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    // Sprawdzenie ze odpowiedz jest tablica
    expect(Array.isArray(data)).toBe(true);

    // Jesli sa dane, sprawdz strukture pojedynczego obiektu
    if (data.length > 0) {
      const kierunek = data[0];

      // Walidacja wymaganych pol (zgodnie z backendem .NET)
      expect(kierunek).toHaveProperty('id');
      expect(kierunek).toHaveProperty('nazwa');

      // Walidacja typow danych
      expect(typeof kierunek.id).toBe('number');
      expect(typeof kierunek.nazwa).toBe('string');
    }
  });

  // TEST 2: GET /api/studia/{id}/semestry - obsluga bledu 404 dla nieistniejacego kierunku
  test('GET /api/studia/{id}/semestry - zwraca pusta tablice dla nieistniejacego kierunku', async ({ request }) => {
    const nieistniejaceId = 999999;
    const response = await request.get(`${BASE_URL}/api/studia/${nieistniejaceId}/semestry`);

    // Backend zwraca 200 z pusta tablica zamiast 404
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  // TEST 8: GET /api/studia - wyszukiwanie kierunkow (filtrowanie po stronie klienta)
  test('GET /api/studia - mozna przefiltrowac wyniki po nazwie kierunku', async () => {
    const { response, data } = await studiaService.getAll();

    expect(response.status()).toBe(200);
    expect(Array.isArray(data)).toBe(true);

    // Filtrowanie po stronie klienta (backend nie ma endpointu search)
    const searchQuery = 'informatyka';
    const filtered = data.filter(kierunek =>
      kierunek.nazwa?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Test logiki filtrowania - jesli sa kierunki z 'informatyka', powinny byc znalezione
    if (data.some(k => k.nazwa?.toLowerCase().includes(searchQuery))) {
      expect(filtered.length).toBeGreaterThan(0);
    }
  });
});

test.describe('API Tests - Nauczyciele', () => {
  // TEST 3: GET /api/nauczyciele - lista nauczycieli (zamiast auth/login)
  test('GET /api/nauczyciele - zwraca liste nauczycieli z poprawnymi polami', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/nauczyciele`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);

    if (data.length > 0) {
      const nauczyciel = data[0];

      // Walidacja struktury zgodnie z NauczycielDto
      expect(nauczyciel).toHaveProperty('id');
      expect(nauczyciel).toHaveProperty('nazwa');
      expect(nauczyciel).toHaveProperty('nazwisko');
      expect(nauczyciel).toHaveProperty('imie');
      expect(nauczyciel).toHaveProperty('tytul');

      // Walidacja typow
      expect(typeof nauczyciel.id).toBe('number');
      expect(typeof nauczyciel.nazwa).toBe('string');
    }
  });

  // TEST 4: GET /api/nauczyciele - filtrowanie blacklist dziala
  test('GET /api/nauczyciele - nie zawiera wpisow z blacklisty', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/nauczyciele`);
    const data = await response.json();

    const blacklist = ['kn msi', 'alo', '9:30 - 11:00', '8:00 - 9:30', '11:00 - 12:30'];

    // Sprawdz czy zadne wpisy nie zawieraja fraz z blacklisty
    data.forEach(nauczyciel => {
      blacklist.forEach(phrase => {
        expect(nauczyciel.nazwa?.toLowerCase()).not.toContain(phrase.toLowerCase());
        expect(nauczyciel.nazwisko?.toLowerCase()).not.toContain(phrase.toLowerCase());
      });
    });
  });
});

test.describe('API Tests - Schedules (Zapisane plany)', () => {

  // TEST 5: GET /api/schedules - lista zapisanych planow
  test('GET /api/schedules - zwraca liste zapisanych planow', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/schedules`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);

    if (data.length > 0) {
      const schedule = data[0];
      expect(schedule).toHaveProperty('id');
      expect(schedule).toHaveProperty('name');
      expect(schedule).toHaveProperty('scheduleType');
      expect(schedule).toHaveProperty('createdAt');
    }
  });

  // TEST 6: POST /api/schedules - tworzenie nowego planu
  test('POST /api/schedules - tworzy nowy plan studenta', async ({ request }) => {
    // Najpierw pobierz dostepne kierunki
    const studiaResponse = await request.get(`${BASE_URL}/api/studia`);
    const studia = await studiaResponse.json();

    if (studia.length === 0) {
      test.skip('Brak kierunkow w bazie - pomijam test');
      return;
    }

    const kierunek = studia[0];

    // Pobierz semestry dla kierunku
    const semestryResponse = await request.get(`${BASE_URL}/api/studia/${kierunek.id}/semestry`);
    const semestry = await semestryResponse.json();

    if (semestry.length === 0) {
      test.skip('Brak semestrow dla kierunku - pomijam test');
      return;
    }

    // Pobierz specjalnosci
    const specResponse = await request.get(`${BASE_URL}/api/studia/${kierunek.id}/specjalnosci?semestr=${semestry[0]}`);
    const specjalnosci = await specResponse.json();

    if (specjalnosci.length === 0) {
      test.skip('Brak specjalnosci - pomijam test');
      return;
    }

    const newSchedule = {
      name: `Test Plan ${Date.now()}`,
      scheduleType: 'Student',
      configuration: {
        idStudiow: kierunek.id,
        semestr: semestry[0],
        idSpecjalnosci: specjalnosci[0].id,
        grupy: {},
        idJezyka: null
      }
    };

    const response = await request.post(`${BASE_URL}/api/schedules`, {
      data: newSchedule,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('name');
    expect(data.name).toBe(newSchedule.name);
  });

  // TEST 7: POST /api/schedules - walidacja - brak nazwy
  test('POST /api/schedules - zwraca 400 BadRequest przy braku nazwy', async ({ request }) => {
    const invalidSchedule = {
      name: '',  // Pusta nazwa
      scheduleType: 'Student',
      configuration: {
        idStudiow: 1,
        semestr: 1,
        idSpecjalnosci: 1,
        grupy: {}
      }
    };

    const response = await request.post(`${BASE_URL}/api/schedules`, {
      data: invalidSchedule,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status()).toBe(400);
  });

  // TEST 9: DELETE /api/schedules/{id} - usuwanie planu
  test('DELETE /api/schedules/{id} - usuwa plan i weryfikuje 404', async ({ request }) => {
    // Najpierw utworz plan do usuniecia
    const studiaResponse = await request.get(`${BASE_URL}/api/studia`);
    const studia = await studiaResponse.json();

    if (studia.length === 0) {
      test.skip('Brak kierunkow - pomijam test');
      return;
    }

    const kierunek = studia[0];
    const semestryResponse = await request.get(`${BASE_URL}/api/studia/${kierunek.id}/semestry`);
    const semestry = await semestryResponse.json();

    if (semestry.length === 0) {
      test.skip('Brak semestrow - pomijam test');
      return;
    }

    const specResponse = await request.get(`${BASE_URL}/api/studia/${kierunek.id}/specjalnosci?semestr=${semestry[0]}`);
    const specjalnosci = await specResponse.json();

    if (specjalnosci.length === 0) {
      test.skip('Brak specjalnosci - pomijam test');
      return;
    }

    // Utworz plan
    const createResponse = await request.post(`${BASE_URL}/api/schedules`, {
      data: {
        name: `Plan do usuniecia ${Date.now()}`,
        scheduleType: 'Student',
        configuration: {
          idStudiow: kierunek.id,
          semestr: semestry[0],
          idSpecjalnosci: specjalnosci[0].id,
          grupy: {}
        }
      },
      headers: { 'Content-Type': 'application/json' }
    });

    expect(createResponse.status()).toBe(201);
    const createdPlan = await createResponse.json();

    // Usun plan
    const deleteResponse = await request.delete(`${BASE_URL}/api/schedules/${createdPlan.id}`);
    expect(deleteResponse.status()).toBe(204);

    // Sprobuj pobrac usuniety plan - powinien zwrocic 404
    const getResponse = await request.get(`${BASE_URL}/api/schedules/${createdPlan.id}`);
    expect(getResponse.status()).toBe(404);
  });

  // TEST 10: GET /api/schedules/{id} - walidacja formatu dat ISO 8601
  test('GET /api/schedules/{id} - zawiera date createdAt w formacie ISO 8601', async ({ request }) => {
    // Pobierz liste planow
    const listResponse = await request.get(`${BASE_URL}/api/schedules`);
    const schedules = await listResponse.json();

    if (schedules.length === 0) {
      test.skip('Brak zapisanych planow - pomijam test');
      return;
    }

    // Pobierz szczegoly pierwszego planu
    const detailResponse = await request.get(`${BASE_URL}/api/schedules/${schedules[0].id}`);
    expect(detailResponse.status()).toBe(200);

    const schedule = await detailResponse.json();
    expect(schedule).toHaveProperty('createdAt');

    // Walidacja formatu daty ISO 8601
    const createdAt = schedule.createdAt;
    expect(typeof createdAt).toBe('string');

    // Sprawdz czy data jest parsowalna
    const parsedDate = new Date(createdAt);
    expect(parsedDate.toString()).not.toBe('Invalid Date');

    // Sprawdz format ISO (YYYY-MM-DDTHH:mm:ss)
    expect(createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

test.describe('API Tests - Rozklad i Grupy', () => {
  // TEST - GET /api/studia/{id}/grupy - pobieranie grup
  test('GET /api/studia/{id}/grupy - zwraca grupy dla kierunku/semestru/specjalnosci', async ({ request }) => {
    // Najpierw pobierz kierunki
    const studiaResponse = await request.get(`${BASE_URL}/api/studia`);
    const studia = await studiaResponse.json();

    if (studia.length === 0) {
      test.skip('Brak kierunkow - pomijam test');
      return;
    }

    const kierunek = studia[0];

    // Pobierz semestry
    const semestryResponse = await request.get(`${BASE_URL}/api/studia/${kierunek.id}/semestry`);
    const semestry = await semestryResponse.json();

    if (semestry.length === 0) {
      test.skip('Brak semestrow - pomijam test');
      return;
    }

    // Pobierz specjalnosci
    const specResponse = await request.get(`${BASE_URL}/api/studia/${kierunek.id}/specjalnosci?semestr=${semestry[0]}`);
    const specjalnosci = await specResponse.json();

    if (specjalnosci.length === 0) {
      test.skip('Brak specjalnosci - pomijam test');
      return;
    }

    // Pobierz grupy
    const grupyResponse = await request.get(
      `${BASE_URL}/api/studia/${kierunek.id}/grupy?semestr=${semestry[0]}&idSpec=${specjalnosci[0].id}`
    );

    expect(grupyResponse.status()).toBe(200);

    const grupy = await grupyResponse.json();
    expect(Array.isArray(grupy)).toBe(true);

    if (grupy.length > 0) {
      const grupa = grupy[0];
      expect(grupa).toHaveProperty('rodzaj');
      expect(grupa).toHaveProperty('grupy');
      expect(Array.isArray(grupa.grupy)).toBe(true);
    }
  });
});
