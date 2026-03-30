import { test, expect } from '@playwright/test';
import { StudiaApiService } from './services/StudiaApiService.js';
import { RozkladApiService } from './services/RozkladApiService.js';
import { SchedulesApiService } from './services/SchedulesApiService.js';
import { NauczycieleApiService } from './services/NauczycieleApiService.js';
import { KonfiguracjaApiService } from './services/KonfiguracjaApiService.js';
import { EksportApiService } from './services/EksportApiService.js';

const BASE_URL = process.env.API_URL || 'http://localhost:5289';

function asArray(v) { return Array.isArray(v) ? v : []; }
function createUniqueName(prefix) { return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`; }

test.describe.serial('testy api', () => {
  let services;
  let createdScheduleIds = [];

  test.beforeEach(async ({ request }) => {
    services = {
      studia: new StudiaApiService(request, BASE_URL),
      rozklad: new RozkladApiService(request, BASE_URL),
      schedules: new SchedulesApiService(request, BASE_URL),
      nauczyciele: new NauczycieleApiService(request, BASE_URL),
      konfiguracja: new KonfiguracjaApiService(request, BASE_URL),
      eksport: new EksportApiService(request, BASE_URL),
    };
    createdScheduleIds = [];
  });

  test.afterEach(async () => {
    for (const scheduleId of createdScheduleIds.reverse()) {
      try { await services.schedules.deleteSchedule(scheduleId); } catch (e) {}
    }
  });

  // 1. weryfikuje integralność struktury studia-semestr-specjalność-grupa-rozkład
  test('Filtrowanie hierarchiczne i integralność danych', async () => {
    const studiaList = asArray((await services.studia.getStudia()).data);
    if (studiaList.length === 0) {
      test.skip();
      return;
    }

    const studiumId = studiaList[0].id;
    const semestryList = asArray((await services.studia.getSemestry(studiumId)).data);
    expect(semestryList.length).toBeGreaterThan(0);

    const wybranySemestr = semestryList[0];
    const specjalnosciList = asArray((await services.studia.getSpecjalnosci(studiumId, wybranySemestr)).data);
    expect(specjalnosciList.length).toBeGreaterThan(0);

    const specjalnoscId = specjalnosciList[0].id;
    const grupyList = asArray((await services.studia.getGrupy(studiumId, wybranySemestr, specjalnoscId)).data);
    expect(grupyList.length).toBeGreaterThan(0);
    grupyList.forEach(grupaDef => {
      if (grupaDef.grupy && grupaDef.grupy.length > 0) {
        const uniqueGroups = new Set(grupaDef.grupy);
        expect(grupaDef.grupy.length).toBe(uniqueGroups.size);
      }
    });

    const rozkladList = asArray((await services.rozklad.getRozklad(studiumId, wybranySemestr, specjalnoscId)).data);
    expect(rozkladList.length).toBeGreaterThan(0);
    rozkladList.forEach(rozkladEntry => {
      expect(rozkladEntry.idStudiow).toBe(studiumId);
      expect(rozkladEntry.semestr).toBe(wybranySemestr);
      expect(rozkladEntry.idSpecjalnosci).toBe(specjalnoscId);
    });

    const allGrupyInRozklad = new Set(rozkladList.map(rozkladEntry => rozkladEntry.grupa));
    let foundOverlap = false;
    grupyList.forEach(grupaDef => {
      if (grupaDef.grupy && grupaDef.grupy.some(groupNumber => allGrupyInRozklad.has(groupNumber))) foundOverlap = true;
    });
    expect(foundOverlap).toBe(true);
  });

  // 2. sprawdza pełny cykl życia planu: tworzenie, nadpisywanie, listowanie i usuwanie
  test('Cykl życia planu zajęć', async () => {
    const studiaList = asArray((await services.studia.getStudia()).data);
    if (studiaList.length === 0) { test.skip(); return; }
    const studiumId = studiaList[0].id;
    const semestryList = asArray((await services.studia.getSemestry(studiumId)).data);
    if (semestryList.length === 0) { test.skip(); return; }
    const wybranySemestr = semestryList[0];
    const specjalnosciList = asArray((await services.studia.getSpecjalnosci(studiumId, wybranySemestr)).data)[0];
    if (!specjalnosciList) { test.skip(); return; }
    const rozkladList = asArray((await services.rozklad.getRozklad(studiumId, wybranySemestr, specjalnosciList.id)).data);
    if (rozkladList.length === 0) { test.skip(); return; }

    const createScheduleRes = await services.schedules.createSchedule({
      name: createUniqueName('Patrycja'),
      scheduleType: 'Student',
      configuration: { idStudiow: studiumId, semestr: wybranySemestr, idSpecjalnosci: specjalnosciList.id, grupy: {}, idJezyka: null },
    });
    expect(createScheduleRes.response.status()).toBe(201);
    const scheduleId = createScheduleRes.data.id;
    createdScheduleIds.push(scheduleId);

    const schedulesListRes = await services.schedules.listSchedules();
    expect(schedulesListRes.data.some(sc => sc.id === scheduleId)).toBe(true);

    const rozkladEntry = rozkladList[0];
    const overrideKey = `${rozkladEntry.idPrzedmiotu}_${rozkladEntry.rodzaj}_${rozkladEntry.dzien}_${rozkladEntry.godzina}_${rozkladEntry.tydzien}_${rozkladEntry.grupa}`;
    await services.schedules.saveOverrides(scheduleId, {
      [overrideKey]: { hidden: true, overriddenGroup: null, forceWeekly: false, customDay: null, customStartSlot: null, customDuration: null },
    });
    const scheduleDetails = await services.schedules.getSchedule(scheduleId);
    expect(scheduleDetails.data.overrides).toHaveProperty(overrideKey);

    await services.schedules.deleteSchedule(scheduleId);
    createdScheduleIds = createdScheduleIds.filter(i => i !== scheduleId);
    const scheduleDetailsAfterDelete = await services.schedules.getSchedule(scheduleId);
    expect(scheduleDetailsAfterDelete.response.status()).toBe(404);

    const schedulesListAfterDelete = await services.schedules.listSchedules();
    expect(schedulesListAfterDelete.data.some(sc => sc.id === scheduleId)).toBe(false);
  });

  // 3. testuje zapisywanie wielu nadpisań i ignorowanych konfliktów jednocześnie
  test('Zapis wielu nadpisań i obsługa konfliktów', async () => {
    const studiaList = asArray((await services.studia.getStudia()).data);
    if (studiaList.length === 0) { test.skip(); return; }
    const studiumId = studiaList[0].id;
    const semestryList = asArray((await services.studia.getSemestry(studiumId)).data)[0];
    if (!semestryList) { test.skip(); return; }
    const specjalnosciList = asArray((await services.studia.getSpecjalnosci(studiumId, semestryList)).data)[0];
    if (!specjalnosciList) { test.skip(); return; }
    const rozkladList = asArray((await services.rozklad.getRozklad(studiumId, semestryList, specjalnosciList.id)).data);
    if (rozkladList.length < 2) { test.skip(); return; }

    const createScheduleRes = await services.schedules.createSchedule({
      name: createUniqueName('Override'),
      scheduleType: 'Student',
      configuration: { idStudiow: studiumId, semestr: semestryList, idSpecjalnosci: specjalnosciList.id, grupy: {}, idJezyka: null },
    });
    const scheduleId = createScheduleRes.data.id;
    createdScheduleIds.push(scheduleId);

    const initialScheduleDetails = await services.schedules.getSchedule(scheduleId);
    expect((initialScheduleDetails.data.overrides || {})).toEqual({});

    const rozkladEntry1 = rozkladList[0];
    const overrideKey1 = `${rozkladEntry1.idPrzedmiotu}_${rozkladEntry1.rodzaj}_${rozkladEntry1.dzien}_${rozkladEntry1.godzina}_${rozkladEntry1.tydzien}_${rozkladEntry1.grupa}`;
    
    let rozkladEntry2 = rozkladList[1];
    let overrideKey2 = `${rozkladEntry2.idPrzedmiotu}_${rozkladEntry2.rodzaj}_${rozkladEntry2.dzien}_${rozkladEntry2.godzina}_${rozkladEntry2.tydzien}_${rozkladEntry2.grupa}`;
    
    if (overrideKey1 === overrideKey2) {
      const distinctRozkladEntry = rozkladList.find(e => `${e.idPrzedmiotu}_${e.rodzaj}_${e.dzien}_${e.godzina}_${e.tydzien}_${e.grupa}` !== overrideKey1);
      if (distinctRozkladEntry) {
        rozkladEntry2 = distinctRozkladEntry;
        overrideKey2 = `${rozkladEntry2.idPrzedmiotu}_${rozkladEntry2.rodzaj}_${rozkladEntry2.dzien}_${rozkladEntry2.godzina}_${rozkladEntry2.tydzien}_${rozkladEntry2.grupa}`;
      } else {
        test.skip();
        return;
      }
    }

    const saveOverridesRes = await services.schedules.saveOverrides(scheduleId, {
      [overrideKey1]: { hidden: true, overriddenGroup: null, forceWeekly: false, customDay: null, customStartSlot: null, customDuration: null },
      [overrideKey2]: { hidden: false, overriddenGroup: 3, forceWeekly: true, customDay: 2, customStartSlot: 5, customDuration: 1 },
    });
    expect(saveOverridesRes.response.status()).toBe(200);

    const scheduleDetailsAfterOverride = await services.schedules.getSchedule(scheduleId);
    expect(scheduleDetailsAfterOverride.data.overrides[overrideKey1].hidden).toBe(true);
    expect(scheduleDetailsAfterOverride.data.overrides[overrideKey2].overriddenGroup).toBe(3);
    expect(scheduleDetailsAfterOverride.data.overrides[overrideKey2].customDay).toBe(2);

    expect(scheduleDetailsAfterOverride.data).toHaveProperty('id');
    expect(scheduleDetailsAfterOverride.data).toHaveProperty('createdAt');
    expect(Array.isArray(scheduleDetailsAfterOverride.data.updatedKeys)).toBe(true);

    await services.schedules.saveOverrides(scheduleId, scheduleDetailsAfterOverride.data.overrides, ['conflict-a', 'conflict-b']);
    const scheduleDetailsAfterConflict = await services.schedules.getSchedule(scheduleId);
    expect(scheduleDetailsAfterConflict.data.ignoredConflictIds).toContain('conflict-a');
    expect(Object.keys(scheduleDetailsAfterConflict.data.overrides).length).toBe(2);
  });

  // 4. sprawdza, czy usunięcie jednego planu nie wpływa na inne istniejące plany
  test('Izolacja usuwania kaskadowego', async () => {
    const studiaList = asArray((await services.studia.getStudia()).data);
    if (studiaList.length === 0) { test.skip(); return; }
    const studiumId = studiaList[0].id;
    const semestryList = asArray((await services.studia.getSemestry(studiumId)).data)[0];
    if (!semestryList) { test.skip(); return; }
    const specjalnosciList = asArray((await services.studia.getSpecjalnosci(studiumId, semestryList)).data)[0];
    if (!specjalnosciList) { test.skip(); return; }
    const rozkladList = asArray((await services.rozklad.getRozklad(studiumId, semestryList, specjalnosciList.id)).data);
    if (rozkladList.length === 0) { test.skip(); return; }

    const createScheduleRes1 = await services.schedules.createSchedule({
      name: createUniqueName('Del1'),
      scheduleType: 'Student',
      configuration: { idStudiow: studiumId, semestr: semestryList, idSpecjalnosci: specjalnosciList.id, grupy: {}, idJezyka: null },
    });
    const scheduleId1 = createScheduleRes1.data.id;
    createdScheduleIds.push(scheduleId1);

    const createScheduleRes2 = await services.schedules.createSchedule({
      name: createUniqueName('Del2'),
      scheduleType: 'Student',
      configuration: { idStudiow: studiumId, semestr: semestryList, idSpecjalnosci: specjalnosciList.id, grupy: {}, idJezyka: null },
    });
    const scheduleId2 = createScheduleRes2.data.id;
    createdScheduleIds.push(scheduleId2);

    const initialSchedulesList = await services.schedules.listSchedules();
    expect(initialSchedulesList.data.some(sc => sc.id === scheduleId1)).toBe(true);
    expect(initialSchedulesList.data.some(sc => sc.id === scheduleId2)).toBe(true);

    const rozkladEntry = rozkladList[0];
    const overrideKey = `${rozkladEntry.idPrzedmiotu}_${rozkladEntry.rodzaj}_${rozkladEntry.dzien}_${rozkladEntry.godzina}_${rozkladEntry.tydzien}_${rozkladEntry.grupa}`;
    await services.schedules.saveOverrides(scheduleId1, {
      [overrideKey]: { hidden: true, overriddenGroup: null, forceWeekly: false, customDay: null, customStartSlot: null, customDuration: null },
    });
    const scheduleDetails1 = await services.schedules.getSchedule(scheduleId1);
    expect(scheduleDetails1.data.overrides).toHaveProperty(overrideKey);

    const deleteRes = await services.schedules.deleteSchedule(scheduleId1);
    expect([200, 202, 204]).toContain(deleteRes.response.status());
    createdScheduleIds = createdScheduleIds.filter(i => i !== scheduleId1);

    const scheduleDetailsAfterDelete = await services.schedules.getSchedule(scheduleId1);
    expect(scheduleDetailsAfterDelete.response.status()).toBe(404);

    const schedulesListAfterDelete = await services.schedules.listSchedules();
    expect(schedulesListAfterDelete.data.some(sc => sc.id === scheduleId1)).toBe(false);
    expect(schedulesListAfterDelete.data.some(sc => sc.id === scheduleId2)).toBe(true);
  });

  // 5. upewnia się, że wybrane definicje grup poprawnie zapisują się w konfiguracji
  test('Zapis i walidacja matrycy wyboru grup', async () => {
    const studiaList = asArray((await services.studia.getStudia()).data);
    if (studiaList.length === 0) { test.skip(); return; }
    const studiumId = studiaList[0].id;
    const semestryList = asArray((await services.studia.getSemestry(studiumId)).data)[0];
    if (!semestryList) { test.skip(); return; }
    const specjalnosciList = asArray((await services.studia.getSpecjalnosci(studiumId, semestryList)).data)[0];
    if (!specjalnosciList) { test.skip(); return; }
    const rozkladList = asArray((await services.rozklad.getRozklad(studiumId, semestryList, specjalnosciList.id)).data);
    if (rozkladList.length === 0) { test.skip(); return; }

    const grupyList = asArray((await services.studia.getGrupy(studiumId, semestryList, specjalnosciList.id)).data);
    expect(grupyList.length).toBeGreaterThan(0);
    grupyList.forEach(grupaDef => {
      if (grupaDef.grupy && grupaDef.grupy.length > 1) {
        const sorted = [...grupaDef.grupy].sort((a, b) => a - b);
        expect(grupaDef.grupy).toEqual(sorted);
      }
    });

    const selectedGroupsMap = {};
    grupyList.forEach(grupaDef => {
      if (grupaDef.grupy && grupaDef.grupy.length > 0) selectedGroupsMap[grupaDef.rodzaj] = grupaDef.grupy[0];
    });

    const createScheduleRes = await services.schedules.createSchedule({
      name: createUniqueName('Matrix'),
      scheduleType: 'Student',
      configuration: { idStudiow: studiumId, semestr: semestryList, idSpecjalnosci: specjalnosciList.id, grupy: selectedGroupsMap, idJezyka: null },
    });
    const scheduleId = createScheduleRes.data.id;
    createdScheduleIds.push(scheduleId);

    const scheduleDetails = await services.schedules.getSchedule(scheduleId);
    expect(scheduleDetails.data.configuration.grupy).toEqual(selectedGroupsMap);

    for (const rodzaj of Object.keys(selectedGroupsMap)) {
      const sampleZajecia = rozkladList.find(e => e.rodzaj === rodzaj);
      if (sampleZajecia) {
        const availableGroupsRes = await services.schedules.getAvailableGroups(scheduleId, sampleZajecia.idPrzedmiotu, rodzaj);
        expect(availableGroupsRes.response.status()).toBe(200);
        expect(Array.isArray(availableGroupsRes.data)).toBe(true);

        if (availableGroupsRes.data.length > 0) {
          const selected = selectedGroupsMap[rodzaj];
          expect(availableGroupsRes.data.some(availableGroupItem => availableGroupItem.grupa === selected)).toBe(true);
        }
      }
    }
  });

  // 6. sprawdza zachowanie API przy odpytywaniu o fałszywe id
  test('Obsługa nieistniejących parametrów', async () => {
    const fakeId = -999999;

    const studiaRes = await services.studia.getStudia();
    expect(studiaRes.response.status()).toBe(200);
    expect(Array.isArray(studiaRes.data)).toBe(true);

    const semestryRes = await services.studia.getSemestry(fakeId);
    expect(semestryRes.response.status()).toBe(200);
    expect(semestryRes.data.length).toBe(0);

    const specjalnosciRes = await services.studia.getSpecjalnosci(fakeId, 1);
    expect(specjalnosciRes.response.status()).toBe(200);
    expect(Array.isArray(specjalnosciRes.data)).toBe(true);
    expect(specjalnosciRes.data.length).toBe(0);

    const grupyRes = await services.studia.getGrupy(fakeId, 1, 1);
    expect(grupyRes.response.status()).toBe(200);
    expect(Array.isArray(grupyRes.data)).toBe(true);

    const rozkladRes = await services.rozklad.getRozklad(fakeId, 1, 1);
    expect(rozkladRes.response.status()).toBe(200);
    expect(rozkladRes.data.length).toBe(0);
  });

  // 7. weryfikuje, czy nadpisania w jednym planie nie przenikają do drugiego
  test('Izolacja zmian między planami', async () => {
    const studiaList = asArray((await services.studia.getStudia()).data);
    if (studiaList.length === 0) { test.skip(); return; }
    const studiumId = studiaList[0].id;
    const semestryList = asArray((await services.studia.getSemestry(studiumId)).data)[0];
    if (!semestryList) { test.skip(); return; }
    const specjalnosciList = asArray((await services.studia.getSpecjalnosci(studiumId, semestryList)).data)[0];
    if (!specjalnosciList) { test.skip(); return; }
    const rozkladList = asArray((await services.rozklad.getRozklad(studiumId, semestryList, specjalnosciList.id)).data);
    if (rozkladList.length === 0) { test.skip(); return; }

    const scheduleConfig = { idStudiow: studiumId, semestr: semestryList, idSpecjalnosci: specjalnosciList.id, grupy: {}, idJezyka: null };
    const createScheduleRes1 = await services.schedules.createSchedule({
      name: createUniqueName('Iso1'),
      scheduleType: 'Student',
      configuration: scheduleConfig,
    });
    const scheduleId1 = createScheduleRes1.data.id;
    createdScheduleIds.push(scheduleId1);

    const createScheduleRes2 = await services.schedules.createSchedule({
      name: createUniqueName('Iso2'),
      scheduleType: 'Student',
      configuration: scheduleConfig,
    });
    const scheduleId2 = createScheduleRes2.data.id;
    createdScheduleIds.push(scheduleId2);

    expect(scheduleId1).not.toBe(scheduleId2);

    const rozkladEntry = rozkladList[0];
    const overrideKey = `${rozkladEntry.idPrzedmiotu}_${rozkladEntry.rodzaj}_${rozkladEntry.dzien}_${rozkladEntry.godzina}_${rozkladEntry.tydzien}_${rozkladEntry.grupa}`;
    await services.schedules.saveOverrides(scheduleId1, {
      [overrideKey]: { hidden: true, overriddenGroup: null, forceWeekly: false, customDay: null, customStartSlot: null, customDuration: null },
    });

    const scheduleDetails1 = await services.schedules.getSchedule(scheduleId1);
    const scheduleDetails2 = await services.schedules.getSchedule(scheduleId2);
    expect(Object.keys(scheduleDetails1.data.overrides || {}).length).toBeGreaterThan(0);
    expect(Object.keys(scheduleDetails2.data.overrides || {}).length).toBe(0);

    await services.schedules.saveOverrides(scheduleId1, {}, ['conflict-s1']);
    const scheduleDetails1AfterConflict = await services.schedules.getSchedule(scheduleId1);
    const scheduleDetails2AfterConflict = await services.schedules.getSchedule(scheduleId2);
    expect((scheduleDetails1AfterConflict.data.ignoredConflictIds || []).length).toBeGreaterThan(0);

    expect((scheduleDetails2AfterConflict.data.ignoredConflictIds || []).length).toBe(0);
  });

  // 8. upewnia się, że system pozwala na plany z tą samą nazwą i poprawnie je rozróżnia
  test('Tworzenie duplikatów nazw planów', async () => {
    const studiaList = asArray((await services.studia.getStudia()).data);
    if (studiaList.length === 0) { test.skip(); return; }
    const studiumId = studiaList[0].id;
    const semestryList = asArray((await services.studia.getSemestry(studiumId)).data)[0];
    if (!semestryList) { test.skip(); return; }
    const specjalnosciList = asArray((await services.studia.getSpecjalnosci(studiumId, semestryList)).data)[0];
    if (!specjalnosciList) { test.skip(); return; }

    const duplicateName = createUniqueName('Dup');
    const scheduleConfig = { idStudiow: studiumId, semestr: semestryList, idSpecjalnosci: specjalnosciList.id, grupy: {}, idJezyka: null };

    const createScheduleRes1 = await services.schedules.createSchedule({
      name: duplicateName,
      scheduleType: 'Student',
      configuration: scheduleConfig,
    });
    expect(createScheduleRes1.response.status()).toBe(201);
    const scheduleId1 = createScheduleRes1.data.id;
    createdScheduleIds.push(scheduleId1);

    const createScheduleRes2 = await services.schedules.createSchedule({
      name: duplicateName,
      scheduleType: 'Student',
      configuration: scheduleConfig,
    });
    expect(createScheduleRes2.response.status()).toBe(201);
    const scheduleId2 = createScheduleRes2.data.id;
    createdScheduleIds.push(scheduleId2);

    expect(scheduleId1).not.toBe(scheduleId2);
    expect(createScheduleRes1.data.name).toBe(duplicateName);
    expect(createScheduleRes2.data.name).toBe(duplicateName);

    const schedulesList = await services.schedules.listSchedules();
    const foundSchedule1 = schedulesList.data.find(sc => sc.id === scheduleId1);
    const foundSchedule2 = schedulesList.data.find(sc => sc.id === scheduleId2);
    expect(foundSchedule1).toBeTruthy();
    expect(foundSchedule2).toBeTruthy();

    expect(foundSchedule1.name).toBe(foundSchedule2.name);
    expect(foundSchedule1.id).not.toBe(foundSchedule2.id);

    const getScheduleRes1 = await services.schedules.getSchedule(scheduleId1);
    const getScheduleRes2 = await services.schedules.getSchedule(scheduleId2);
    expect(getScheduleRes1.data.id).toBe(scheduleId1);
    expect(getScheduleRes2.data.id).toBe(scheduleId2);
  });

  // 9. tworzy plan dla nauczyciela i waliduje zapisany schemat
  test('Tworzenie planu typu teacher', async () => {
    const nauczycieleList = asArray((await services.nauczyciele.getNauczyciele()).data);
    if (nauczycieleList.length === 0) {
      test.skip();
      return;
    }

    let nauczycielItem = null;
    for (const n of nauczycieleList) {
      const teacherRozklad = asArray((await services.rozklad.getTeacherRozklad(n.id)).data);
      if (teacherRozklad.length > 0) {
        nauczycielItem = n;
        break;
      }
    }
    
    if (!nauczycielItem) {
      test.skip();
      return;
    }

    const konsultacjeRes = await services.rozklad.getTeacherKonsultacje(nauczycielItem.id);

    const createScheduleRes = await services.schedules.createSchedule({
      name: createUniqueName('Teacher'),
      scheduleType: 'Teacher',
      configuration: { 
        idNauczyciela: nauczycielItem.id,
        idStudiow: null,
        semestr: null,
        idSpecjalnosci: null,
        grupy: {},
        idJezyka: null
      }
    });

    expect([200, 201]).toContain(createScheduleRes.response.status());
    
    if (createScheduleRes.data && createScheduleRes.data.id) {
      const scheduleId = createScheduleRes.data.id;
      createdScheduleIds.push(scheduleId);

      const scheduleDetails = await services.schedules.getSchedule(scheduleId);
      expect(scheduleDetails.response.status()).toBe(200);
      expect(scheduleDetails.data.scheduleType).toBe('Teacher');
      expect(scheduleDetails.data.configuration.idNauczyciela).toBe(nauczycielItem.id);

      const schedulesList = await services.schedules.listSchedules();
      expect(schedulesList.data.some(sc => sc.id === scheduleId)).toBe(true);
    }
  });

  // 10. weryfikuje czy po aktualizacji nadpisań nie zmienia się data utworzenia planu
  test('Niezmienność daty utworzenia', async () => {
    const studiaList = asArray((await services.studia.getStudia()).data);
    if (studiaList.length === 0) {
      test.skip();
      return;
    }
    const studiumId = studiaList[0].id;
    const semestryList = asArray((await services.studia.getSemestry(studiumId)).data)[0];
    if (!semestryList) {
      test.skip();
      return;
    }
    const specjalnosciList = asArray((await services.studia.getSpecjalnosci(studiumId, semestryList)).data)[0];
    if (!specjalnosciList) {
      test.skip();
      return;
    }
    const rozkladList = asArray((await services.rozklad.getRozklad(studiumId, semestryList, specjalnosciList.id)).data);
    if (rozkladList.length === 0) {
      test.skip();
      return;
    }

    const timeBefore = new Date();
    const createScheduleRes = await services.schedules.createSchedule({
      name: createUniqueName('Time'),
      scheduleType: 'Student',
      configuration: { idStudiow: studiumId, semestr: semestryList, idSpecjalnosci: specjalnosciList.id, grupy: {}, idJezyka: null },
    });
    const timeAfter = new Date();

    const scheduleId = createScheduleRes.data.id;
    createdScheduleIds.push(scheduleId);

    const initialScheduleDetails = await services.schedules.getSchedule(scheduleId);
    
    let createdAtString = initialScheduleDetails.data.createdAt;
    if (!createdAtString.endsWith('Z') && !createdAtString.includes('+')) {
      createdAtString += 'Z';
    }
    const createdAtTimestamp = new Date(createdAtString);

    expect(createdAtTimestamp).toEqual(expect.any(Date));
    expect(createdAtTimestamp.getTime()).toBeGreaterThanOrEqual(timeBefore.getTime() - 5000);
    expect(createdAtTimestamp.getTime()).toBeLessThanOrEqual(timeAfter.getTime() + 5000);

    expect(Array.isArray(initialScheduleDetails.data.updatedKeys)).toBe(true);
    expect(initialScheduleDetails.data.updatedKeys.length).toBe(0);

    const rozkladEntry = rozkladList[0];
    const overrideKey = `${rozkladEntry.idPrzedmiotu}_${rozkladEntry.rodzaj}_${rozkladEntry.dzien}_${rozkladEntry.godzina}_${rozkladEntry.tydzien}_${rozkladEntry.grupa}`;
    await services.schedules.saveOverrides(scheduleId, {
      [overrideKey]: { hidden: true, overriddenGroup: null, forceWeekly: false, customDay: null, customStartSlot: null, customDuration: null },
    });

    const scheduleDetailsAfterUpdate = await services.schedules.getSchedule(scheduleId);
    expect(scheduleDetailsAfterUpdate.data.createdAt).toBe(initialScheduleDetails.data.createdAt);
  });
});