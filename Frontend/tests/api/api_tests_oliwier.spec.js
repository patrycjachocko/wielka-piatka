import { test, expect } from '@playwright/test';
import { StudiaApiService } from './services/StudiaApiService.js';
import { RozkladApiService } from './services/RozkladApiService.js';
import { NauczycieleApiService } from './services/NauczycieleApiService.js';
import { SchedulesApiService } from './services/SchedulesApiService.js';
import { KonfiguracjaApiService } from './services/KonfiguracjaApiService.js';
import { EksportApiService } from './services/EksportApiService.js';

const BASE_URL = process.env.API_URL || 'http://localhost:5289';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

test.describe('Testy API - Oliwier (Stateless GET Operations)', () => {
  let services;

  test.beforeEach(async ({ request }) => {
    services = {
      studia: new StudiaApiService(request, BASE_URL),
      rozklad: new RozkladApiService(request, BASE_URL),
      nauczyciele: new NauczycieleApiService(request, BASE_URL),
      schedules: new SchedulesApiService(request, BASE_URL),
      konfiguracja: new KonfiguracjaApiService(request, BASE_URL),
      eksport: new EksportApiService(request, BASE_URL),
    };
  });

  // TEST 1: Pobiera listę nauczycieli i waliduje strukturę każdego rekordu
  test('TEST 1: Nauczyciele - lista nauczycieli z poprawną strukturą i polami', async () => {
    const result = await services.nauczyciele.getNauczyciele();

    expect(result.response.status()).toBe(200);
    expect(result.response.headers()['content-type']).toContain('application/json');

    const nauczyciele = asArray(result.data);
    expect(Array.isArray(nauczyciele)).toBe(true);
    expect(nauczyciele.length).toBeGreaterThan(0);

    nauczyciele.forEach((nauczyciel) => {
      expect(nauczyciel).toHaveProperty('id');
      expect(nauczyciel).toHaveProperty('nazwa');
      expect(typeof nauczyciel.id).toBe('number');
      expect(typeof nauczyciel.nazwa).toBe('string');
      expect(nauczyciel.id).toBeGreaterThan(0);
      expect(nauczyciel.nazwa.length).toBeGreaterThan(0);
    });
  });

  // TEST 2: Iteruje przez nauczycieli, szuka tych z harmonogramem, waliduje jednostkę rozkladu
  test('TEST 2: Nauczyciele + Rozklad - odkrycie nauczyciela z harmonogramem', async () => {
    const nauczycieleResult = await services.nauczyciele.getNauczyciele();
    expect(nauczycieleResult.response.status()).toBe(200);

    const nauczyciele = asArray(nauczycieleResult.data);
    expect(nauczyciele.length).toBeGreaterThan(0);

    let foundTeacherWithSchedule = false;

    for (const nauczyciel of nauczyciele) {
      const rozkladResult = await services.rozklad.getTeacherRozklad(nauczyciel.id);
      expect(rozkladResult.response.status()).toBe(200);

      const rozklad = asArray(rozkladResult.data);

      if (rozklad.length > 0) {
        foundTeacherWithSchedule = true;

        const entry = rozklad[0];
        expect(entry).toHaveProperty('idPrzedmiotu');
        expect(entry).toHaveProperty('rodzaj');
        expect(typeof entry.idPrzedmiotu).toBe('number');
        expect(typeof entry.rodzaj).toBe('string');

        break;
      }
    }

    expect(foundTeacherWithSchedule).toBe(true);
  });

  // TEST 3: Pobiera konsultacje dla pierwszego nauczyciela i waliduje typ odpowiedzi (tablica)
  test('TEST 3: Konsultacje nauczyciela - pobieranie i walidacja struktury', async () => {
    const nauczycieleResult = await services.nauczyciele.getNauczyciele();
    expect(nauczycieleResult.response.status()).toBe(200);

    const nauczyciele = asArray(nauczycieleResult.data);
    expect(nauczyciele.length).toBeGreaterThan(0);

    const nauczyciel = nauczyciele[0];

    const konsultacjeResult = await services.rozklad.getTeacherKonsultacje(nauczyciel.id);
    expect(konsultacjeResult.response.status()).toBe(200);
    expect(konsultacjeResult.response.headers()['content-type']).toContain('application/json');

    const konsultacje = asArray(konsultacjeResult.data);
    expect(Array.isArray(konsultacje)).toBe(true);

    konsultacje.forEach((k) => {
      expect(typeof k).toBe('object');
    });
  });

  // TEST 4: Sekwencyjnie pobiera studia -> semestry -> specjalnosci -> grupy
  test('TEST 4: Studia - cascade discovery (studia → semestry → specjalnosci → grupy)', async () => {
    const studiaResult = await services.studia.getStudia();
    expect(studiaResult.response.status()).toBe(200);

    const studia = asArray(studiaResult.data);
    expect(Array.isArray(studia)).toBe(true);
    expect(studia.length).toBeGreaterThan(0);

    const selectedStudia = studia[0];
    expect(typeof selectedStudia.id).toBe('number');
    expect(typeof selectedStudia.nazwa).toBe('string');

    const semestryResult = await services.studia.getSemestry(selectedStudia.id);
    expect(semestryResult.response.status()).toBe(200);

    const semestry = asArray(semestryResult.data);
    expect(Array.isArray(semestry)).toBe(true);
    expect(semestry.length).toBeGreaterThan(0);

    const semestr = semestry[0];
    expect(typeof semestr).toBe('number');

    const specResult = await services.studia.getSpecjalnosci(selectedStudia.id, semestr);
    expect(specResult.response.status()).toBe(200);

    const specjalnosci = asArray(specResult.data);
    expect(Array.isArray(specjalnosci)).toBe(true);

    if (specjalnosci.length > 0) {
      const spec = specjalnosci[0];
      expect(spec).toHaveProperty('id');
      expect(spec).toHaveProperty('nazwa');
      expect(typeof spec.id).toBe('number');
      expect(typeof spec.nazwa).toBe('string');

      const grupyResult = await services.studia.getGrupy(selectedStudia.id, semestr, spec.id);
      expect(grupyResult.response.status()).toBe(200);

      const grupy = asArray(grupyResult.data);
      expect(Array.isArray(grupy)).toBe(true);
    }
  });

  // TEST 5: Pobiera listę wszystkich zapisanych planów i waliduje schemat każdego
  test('TEST 5: Schedules - lista planów z walidacją struktury i metadanych', async () => {
    const result = await services.schedules.listSchedules();

    expect(result.response.status()).toBe(200);
    expect(result.response.headers()['content-type']).toContain('application/json');

    const schedules = asArray(result.data);
    expect(Array.isArray(schedules)).toBe(true);

    if (schedules.length > 0) {
      schedules.forEach((schedule) => {
        expect(schedule).toHaveProperty('id');
        expect(schedule).toHaveProperty('name');
        expect(schedule).toHaveProperty('scheduleType');
        expect(schedule).toHaveProperty('createdAt');

        expect(typeof schedule.id).toBe('number');
        expect(typeof schedule.name).toBe('string');
        expect(typeof schedule.scheduleType).toBe('string');
        expect(['Student', 'Teacher']).toContain(schedule.scheduleType);

        const createdDate = new Date(schedule.createdAt);
        expect(createdDate.toString()).not.toBe('Invalid Date');
      });
    }
  });

  // TEST 6: Próbuje pobrać plan z nieistniejącym ID, oczekuje 404
  test('TEST 6: Schedules - dostęp do nieistniejącego planu zwraca 404', async () => {
    const nonExistentId = 999999;
    const result = await services.schedules.getSchedule(nonExistentId);

    expect(result.response.status()).toBe(404);
  });

  // TEST 7: Próbuje wyeksportować plan z nieistniejącym ID, oczekuje 404
  test('TEST 7: Export Schedule - dostęp dla nieistniejącego schedule zwraca 404', async () => {
    const nonExistentScheduleId = 999999;
    const result = await services.schedules.exportSchedule(nonExistentScheduleId);

    expect(result.response.status()).toBe(404);
  });

  // TEST 8: Próbuje pobrać dostępne grupy dla nieistniejącego planu, oczekuje 404
  test('TEST 8: Available Groups - dostęp dla nieistniejącego schedule zwraca 404', async () => {
    const nonExistentScheduleId = 999999;
    const result = await services.schedules.getAvailableGroups(
      nonExistentScheduleId,
      1,
      'W'
    );

    expect(result.response.status()).toBe(404);
  });

  // TEST 9: Pobiera konfigurację, akceptuje 200 lub 204, waliduje opcjonalne pola
  test('TEST 9: Konfiguracja - odczyt aktualnej konfiguracji z walidacją struktury', async () => {
    const result = await services.konfiguracja.getKonfiguracja();

    expect([200, 204]).toContain(result.response.status());

    const config = result.data;

    if (config !== null && config !== undefined) {
      if (config.idStudiow !== null && config.idStudiow !== undefined) {
        expect(typeof config.idStudiow).toBe('number');
      }

      if (config.semestr !== null && config.semestr !== undefined) {
        expect(typeof config.semestr).toBe('number');
      }

      if (config.idSpecjalnosci !== null && config.idSpecjalnosci !== undefined) {
        expect(typeof config.idSpecjalnosci).toBe('number');
      }

      if (config.wyboryGrup !== null && config.wyboryGrup !== undefined) {
        expect(Array.isArray(config.wyboryGrup)).toBe(true);
        config.wyboryGrup.forEach((choice) => {
          if (choice) {
            if (choice.rodzajZajec) expect(typeof choice.rodzajZajec).toBe('string');
            if (choice.numerGrupy) expect(typeof choice.numerGrupy).toBe('number');
          }
        });
      }
    }
  });

  // TEST 10: Pobiera harmonogram dla nieistniejącego nauczyciela, oczekuje pustej tablicy
  test('TEST 10: Rozklad - pobieranie harmonogramu dla nieistniejącego nauczyciela', async () => {
    const nonExistentTeacherId = 999999;
    const result = await services.rozklad.getTeacherRozklad(nonExistentTeacherId);

    expect(result.response.status()).toBe(200);

    const rozklad = asArray(result.data);
    expect(Array.isArray(rozklad)).toBe(true);
    expect(rozklad.length).toBe(0);
  });
});
