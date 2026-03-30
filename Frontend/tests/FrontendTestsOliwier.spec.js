import { test, expect } from "@playwright/test";

class MyPlanPage {
  constructor(page) {
    this.page = page;
    this.timetableLocator = page.locator(".timetable-table");
  }

  async goto() {
    await this.page.goto("http://localhost:5173/moj-plan");
  }

  async waitForTimetableLoad() {
    await this.page.waitForLoadState("networkidle");
    await expect(this.timetableLocator).toBeVisible();
  }

  async openFirstSchedule() {
    await this.goto();
    await this.page.getByRole("button", { name: "Otworz" }).first().click();
    await this.waitForTimetableLoad();
  }

  getTile(index = 0) {
    return new ScheduleTile(this.page, index);
  }

  getFirstTile() {
    return this.getTile(0);
  }
}

class ScheduleTile {
  constructor(page, indexOrLocator) {
    this.page = page;
    if (typeof indexOrLocator === "number") {
      this.locator = page.locator(".border-l-4").nth(indexOrLocator);
    } else {
      this.locator = indexOrLocator;
    }
  }

  async click() {
    await this.locator.click();
  }

  async isHidden() {
    const count = await this.locator.locator("text=UKRYTE").count();
    return count > 0;
  }

  async isVisible() {
    return await this.locator.isVisible();
  }

  async getZIndex() {
    return await this.locator.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return parseInt(style.zIndex, 10) || 0;
    });
  }

  async hasText(text) {
    return await this.locator.filter({ hasText: text }).isVisible();
  }
}

class ScheduleTileEditMenu {
  constructor(page) {
    this.page = page;
    this.backdrop = page.locator("div.fixed.inset-0.z-40");
    this.menuContainer = page.locator(
      "div.absolute.z-50.bg-white.rounded-lg.shadow-2xl"
    );
    this.menuHeader = page.getByText("Edytuj kafelek");
    this.hideButton = page.getByRole("button", { name: "Ukryj zajecia" });
    this.showButton = page.getByRole("button", { name: "Pokaz zajecia" });
    this.changeGroupButton = page.getByRole("button", { name: "Zmien grupe" });
    this.changeTimeButton = page.getByRole("button", { name: "Zmien termin" });
  }

  async isOpen() {
    return await this.menuHeader.isVisible();
  }

  async isClosed() {
    return !(await this.isOpen());
  }

  async close() {
    await this.backdrop.click();
  }

  async hideClass() {
    await this.hideButton.click();
  }

  async showClass() {
    await this.showButton.click();
  }

  async openTimeEditor() {
    await this.changeTimeButton.click();
  }

  async getMenuZIndex() {
    return await this.menuContainer.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return parseInt(style.zIndex, 10);
    });
  }

  async getMenuOpacity() {
    return await this.menuContainer.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return parseFloat(style.opacity);
    });
  }

  async hasChangeGroupButton() {
    return (await this.changeGroupButton.count()) > 0;
  }

  async hasChangeTimeButton() {
    return (await this.changeTimeButton.count()) > 0;
  }

  async waitForClose() {
    await expect(this.menuHeader).toHaveCount(0);
  }
}

class TimeEditorModal {
  constructor(page) {
    this.page = page;
    this.modalHeader = page.getByText("Nowy termin");
    this.daySelect = page
      .locator("label")
      .filter({ hasText: "Dzien:" })
      .locator("select");
    this.startTimeSelect = page
      .locator("label")
      .filter({ hasText: "Od:" })
      .locator("select");
    this.endTimeSelect = page
      .locator("label")
      .filter({ hasText: "Do:" })
      .locator("select");
    this.applyButton = page.getByRole("button", { name: "Zastosuj" });
  }

  async isOpen() {
    return await this.modalHeader.isVisible();
  }

  async selectDay(value) {
    await this.daySelect.selectOption(value);
  }

  async selectStartTime(value) {
    await this.startTimeSelect.selectOption(value);
  }

  async selectEndTime(value) {
    await this.endTimeSelect.selectOption(value);
  }

  async apply() {
    await this.applyButton.click();
  }

  async fillAndApply(day, start, end) {
    await this.selectDay(day);
    await this.selectStartTime(start);
    await this.selectEndTime(end);
    await this.apply();
  }

  async waitForClose() {
    await expect(this.modalHeader).toHaveCount(0);
  }
}

class ConflictBanner {
  constructor(page) {
    this.page = page;
    this.banner = page.locator(
      "div.bg-orange-50.border.border-orange-300.rounded-lg"
    );
    this.ignoreButtons = page.getByRole("button", { name: "Ignoruj" });
  }

  async isVisible() {
    return await this.banner.isVisible();
  }

  async getConflictCount() {
    return await this.ignoreButtons.count();
  }

  async ignoreFirstConflict() {
    await this.ignoreButtons.first().click();
  }

  async ignoreByIndex(index) {
    await this.ignoreButtons.nth(index).click();
  }

  async waitForUpdate() {
    await this.page.waitForTimeout(100);
  }
}

class UnsavedChangesIndicator {
  constructor(page) {
    this.page = page;
    this.indicator = page.locator("span.text-amber-800.font-semibold");
    this.saveButton = page.getByRole("button", { name: "Zapisz zmiany" });
  }

  async isVisible() {
    return await this.indicator.isVisible();
  }

  async isDirty() {
    return await this.isVisible();
  }

  async isClean() {
    return !(await this.isVisible());
  }

  async save() {
    await this.saveButton.click();
  }

  async waitForClean() {
    await expect(this.indicator).toHaveCount(0);
  }

  async waitForDirty() {
    await expect(this.indicator).toBeVisible();
  }

  async getChangeCount() {
    const text = await this.indicator.textContent();
    const match = text.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

test.describe("Oliwier - Tile Edit Menu & Schedule Tests", () => {
  async function setupStudentScheduleMocks(page, scheduleData = null) {
    await page.route("**/api/schedules", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: 1,
              name: "Plan testowy",
              scheduleType: "Student",
              createdAt: "2026-01-15T10:30:00Z",
            },
          ]),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/api/schedules/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          name: "Plan testowy",
          scheduleType: "Student",
          createdAt: "2026-01-15T10:30:00Z",
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

    const defaultSchedule = [
      {
        id: 1,
        idPrzedmiotu: 101,
        dzien: 1,
        godzina: 1,
        ilosc: 1,
        tydzien: 0,
        rodzaj: "W",
        grupa: 1,
        przedmiot: "Algebra",
        przedmiotSkrot: "ALG",
        nauczyciel: "dr Jan Kowalski",
        nauczycielSkrot: "dr J. Kowalski",
        sala: "101",
        idStudiow: 1,
        semestr: 1,
        idSpecjalnosci: 11,
      },
      {
        id: 2,
        idPrzedmiotu: 102,
        dzien: 1,
        godzina: 2,
        ilosc: 1,
        tydzien: 0,
        rodzaj: "L",
        grupa: 1,
        przedmiot: "Analiza",
        przedmiotSkrot: "AN",
        nauczyciel: "dr Anna Nowak",
        nauczycielSkrot: "dr A. Nowak",
        sala: "102",
        idStudiow: 1,
        semestr: 1,
        idSpecjalnosci: 11,
      },
    ];

    await page.route("**/api/rozklad*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(scheduleData ?? defaultSchedule),
      });
    });
  }

  async function setupTeacherScheduleMocks(page, scheduleData = null) {
    await page.route("**/api/schedules", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: 1,
              name: "Plan nauczyciela",
              scheduleType: "Teacher",
              createdAt: "2026-01-15T10:30:00Z",
            },
          ]),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/api/schedules/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          name: "Plan nauczyciela",
          scheduleType: "Teacher",
          createdAt: "2026-01-15T10:30:00Z",
          overrides: {},
          updatedKeys: [],
          ignoredConflictIds: [],
          configuration: {
            idNauczyciela: 1,
          },
        }),
      });
    });

    const defaultTeacherSchedule = [
      {
        id: 1,
        idPrzedmiotu: 201,
        dzien: 1,
        godzina: 1,
        ilosc: 1,
        tydzien: 0,
        rodzaj: "W",
        grupa: 1,
        przedmiot: "Bazy Danych",
        przedmiotSkrot: "BD",
        nauczyciel: "dr Jan Kowalski",
        nauczycielSkrot: "dr J. Kowalski",
        sala: "201",
        kierunek: "Informatyka",
        semestr: 3,
      },
    ];

    await page.route("**/api/rozklad/nauczyciel/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(scheduleData ?? defaultTeacherSchedule),
      });
    });
  }

  async function openMyPlanWithSchedule(page) {
    const plan = new MyPlanPage(page);
    await plan.openFirstSchedule();
  }

  // 1. TileEditMenu_ClickOutside_Close - Edit menu closes when clicking backdrop
  test("TileEditMenu_ClickOutside_Close", async ({ page }) => {
    await setupStudentScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    const plan = new MyPlanPage(page);
    const tile = plan.getFirstTile();
    await tile.click();

    const menu = new ScheduleTileEditMenu(page);
    expect(await menu.isOpen()).toBe(true);

    await menu.close();
    expect(await menu.isOpen()).toBe(false);
  });

  // 2. TileEditMenu_ZIndex_AboveTiles - Edit menu z-index is above tiles
  test("TileEditMenu_ZIndex_AboveTiles", async ({ page }) => {
    await setupStudentScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    const plan = new MyPlanPage(page);
    const tile = plan.getFirstTile();
    await tile.click();

    const menu = new ScheduleTileEditMenu(page);
    expect(await menu.isOpen()).toBe(true);

    const menuZIndex = await menu.getMenuZIndex();
    expect(menuZIndex).toBe(50);

    const siblingTile = plan.getTile(1);
    const tileZIndex = await siblingTile.getZIndex();
    expect(menuZIndex).toBeGreaterThan(tileZIndex);
  });

  // 3. HiddenTile_Menu_NoOpacityInherit - Menu maintains full opacity for hidden tiles
  test("HiddenTile_Menu_NoOpacityInherit", async ({ page }) => {
    await setupStudentScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    const plan = new MyPlanPage(page);
    const tile = plan.getFirstTile();

    await tile.click();
    const menu = new ScheduleTileEditMenu(page);
    await menu.hideClass();

    expect(await tile.isHidden()).toBe(true);

    await tile.click();
    expect(await menu.isOpen()).toBe(true);

    const menuOpacity = await menu.getMenuOpacity();
    expect(menuOpacity).toBe(1);

    const hiddenOverlay = page.locator(
      ".bg-black\\/30.backdrop-blur-\\[1px\\]"
    );
    await expect(hiddenOverlay).toBeVisible();
  });

  // 4. WeekParity_IndependentOverrides - Hiding one week parity doesn't hide others
  test("WeekParity_IndependentOverrides", async ({ page }) => {
    const scheduleWithWeekParity = [
      {
        id: 1,
        idPrzedmiotu: 101,
        dzien: 1,
        godzina: 1,
        ilosc: 1,
        tydzien: 1,
        rodzaj: "W",
        grupa: 1,
        przedmiot: "Algebra Nieparzyste",
        przedmiotSkrot: "ALG-N",
        nauczyciel: "dr Jan Kowalski",
        nauczycielSkrot: "dr J. Kowalski",
        sala: "101",
        idStudiow: 1,
        semestr: 1,
        idSpecjalnosci: 11,
      },
      {
        id: 2,
        idPrzedmiotu: 101,
        dzien: 1,
        godzina: 1,
        ilosc: 1,
        tydzien: 2,
        rodzaj: "W",
        grupa: 1,
        przedmiot: "Algebra Parzyste",
        przedmiotSkrot: "ALG-P",
        nauczyciel: "dr Anna Nowak",
        nauczycielSkrot: "dr A. Nowak",
        sala: "102",
        idStudiow: 1,
        semestr: 1,
        idSpecjalnosci: 11,
      },
    ];

    await setupStudentScheduleMocks(page, scheduleWithWeekParity);
    await openMyPlanWithSchedule(page);

    await expect(page.getByText("Tyg. nieparzyste")).toBeVisible();
    await expect(page.getByText("Tyg. parzyste")).toBeVisible();

    const evenTile = new ScheduleTile(
      page,
      page.locator(".border-l-4").filter({ hasText: "ALG-P" })
    );
    await evenTile.click();

    const menu = new ScheduleTileEditMenu(page);
    await menu.hideClass();

    expect(await evenTile.isHidden()).toBe(true);

    const oddTile = new ScheduleTile(
      page,
      page.locator(".border-l-4").filter({ hasText: "ALG-N" })
    );
    expect(await oddTile.isHidden()).toBe(false);

    const indicator = new UnsavedChangesIndicator(page);
    expect(await indicator.isDirty()).toBe(true);
  });

  // 5. TeacherPlan_NoChangeGroupOption - Teacher plans don't show change group button
  test("TeacherPlan_NoChangeGroupOption", async ({ page }) => {
    await setupTeacherScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    const plan = new MyPlanPage(page);
    const tile = plan.getFirstTile();
    await tile.click();

    const menu = new ScheduleTileEditMenu(page);
    expect(await menu.isOpen()).toBe(true);

    const hasChangeGroup = await menu.hasChangeGroupButton();
    expect(hasChangeGroup).toBe(false);

    const hasChangeTime = await menu.hasChangeTimeButton();
    expect(hasChangeTime).toBe(true);
  });

  // 6. TeacherPlan_ManualTimeEditEnabled - Teacher plans enable manual time editing
  test("TeacherPlan_ManualTimeEditEnabled", async ({ page }) => {
    await setupTeacherScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    const plan = new MyPlanPage(page);
    const tile = plan.getFirstTile();
    await tile.click();

    const menu = new ScheduleTileEditMenu(page);
    await menu.openTimeEditor();

    const timeEditor = new TimeEditorModal(page);
    expect(await timeEditor.isOpen()).toBe(true);

    // Weryfikacja czy pola są aktywne
    await expect(timeEditor.daySelect).toBeEnabled();
    await expect(timeEditor.startTimeSelect).toBeEnabled();
    await expect(timeEditor.endTimeSelect).toBeEnabled();
    
    // ZMIANA: Wybieramy nowy termin (np. dzień: Wtorek(2), od: 3, do: 4) i klikamy Zastosuj
    await timeEditor.fillAndApply("2", "3", "4");

    // Czekamy, aż okienko edycji się zamknie
    await timeEditor.waitForClose();

    // Sprawdzamy czy frontend zarejestrował zmianę (powinien pojawić się napis o niezapisanych zmianach)
    const indicator = new UnsavedChangesIndicator(page);
    expect(await indicator.isDirty()).toBe(true);

    // ZMIANA: Dodajemy pauzę (np. 1.5 sekundy), żebyś na podglądzie (tryb --headed)
    // zdążył zobaczyć na własne oczy, jak kafelek ładnie przeskakuje na nowe miejsce!
    await page.waitForTimeout(1500);
  });

  // 7. DirtyState_ResetAfterSave - Unsaved changes indicator clears after save
  test("DirtyState_ResetAfterSave", async ({ page }) => {
    await setupStudentScheduleMocks(page);

    await page.route("**/api/schedules/1/overrides", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
        return;
      }
      await route.continue();
    });

    await openMyPlanWithSchedule(page);

    const plan = new MyPlanPage(page);
    const tile = plan.getFirstTile();
    await tile.click();

    const menu = new ScheduleTileEditMenu(page);
    await menu.hideClass();

    const indicator = new UnsavedChangesIndicator(page);
    expect(await indicator.isDirty()).toBe(true);

    await indicator.save();
    await indicator.waitForClean();
  });

  // 8. ConflictIgnore_PartialPersistence - Ignoring conflicts updates banner state
  test("ConflictIgnore_PartialPersistence", async ({ page }) => {
    const scheduleWithMultipleConflicts = [
      {
        id: 1,
        idPrzedmiotu: 101,
        dzien: 1,
        godzina: 1,
        ilosc: 2,
        tydzien: 0,
        rodzaj: "W",
        grupa: 1,
        przedmiot: "Algebra",
        przedmiotSkrot: "ALG",
        nauczyciel: "dr Jan Kowalski",
        nauczycielSkrot: "dr J. Kowalski",
        sala: "101",
        idStudiow: 1,
        semestr: 1,
        idSpecjalnosci: 11,
      },
      {
        id: 2,
        idPrzedmiotu: 102,
        dzien: 1,
        godzina: 1,
        ilosc: 1,
        tydzien: 0,
        rodzaj: "L",
        grupa: 1,
        przedmiot: "Programowanie",
        przedmiotSkrot: "PROG",
        nauczyciel: "dr Anna Nowak",
        nauczycielSkrot: "dr A. Nowak",
        sala: "102",
        idStudiow: 1,
        semestr: 1,
        idSpecjalnosci: 11,
      },
      {
        id: 3,
        idPrzedmiotu: 103,
        dzien: 1,
        godzina: 2,
        ilosc: 1,
        tydzien: 0,
        rodzaj: "C",
        grupa: 1,
        przedmiot: "Analiza",
        przedmiotSkrot: "AN",
        nauczyciel: "dr Piotr Wisniewski",
        nauczycielSkrot: "dr P. Wisniewski",
        sala: "103",
        idStudiow: 1,
        semestr: 1,
        idSpecjalnosci: 11,
      },
    ];

    await setupStudentScheduleMocks(page, scheduleWithMultipleConflicts);

    await page.route("**/api/schedules/1/overrides", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
        return;
      }
      await route.continue();
    });

    await openMyPlanWithSchedule(page);

    const banner = new ConflictBanner(page);
    expect(await banner.isVisible()).toBe(true);

    const initialCount = await banner.getConflictCount();
    expect(initialCount).toBeGreaterThanOrEqual(2);

    await banner.ignoreFirstConflict();

    expect(await banner.isVisible()).toBe(true);

    const remainingCount = await banner.getConflictCount();
    expect(remainingCount).toBe(initialCount - 1);
  });

  // 9. BeforeUnload_NativeDialogTrigger - Browser warns on unsaved changes
  test("BeforeUnload_NativeDialogTrigger", async ({ page }) => {
    await setupStudentScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    const plan = new MyPlanPage(page);
    const tile = plan.getFirstTile();
    await tile.click();

    const menu = new ScheduleTileEditMenu(page);
    await menu.hideClass();

    const indicator = new UnsavedChangesIndicator(page);
    expect(await indicator.isDirty()).toBe(true);

    const beforeUnloadPrevented = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented || event.returnValue === "";
    });

    expect(beforeUnloadPrevented).toBe(true);
  });

  // 10. BeforeUnload_NotTriggeredWhenClean - No warning when clean
  test("BeforeUnload_NotTriggeredWhenClean", async ({ page }) => {
    await setupStudentScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    const plan = new MyPlanPage(page);
    await plan.waitForTimetableLoad();

    const indicator = new UnsavedChangesIndicator(page);
    expect(await indicator.isClean()).toBe(true);

    const beforeUnloadPrevented = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented || event.returnValue === "";
    });

    expect(beforeUnloadPrevented).toBe(false);
  });

  // 11. ApiError_SaveOverrideFailure_UserFeedback - Save failure shows error and keeps dirty state
  test("ApiError_SaveOverrideFailure_UserFeedback", async ({ page }) => {
    await setupStudentScheduleMocks(page);

    await page.route("**/api/schedules/1/overrides", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal Server Error" }),
        });
        return;
      }
      await route.continue();
    });

    await openMyPlanWithSchedule(page);

    const plan = new MyPlanPage(page);
    const tile = plan.getFirstTile();
    await tile.click();

    const menu = new ScheduleTileEditMenu(page);
    await menu.hideClass();

    const indicator = new UnsavedChangesIndicator(page);
    expect(await indicator.isDirty()).toBe(true);

    await indicator.save();

    await page.waitForTimeout(500);

    expect(await indicator.isDirty()).toBe(true);
  });

  // 12. EditMenu_PositionOnEdgeTiles_StaysInViewport - Menu stays visible at viewport edges
  test("EditMenu_PositionOnEdgeTiles_StaysInViewport", async ({ page }) => {
    await setupStudentScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    const plan = new MyPlanPage(page);
    const lastTile = plan.getTile(1);
    await lastTile.click();

    const menu = new ScheduleTileEditMenu(page);
    expect(await menu.isOpen()).toBe(true);

    const menuVisible = await page.locator(
      "div.absolute.z-50.bg-white.rounded-lg.shadow-2xl"
    ).isVisible();
    expect(menuVisible).toBe(true);

    const menuBoundingBox = await page.locator(
      "div.absolute.z-50.bg-white.rounded-lg.shadow-2xl"
    ).boundingBox();

    const viewportSize = page.viewportSize();

    if (menuBoundingBox && viewportSize) {
      expect(menuBoundingBox.x + menuBoundingBox.width).toBeLessThanOrEqual(
        viewportSize.width + 50
      );
      expect(menuBoundingBox.y + menuBoundingBox.height).toBeLessThanOrEqual(
        viewportSize.height + 50
      );
    }
  });

  // 13. ScheduleSwitch_EditMenuClosesAndStateIsolation - Switching plans closes menu and cleans state
  test("ScheduleSwitch_EditMenuClosesAndStateIsolation", async ({ page }) => {
    const multiScheduleMocks = {
      schedules: [
        {
          id: 1,
          name: "Plan testowy 1",
          scheduleType: "Student",
          createdAt: "2026-01-15T10:30:00Z",
        },
        {
          id: 2,
          name: "Plan testowy 2",
          scheduleType: "Student",
          createdAt: "2026-01-16T10:30:00Z",
        },
      ],
    };

    await page.route("**/api/schedules", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(multiScheduleMocks.schedules),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/api/schedules/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          name: "Plan testowy 1",
          scheduleType: "Student",
          createdAt: "2026-01-15T10:30:00Z",
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

    await page.route("**/api/schedules/2", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 2,
          name: "Plan testowy 2",
          scheduleType: "Student",
          createdAt: "2026-01-16T10:30:00Z",
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

    const defaultSchedule = [
      {
        id: 1,
        idPrzedmiotu: 101,
        dzien: 1,
        godzina: 1,
        ilosc: 1,
        tydzien: 0,
        rodzaj: "W",
        grupa: 1,
        przedmiot: "Algebra",
        przedmiotSkrot: "ALG",
        nauczyciel: "dr Jan Kowalski",
        nauczycielSkrot: "dr J. Kowalski",
        sala: "101",
        idStudiow: 1,
        semestr: 1,
        idSpecjalnosci: 11,
      },
    ];

    await page.route("**/api/rozklad*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(defaultSchedule),
      });
    });

    await openMyPlanWithSchedule(page);

    const plan = new MyPlanPage(page);
    const tile = plan.getFirstTile();
    await tile.click();

    const menu = new ScheduleTileEditMenu(page);
    await menu.hideClass();

    const indicator = new UnsavedChangesIndicator(page);
    expect(await indicator.isDirty()).toBe(true);

    // 1. Kliknij ponownie, aby otworzyć menu przed testem zmiany strony
    await tile.click();
    expect(await menu.isOpen()).toBe(true);

    // 2. Automatycznie zaakceptuj alert "Niezapisane zmiany", aby Playwright mógł zmienić stronę
    page.once('dialog', dialog => dialog.accept());
    
    await page.goto("http://localhost:5173/moj-plan");

    const openButton = page.getByRole("button", { name: "Otworz" }).nth(1);
    await openButton.click();

    await page.waitForLoadState("networkidle");

    expect(await menu.isClosed()).toBe(true);

    expect(await indicator.isClean()).toBe(true);
  });
});
