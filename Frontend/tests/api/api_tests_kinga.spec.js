import { test, expect } from '@playwright/test';
import { StudiaApiService } from './services/StudiaApiService.js';
import { RozkladApiService } from './services/RozkladApiService.js';
import { NauczycieleApiService } from './services/NauczycieleApiService.js';
import { SchedulesApiService } from './services/SchedulesApiService.js';
import { KonfiguracjaApiService } from './services/KonfiguracjaApiService.js';
import { EksportApiService } from './services/EksportApiService.js';

const BASE_URL = process.env.API_URL || 'http://localhost:5289';

function createUniqueName(prefix) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function createNoOpOverride() {
  return {
    hidden: false,
    overriddenGroup: null,
    forceWeekly: false,
    customDay: null,
    customStartSlot: null,
    customDuration: null,
  };
}

function createHiddenOverride() {
  return {
    hidden: true,
    overriddenGroup: null,
    forceWeekly: false,
    customDay: null,
    customStartSlot: null,
    customDuration: null,
  };
}

function buildStudentSavePayload(ctx, name) {
  return {
    name,
    scheduleType: 'Student',
    configuration: {
      idStudiow: ctx.idStudiow,
      semestr: ctx.semestr,
      idSpecjalnosci: ctx.idSpecjalnosci,
      grupy: ctx.grupy,
      idJezyka: ctx.idJezyka,
    },
  };
}

function buildTeacherSavePayload(ctx, name) {
  return {
    name,
    scheduleType: 'Teacher',
    configuration: {
      idNauczyciela: ctx.idNauczyciela,
    },
  };
}

function buildWyboryGrupPayload(grupyMap) {
  return Object.entries(grupyMap).map(([rodzajZajec, numerGrupy]) => ({
    rodzajZajec,
    numerGrupy,
    idPrzedmiotu: null,
  }));
}

async function createStudentScheduleAndRegister(services, ctx, cleanupRegistry, namePrefix) {
  const payload = buildStudentSavePayload(ctx, createUniqueName(namePrefix));
  const createResult = await services.schedules.createSchedule(payload);

  expect(createResult.response.status()).toBe(201);
  expect(createResult.data).toHaveProperty('id');
  expect(createResult.data).toHaveProperty('name');
  expect(createResult.data.name).toBe(payload.name);

  cleanupRegistry.push(createResult.data.id);

  return {
    payload,
    scheduleId: createResult.data.id,
  };
}

async function createTeacherScheduleAndRegister(services, ctx, cleanupRegistry, namePrefix) {
  const payload = buildTeacherSavePayload(ctx, createUniqueName(namePrefix));
  const createResult = await services.schedules.createSchedule(payload);

  expect(createResult.response.status()).toBe(201);
  expect(createResult.data).toHaveProperty('id');
  expect(createResult.data).toHaveProperty('name');
  expect(createResult.data.name).toBe(payload.name);

  cleanupRegistry.push(createResult.data.id);

  return {
    payload,
    scheduleId: createResult.data.id,
  };
}

async function buildStudentContext(services, skipTest) {
  const studiaResult = await services.studia.getStudia();
  expect(studiaResult.response.status()).toBe(200);
  expect(studiaResult.response.headers()['content-type']).toContain('application/json');

  const studia = asArray(studiaResult.data);
  expect(Array.isArray(studia)).toBe(true);
  if (studia.length === 0) {
    skipTest('Brak kierunkow studiow. Pomijam test.');
    return null;
  }

  const selectedStudia = studia[0];
  expect(typeof selectedStudia.id).toBe('number');
  expect(typeof selectedStudia.nazwa).toBe('string');

  const semestryResult = await services.studia.getSemestry(selectedStudia.id);
  expect(semestryResult.response.status()).toBe(200);
  const semestry = asArray(semestryResult.data);
  expect(Array.isArray(semestry)).toBe(true);
  if (semestry.length === 0) {
    skipTest('Brak semestrow dla wybranego kierunku. Pomijam test.');
    return null;
  }

  const semestr = semestry[0];
  expect(typeof semestr).toBe('number');

  const specjalnosciResult = await services.studia.getSpecjalnosci(selectedStudia.id, semestr);
  expect(specjalnosciResult.response.status()).toBe(200);
  const specjalnosci = asArray(specjalnosciResult.data);
  expect(Array.isArray(specjalnosci)).toBe(true);
  if (specjalnosci.length === 0) {
    skipTest('Brak specjalnosci dla wybranego semestru. Pomijam test.');
    return null;
  }

  const selectedSpecjalnosc = specjalnosci[0];
  expect(typeof selectedSpecjalnosc.id).toBe('number');
  expect(typeof selectedSpecjalnosc.nazwa).toBe('string');

  const grupyResult = await services.studia.getGrupy(selectedStudia.id, semestr, selectedSpecjalnosc.id);
  expect(grupyResult.response.status()).toBe(200);
  const grupyDefinitions = asArray(grupyResult.data);
  expect(Array.isArray(grupyDefinitions)).toBe(true);
  if (grupyDefinitions.length === 0) {
    skipTest('Brak definicji grup dla konfiguracji studenta. Pomijam test.');
    return null;
  }

  const selectedGrupy = {};
  const groupOptionsByType = {};

  for (const groupDefinition of grupyDefinitions) {
    if (!groupDefinition || typeof groupDefinition.rodzaj !== 'string') {
      continue;
    }

    const availableGroups = asArray(groupDefinition.grupy);
    groupOptionsByType[groupDefinition.rodzaj] = availableGroups;

    if (availableGroups.length > 0) {
      selectedGrupy[groupDefinition.rodzaj] = availableGroups[0];
    }
  }

  if (Object.keys(selectedGrupy).length === 0) {
    skipTest('Brak konkretnych numerow grup do wybrania. Pomijam test.');
    return null;
  }

  const rozkladResult = await services.rozklad.getRozklad(
    selectedStudia.id,
    semestr,
    selectedSpecjalnosc.id
  );
  expect(rozkladResult.response.status()).toBe(200);
  const rozklad = asArray(rozkladResult.data);
  expect(Array.isArray(rozklad)).toBe(true);
  if (rozklad.length === 0) {
    skipTest('Brak wpisow rozkladu dla konfiguracji studenta. Pomijam test.');
    return null;
  }

  const jezyki = Array.from(
    new Set(
      rozklad
        .filter((entry) => entry.rodzaj === 'J' && typeof entry.idPrzedmiotu === 'number')
        .map((entry) => entry.idPrzedmiotu)
    )
  );
  const idJezyka = jezyki.length > 0 ? jezyki[0] : null;

  const filteredEntries = rozklad.filter((entry) => {
    const wybranaGrupa = selectedGrupy[entry.rodzaj];
    if (wybranaGrupa !== undefined && entry.grupa !== wybranaGrupa) {
      return false;
    }

    if (entry.rodzaj === 'J' && idJezyka !== null && entry.idPrzedmiotu !== idJezyka) {
      return false;
    }

    return true;
  });

  if (filteredEntries.length === 0) {
    skipTest('Po filtracji grup/jazyka brak wpisow planu. Pomijam test.');
    return null;
  }

  const sampleEntry = filteredEntries[0];
  expect(typeof sampleEntry.idPrzedmiotu).toBe('number');
  expect(typeof sampleEntry.rodzaj).toBe('string');
  expect(typeof sampleEntry.grupa).toBe('number');

  return {
    studia,
    semestry,
    specjalnosci,
    grupyDefinitions,
    rozklad,
    filteredEntries,
    sampleEntry,
    idStudiow: selectedStudia.id,
    semestr,
    idSpecjalnosci: selectedSpecjalnosc.id,
    grupy: selectedGrupy,
    idJezyka,
    groupOptionsByType,
  };
}

async function buildTeacherContext(services, skipTest) {
  const nauczycieleResult = await services.nauczyciele.getNauczyciele();
  expect(nauczycieleResult.response.status()).toBe(200);
  expect(nauczycieleResult.response.headers()['content-type']).toContain('application/json');

  const nauczyciele = asArray(nauczycieleResult.data);
  expect(Array.isArray(nauczyciele)).toBe(true);
  if (nauczyciele.length === 0) {
    skipTest('Brak nauczycieli w systemie. Pomijam test.');
    return null;
  }

  let selectedTeacher = null;
  let teacherRozklad = [];
  let teacherRozkladResponse = null;

  for (const nauczyciel of nauczyciele) {
    const rozkladResult = await services.rozklad.getTeacherRozklad(nauczyciel.id);
    expect(rozkladResult.response.status()).toBe(200);
    const candidate = asArray(rozkladResult.data);
    if (candidate.length > 0) {
      selectedTeacher = nauczyciel;
      teacherRozklad = candidate;
      teacherRozkladResponse = rozkladResult.response;
      break;
    }
  }

  if (!selectedTeacher) {
    skipTest('Brak nauczyciela z niepustym rozkladem. Pomijam test.');
    return null;
  }

  expect(teacherRozkladResponse.status()).toBe(200);
  expect(typeof selectedTeacher.id).toBe('number');
  expect(typeof selectedTeacher.nazwa).toBe('string');

  const konsultacjeResult = await services.rozklad.getTeacherKonsultacje(selectedTeacher.id);
  expect(konsultacjeResult.response.status()).toBe(200);
  const konsultacje = asArray(konsultacjeResult.data);
  expect(Array.isArray(konsultacje)).toBe(true);

  const sampleEntry = teacherRozklad[0];
  expect(typeof sampleEntry.idPrzedmiotu).toBe('number');
  expect(typeof sampleEntry.rodzaj).toBe('string');

  return {
    nauczyciele,
    konsultacje,
    rozklad: teacherRozklad,
    sampleEntry,
    idNauczyciela: selectedTeacher.id,
    nauczyciel: selectedTeacher,
  };
}

test.describe.serial('Testy API - Kinga (POM E2E)', () => {
  let services;
  let cleanupRegistry;

  test.beforeEach(async ({ request }) => {
    services = {
      studia: new StudiaApiService(request, BASE_URL),
      rozklad: new RozkladApiService(request, BASE_URL),
      nauczyciele: new NauczycieleApiService(request, BASE_URL),
      schedules: new SchedulesApiService(request, BASE_URL),
      konfiguracja: new KonfiguracjaApiService(request, BASE_URL),
      eksport: new EksportApiService(request, BASE_URL),
    };

    cleanupRegistry = [];
  });

  test.afterEach(async () => {
    for (const scheduleId of cleanupRegistry.reverse()) {
      try {
        await services.schedules.deleteSchedule(scheduleId);
      } catch (error) {
      }
    }
  });

  // test1 odkrywanie_planu_studenta_e2e
  test('Odkrywanie planu studenta E2E - lancuch studia -> semestry -> specjalnosci -> grupy -> rozklad', async () => {
    const ctx = await buildStudentContext(services, (reason) => test.skip(true, reason));
    if (!ctx) return;

    expect(ctx.studia.length).toBeGreaterThan(0);
    expect(ctx.semestry).toContain(ctx.semestr);
    expect(ctx.specjalnosci.some((spec) => spec.id === ctx.idSpecjalnosci)).toBe(true);
    expect(Object.keys(ctx.grupy).length).toBeGreaterThan(0);
    expect(ctx.filteredEntries.length).toBeGreaterThan(0);
    expect(ctx.sampleEntry.idStudiow).toBe(ctx.idStudiow);
    expect(ctx.sampleEntry.semestr).toBe(ctx.semestr);
    expect(ctx.sampleEntry.idSpecjalnosci).toBe(ctx.idSpecjalnosci);
  });

  // test2 plan_studenta_round_trip
  test('Plan studenta round-trip - utworzenie i odczyt pelnej konfiguracji', async () => {
    const ctx = await buildStudentContext(services, (reason) => test.skip(true, reason));
    if (!ctx) return;

    const created = await createStudentScheduleAndRegister(
      services,
      ctx,
      cleanupRegistry,
      'Kinga Student Roundtrip'
    );

    const detailResult = await services.schedules.getSchedule(created.scheduleId);
    expect(detailResult.response.status()).toBe(200);
    expect(detailResult.data.id).toBe(created.scheduleId);
    expect(detailResult.data.name).toBe(created.payload.name);
    expect(detailResult.data.scheduleType).toBe('Student');
    expect(detailResult.data.configuration.idStudiow).toBe(ctx.idStudiow);
    expect(detailResult.data.configuration.semestr).toBe(ctx.semestr);
    expect(detailResult.data.configuration.idSpecjalnosci).toBe(ctx.idSpecjalnosci);
    expect(detailResult.data.configuration.grupy).toEqual(ctx.grupy);
    expect(detailResult.data.configuration.idJezyka).toBe(ctx.idJezyka);
    expect(Array.isArray(detailResult.data.updatedKeys)).toBe(true);
    expect(new Date(detailResult.data.createdAt).toString()).not.toBe('Invalid Date');
  });

  // test3 dostepne_grupy_dla_studenta_e2e
  test('Dostepne grupy dla studenta E2E - weryfikacja sali i czasu', async () => {
    const ctx = await buildStudentContext(services, (reason) => test.skip(true, reason));
    if (!ctx) return;

    const created = await createStudentScheduleAndRegister(
      services,
      ctx,
      cleanupRegistry,
      'Kinga Student Available Groups'
    );

    const detailResult = await services.schedules.getSchedule(created.scheduleId);
    expect(detailResult.response.status()).toBe(200);
    expect(detailResult.data.scheduleType).toBe('Student');

    const availableGroupsResult = await services.schedules.getAvailableGroups(
      created.scheduleId,
      ctx.sampleEntry.idPrzedmiotu,
      ctx.sampleEntry.rodzaj
    );
    expect(availableGroupsResult.response.status()).toBe(200);

    const groups = asArray(availableGroupsResult.data);
    expect(Array.isArray(groups)).toBe(true);
    if (groups.length === 0) {
      test.skip('Brak grup zwroconych dla sample entry. Pomijam test.');
      return;
    }

    const first = groups[0];
    expect(first).toHaveProperty('grupa');
    expect(first).toHaveProperty('sala');
    expect(first).toHaveProperty('dzien');
    expect(first).toHaveProperty('godzina');
    expect(first).toHaveProperty('czas');
    expect(first).toHaveProperty('dzienNazwa');
    expect(groups.some((group) => group.grupa === ctx.sampleEntry.grupa)).toBe(true);
  });

  // test4 trwalosc_nadpisan
  test('Trwalosc nadpisan - zapis realnego override i usuniecie no-op', async () => {
    const ctx = await buildStudentContext(services, (reason) => test.skip(true, reason));
    if (!ctx) return;

    const created = await createStudentScheduleAndRegister(
      services,
      ctx,
      cleanupRegistry,
      'Kinga Overrides'
    );

    const realKey = `${ctx.sampleEntry.idPrzedmiotu}_${ctx.sampleEntry.rodzaj}_${ctx.sampleEntry.dzien}_${ctx.sampleEntry.godzina}_${ctx.sampleEntry.tydzien}_${ctx.sampleEntry.grupa}`;
    const noOpKey = `${realKey}_noop`;
    const ignoredConflictPair = `${realKey}--${noOpKey}`;

    const saveOverridesResult = await services.schedules.saveOverrides(
      created.scheduleId,
      {
        [realKey]: createHiddenOverride(),
        [noOpKey]: createNoOpOverride(),
      },
      [ignoredConflictPair]
    );

    expect(saveOverridesResult.response.status()).toBe(200);
    expect(saveOverridesResult.data.saved).toBe(true);
    expect(saveOverridesResult.data.count).toBe(1);

    const detailResult = await services.schedules.getSchedule(created.scheduleId);
    expect(detailResult.response.status()).toBe(200);
    expect(detailResult.data.overrides).toHaveProperty(realKey);
    expect(detailResult.data.overrides).not.toHaveProperty(noOpKey);
    expect(detailResult.data.overrides[realKey].hidden).toBe(true);
    expect(Array.isArray(detailResult.data.ignoredConflictIds)).toBe(true);
    expect(detailResult.data.ignoredConflictIds).toContain(ignoredConflictPair);
  });

  // test5 eksport_ics_planu_studenta
  test('Eksport ICS planu studenta - zwraca plik .ics z zawartoscia kalendarza', async () => {
    const ctx = await buildStudentContext(services, (reason) => test.skip(true, reason));
    if (!ctx) return;

    const created = await createStudentScheduleAndRegister(
      services,
      ctx,
      cleanupRegistry,
      'Kinga Export Student'
    );

    const detailResult = await services.schedules.getSchedule(created.scheduleId);
    expect(detailResult.response.status()).toBe(200);
    expect(detailResult.data.scheduleType).toBe('Student');

    const exportResult = await services.schedules.exportSchedule(created.scheduleId);
    expect(exportResult.response.status()).toBe(200);
    expect(exportResult.response.headers()['content-type']).toContain('text/calendar');

    const contentDisposition = exportResult.response.headers()['content-disposition'] || '';
    expect(contentDisposition.toLowerCase()).toContain('.ics');
    expect(exportResult.text).toContain('BEGIN:VCALENDAR');
    expect(exportResult.text).toContain('BEGIN:VEVENT');
    expect(exportResult.text).toContain('X-WR-CALNAME');
  });

  // test6 symulacja_aktualizacji_oznacza_zmiany
  test('Symulacja aktualizacji oznacza zmiany - updatedKeys nie powinno byc puste', async () => {
    const ctx = await buildStudentContext(services, (reason) => test.skip(true, reason));
    if (!ctx) return;

    const created = await createStudentScheduleAndRegister(
      services,
      ctx,
      cleanupRegistry,
      'Kinga Simulate Update'
    );

    const confirmResult = await services.schedules.confirmSchedule(created.scheduleId);
    expect(confirmResult.response.status()).toBe(200);
    expect(confirmResult.data.confirmed).toBe(true);

    const simulateResult = await services.schedules.simulateUpdate(created.scheduleId);
    expect(simulateResult.response.status()).toBe(200);
    expect(simulateResult.data.simulated).toBe(true);
    expect(simulateResult.data.entriesAffected).toBeGreaterThan(0);

    const detailResult = await services.schedules.getSchedule(created.scheduleId);
    expect(detailResult.response.status()).toBe(200);
    expect(Array.isArray(detailResult.data.updatedKeys)).toBe(true);
    expect(detailResult.data.updatedKeys.length).toBeGreaterThan(0);
  });

  // test7 potwierdzenie_czysci_updatedkeys
  test('Potwierdzenie czysci updatedKeys - po confirm brak oczekujacych zmian', async () => {
    const ctx = await buildStudentContext(services, (reason) => test.skip(true, reason));
    if (!ctx) return;

    const created = await createStudentScheduleAndRegister(
      services,
      ctx,
      cleanupRegistry,
      'Kinga Confirm Updates'
    );

    const simulateResult = await services.schedules.simulateUpdate(created.scheduleId);
    expect(simulateResult.response.status()).toBe(200);
    expect(simulateResult.data.simulated).toBe(true);

    const detailAfterSimulate = await services.schedules.getSchedule(created.scheduleId);
    expect(detailAfterSimulate.response.status()).toBe(200);
    expect(Array.isArray(detailAfterSimulate.data.updatedKeys)).toBe(true);
    expect(detailAfterSimulate.data.updatedKeys.length).toBeGreaterThan(0);

    const confirmResult = await services.schedules.confirmSchedule(created.scheduleId);
    expect(confirmResult.response.status()).toBe(200);
    expect(confirmResult.data.confirmed).toBe(true);

    const detailAfterConfirm = await services.schedules.getSchedule(created.scheduleId);
    expect(detailAfterConfirm.response.status()).toBe(200);
    expect(Array.isArray(detailAfterConfirm.data.updatedKeys)).toBe(true);
    expect(detailAfterConfirm.data.updatedKeys.length).toBe(0);
  });

  // test8 przeplyw_nauczyciela_e2e
  test('Przeplyw nauczyciela E2E - nauczyciele + rozklad + konsultacje + round-trip planu', async () => {
    const ctx = await buildTeacherContext(services, (reason) => test.skip(true, reason));
    if (!ctx) return;

    const created = await createTeacherScheduleAndRegister(
      services,
      ctx,
      cleanupRegistry,
      'Kinga Teacher Flow'
    );

    const listResult = await services.schedules.listSchedules();
    expect(listResult.response.status()).toBe(200);
    expect(Array.isArray(listResult.data)).toBe(true);
    expect(listResult.data.some((schedule) => schedule.id === created.scheduleId)).toBe(true);

    const detailResult = await services.schedules.getSchedule(created.scheduleId);
    expect(detailResult.response.status()).toBe(200);
    expect(detailResult.data.id).toBe(created.scheduleId);
    expect(detailResult.data.name).toBe(created.payload.name);
    expect(detailResult.data.scheduleType).toBe('Teacher');
    expect(detailResult.data.configuration.idNauczyciela).toBe(ctx.idNauczyciela);
    expect(ctx.rozklad.length).toBeGreaterThan(0);
    expect(Array.isArray(ctx.konsultacje)).toBe(true);
  });

  // test9 dostepne_grupy_dla_planu_nauczyciela
  test('Dostepne grupy dla planu nauczyciela - endpoint zwraca pusta liste', async () => {
    const ctx = await buildTeacherContext(services, (reason) => test.skip(true, reason));
    if (!ctx) return;

    const created = await createTeacherScheduleAndRegister(
      services,
      ctx,
      cleanupRegistry,
      'Kinga Teacher Available Groups'
    );

    const detailResult = await services.schedules.getSchedule(created.scheduleId);
    expect(detailResult.response.status()).toBe(200);
    expect(detailResult.data.scheduleType).toBe('Teacher');

    const availableGroupsResult = await services.schedules.getAvailableGroups(
      created.scheduleId,
      ctx.sampleEntry.idPrzedmiotu,
      ctx.sampleEntry.rodzaj
    );
    expect(availableGroupsResult.response.status()).toBe(200);

    const groups = asArray(availableGroupsResult.data);
    expect(Array.isArray(groups)).toBe(true);
    expect(groups.length).toBe(0);
    expect(typeof ctx.sampleEntry.idPrzedmiotu).toBe('number');
    expect(typeof ctx.sampleEntry.rodzaj).toBe('string');
  });

  // test10 konfiguracja_nadpisanie_eksport_globalny
  test('Konfiguracja + nadpisanie + eksport globalny - pelny cykl zycia z cleanupem', async () => {
    const originalConfigResult = await services.konfiguracja.getKonfiguracja();
    expect(originalConfigResult.response.status()).toBe(200);

    const originalConfig = originalConfigResult.data;
    const ctx = await buildStudentContext(services, (reason) => test.skip(true, reason));
    if (!ctx) return;

    const newConfigPayload = {
      idStudiow: ctx.idStudiow,
      semestr: ctx.semestr,
      idSpecjalnosci: ctx.idSpecjalnosci,
      wyboryGrup: buildWyboryGrupPayload(ctx.grupy),
    };

    try {
      const saveConfigResult = await services.konfiguracja.saveKonfiguracja(newConfigPayload);
      expect(saveConfigResult.response.status()).toBe(200);
      expect(saveConfigResult.data).toHaveProperty('id');

      const configAfterSave = await services.konfiguracja.getKonfiguracja();
      expect(configAfterSave.response.status()).toBe(200);
      expect(configAfterSave.data).not.toBeNull();
      expect(configAfterSave.data.idStudiow).toBe(ctx.idStudiow);
      expect(configAfterSave.data.semestr).toBe(ctx.semestr);
      expect(configAfterSave.data.idSpecjalnosci).toBe(ctx.idSpecjalnosci);
      expect(Array.isArray(configAfterSave.data.wyboryGrup)).toBe(true);
      expect(configAfterSave.data.wyboryGrup.length).toBeGreaterThan(0);

      const optionsForSampleType = ctx.groupOptionsByType[ctx.sampleEntry.rodzaj] || [];
      const alternateGroup =
        optionsForSampleType.find((groupNo) => groupNo !== ctx.sampleEntry.grupa) ?? ctx.sampleEntry.grupa;

      const addOverrideResult = await services.konfiguracja.addNadpisanie({
        rodzajZajec: ctx.sampleEntry.rodzaj,
        numerGrupy: alternateGroup,
        idPrzedmiotu: ctx.sampleEntry.idPrzedmiotu,
      });
      expect(addOverrideResult.response.status()).toBe(200);

      const configAfterOverride = await services.konfiguracja.getKonfiguracja();
      expect(configAfterOverride.response.status()).toBe(200);
      expect(Array.isArray(configAfterOverride.data.wyboryGrup)).toBe(true);

      const subjectOverride = configAfterOverride.data.wyboryGrup.find(
        (groupChoice) =>
          groupChoice.rodzajZajec === ctx.sampleEntry.rodzaj
          && groupChoice.idPrzedmiotu === ctx.sampleEntry.idPrzedmiotu
      );

      expect(subjectOverride).toBeDefined();
      expect(typeof subjectOverride.id).toBe('number');
      expect(subjectOverride.numerGrupy).toBe(alternateGroup);

      const deleteOverrideResult = await services.konfiguracja.deleteNadpisanie(subjectOverride.id);
      expect(deleteOverrideResult.response.status()).toBe(200);

      const configAfterDelete = await services.konfiguracja.getKonfiguracja();
      expect(configAfterDelete.response.status()).toBe(200);
      expect(
        configAfterDelete.data.wyboryGrup.some(
          (groupChoice) =>
            groupChoice.rodzajZajec === ctx.sampleEntry.rodzaj
            && groupChoice.idPrzedmiotu === ctx.sampleEntry.idPrzedmiotu
        )
      ).toBe(false);

      const exportResult = await services.eksport.exportGlobalIcs();
      expect(exportResult.response.status()).toBe(200);
      expect(exportResult.response.headers()['content-type']).toContain('text/calendar');
      expect(exportResult.text).toContain('BEGIN:VCALENDAR');
      expect(exportResult.text).toContain('BEGIN:VEVENT');
    } finally {
      if (originalConfig && typeof originalConfig.idStudiow === 'number') {
        try {
          await services.konfiguracja.saveKonfiguracja({
            idStudiow: originalConfig.idStudiow,
            semestr: originalConfig.semestr,
            idSpecjalnosci: originalConfig.idSpecjalnosci,
            wyboryGrup: asArray(originalConfig.wyboryGrup).map((groupChoice) => ({
              rodzajZajec: groupChoice.rodzajZajec,
              numerGrupy: groupChoice.numerGrupy,
              idPrzedmiotu: groupChoice.idPrzedmiotu,
            })),
          });
        } catch (error) {
        }
      }
    }
  });
});
