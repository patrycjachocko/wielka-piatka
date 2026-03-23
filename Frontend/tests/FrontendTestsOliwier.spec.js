import { test, expect } from "@playwright/test";

test.describe("Oliwier - Tile Edit Menu & Schedule Tests", () => {
  /**
   * Helper to set up mocks for "Mój plan" view with a Student schedule
   */
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

  /**
   * Helper to set up mocks for "Mój plan" view with a Teacher schedule
   */
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

    // Route for Teacher schedule: /api/rozklad/nauczyciel/{id}
    await page.route("**/api/rozklad/nauczyciel/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(scheduleData ?? defaultTeacherSchedule),
      });
    });
  }

  /**
   * Helper to navigate to "Mój plan" and open the first schedule
   */
  async function openMyPlanWithSchedule(page) {
    await page.goto("http://localhost:5173/moj-plan");
    await page.getByRole("button", { name: "Otworz" }).click();
    await expect(page.locator(".timetable-table")).toBeVisible();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1: TileEditMenu_ClickOutside_Close
  // ═══════════════════════════════════════════════════════════════════════════
  test("TileEditMenu_ClickOutside_Close", async ({ page }) => {
    await setupStudentScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    // Click on the first tile to open the edit menu
    const tile = page.locator(".border-l-4").first();
    await tile.click();

    // Verify edit menu is open (header text visible)
    const menuHeader = page.getByText("Edytuj kafelek");
    await expect(menuHeader).toBeVisible();

    // Verify "Ukryj zajecia" button is visible (indicates menu is open)
    const hideButton = page.getByRole("button", { name: "Ukryj zajecia" });
    await expect(hideButton).toBeVisible();

    // Click on the backdrop (fixed inset-0 z-40 div) to close the menu
    const backdrop = page.locator("div.fixed.inset-0.z-40");
    await backdrop.click();

    // Verify menu is closed
    await expect(menuHeader).toHaveCount(0);
    await expect(hideButton).toHaveCount(0);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2: TileEditMenu_ZIndex_AboveTiles
  // ═══════════════════════════════════════════════════════════════════════════
  test("TileEditMenu_ZIndex_AboveTiles", async ({ page }) => {
    await setupStudentScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    // Click on the first tile to open the edit menu
    const tile = page.locator(".border-l-4").first();
    await tile.click();

    // Verify edit menu is open
    const hideButton = page.getByRole("button", { name: "Ukryj zajecia" });
    await expect(hideButton).toBeVisible();

    // Get the menu container (absolute z-50)
    const menuContainer = page.locator(
      "div.absolute.z-50.bg-white.rounded-lg.shadow-2xl",
    );
    await expect(menuContainer).toBeVisible();

    // Verify the menu has z-index 50
    const menuZIndex = await menuContainer.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return parseInt(style.zIndex, 10);
    });
    expect(menuZIndex).toBe(50);

    // Get z-index of a sibling tile (tiles don't have explicit z-index, should be auto/0)
    const siblingTile = page.locator(".border-l-4").nth(1);
    const tileZIndex = await siblingTile.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return parseInt(style.zIndex, 10) || 0;
    });

    // Menu z-index (50) should be higher than tile z-index
    expect(menuZIndex).toBeGreaterThan(tileZIndex);

    // Additionally verify menu button is clickable (not occluded)
    await expect(hideButton).toBeEnabled();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 3: HiddenTile_Menu_NoOpacityInherit
  // ═══════════════════════════════════════════════════════════════════════════
  test("HiddenTile_Menu_NoOpacityInherit", async ({ page }) => {
    await setupStudentScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    // Click on the first tile and hide it
    const tile = page.locator(".border-l-4").first();
    await tile.click();
    await page.getByRole("button", { name: "Ukryj zajecia" }).click();

    // Verify tile is now hidden (UKRYTE overlay visible)
    await expect(page.getByText("UKRYTE")).toBeVisible();

    // Click on the hidden tile again to open the edit menu
    await tile.click();

    // Verify "Pokaz zajecia" button is visible (menu open for hidden tile)
    const showButton = page.getByRole("button", { name: "Pokaz zajecia" });
    await expect(showButton).toBeVisible();

    // Get the menu container
    const menuContainer = page.locator(
      "div.absolute.z-50.bg-white.rounded-lg.shadow-2xl",
    );

    // Verify menu has full opacity (1.0)
    const menuOpacity = await menuContainer.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return parseFloat(style.opacity);
    });
    expect(menuOpacity).toBe(1);

    // Verify the hidden tile itself has reduced opacity via the overlay
    const hiddenOverlay = page.locator(
      ".bg-black\\/30.backdrop-blur-\\[1px\\]",
    );
    await expect(hiddenOverlay).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 4: WeekParity_IndependentOverrides
  // ═══════════════════════════════════════════════════════════════════════════
  test("WeekParity_IndependentOverrides", async ({ page }) => {
    // Setup schedule with week parity entries (tydzien: 1 = odd, tydzien: 2 = even)
    const scheduleWithWeekParity = [
      {
        id: 1,
        idPrzedmiotu: 101,
        dzien: 1,
        godzina: 1,
        ilosc: 1,
        tydzien: 1, // Odd week (nieparzyste)
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
        tydzien: 2, // Even week (parzyste)
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

    // Both week parity tiles should be visible
    await expect(page.getByText("Tyg. nieparzyste")).toBeVisible();
    await expect(page.getByText("Tyg. parzyste")).toBeVisible();

    // Hide the even week tile (ALG-P)
    const evenWeekTile = page
      .locator(".border-l-4")
      .filter({ hasText: "ALG-P" });
    await evenWeekTile.click();
    await page.getByRole("button", { name: "Ukryj zajecia" }).click();

    // Verify the even week tile is hidden
    const ukryteOnEven = evenWeekTile.locator("text=UKRYTE");
    await expect(ukryteOnEven).toBeVisible();

    // Verify the odd week tile (ALG-N) is NOT hidden - independent state
    const oddWeekTile = page
      .locator(".border-l-4")
      .filter({ hasText: "ALG-N" });
    const ukryteOnOdd = oddWeekTile.locator("text=UKRYTE");
    await expect(ukryteOnOdd).toHaveCount(0);

    // Verify unsaved changes indicator shows 1 change
    await expect(page.getByText("Niezapisane zmiany (1)")).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 5: TeacherPlan_NoChangeGroupOption
  // ═══════════════════════════════════════════════════════════════════════════
  test("TeacherPlan_NoChangeGroupOption", async ({ page }) => {
    await setupTeacherScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    // Click on the tile to open edit menu
    const tile = page.locator(".border-l-4").first();
    await tile.click();

    // Verify edit menu is open
    await expect(page.getByText("Edytuj kafelek")).toBeVisible();

    // Verify "Ukryj zajecia" button exists (basic menu option)
    await expect(
      page.getByRole("button", { name: "Ukryj zajecia" }),
    ).toBeVisible();

    // Verify "Zmien termin" button exists (Teacher-specific option)
    await expect(
      page.getByRole("button", { name: "Zmien termin" }),
    ).toBeVisible();

    // Verify "Zmien grupe" button does NOT exist for Teacher schedules
    const changeGroupButton = page.getByRole("button", { name: "Zmien grupe" });
    await expect(changeGroupButton).toHaveCount(0);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 6: TeacherPlan_ManualTimeEditEnabled
  // ═══════════════════════════════════════════════════════════════════════════
  test("TeacherPlan_ManualTimeEditEnabled", async ({ page }) => {
    await setupTeacherScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    // Click on the tile to open edit menu
    const tile = page.locator(".border-l-4").first();
    await tile.click();

    // Click "Zmien termin" to open time editor
    await page.getByRole("button", { name: "Zmien termin" }).click();

    // Verify "Nowy termin" header is visible
    await expect(page.getByText("Nowy termin")).toBeVisible();

    // Verify day selector is visible and enabled
    const daySelect = page
      .locator("label")
      .filter({ hasText: "Dzien:" })
      .locator("select");
    await expect(daySelect).toBeVisible();
    await expect(daySelect).toBeEnabled();

    // Verify start time selector is visible and enabled
    const startSelect = page
      .locator("label")
      .filter({ hasText: "Od:" })
      .locator("select");
    await expect(startSelect).toBeVisible();
    await expect(startSelect).toBeEnabled();

    // Verify end time selector is visible and enabled
    const endSelect = page
      .locator("label")
      .filter({ hasText: "Do:" })
      .locator("select");
    await expect(endSelect).toBeVisible();
    await expect(endSelect).toBeEnabled();

    // Verify "Zastosuj" button is visible
    await expect(page.getByRole("button", { name: "Zastosuj" })).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 7: DirtyState_ResetAfterSave
  // ═══════════════════════════════════════════════════════════════════════════
  test("DirtyState_ResetAfterSave", async ({ page }) => {
    await setupStudentScheduleMocks(page);

    // Mock PUT request for saving overrides
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

    // Make a change - hide a tile
    const tile = page.locator(".border-l-4").first();
    await tile.click();
    await page.getByRole("button", { name: "Ukryj zajecia" }).click();

    // Verify dirty state indicator is visible
    const dirtyIndicator = page.locator("span.text-amber-800.font-semibold");
    await expect(dirtyIndicator).toBeVisible();
    await expect(dirtyIndicator).toContainText("Niezapisane zmiany");

    // Click "Zapisz zmiany" button
    const saveButton = page.getByRole("button", { name: "Zapisz zmiany" });
    await saveButton.click();

    // Wait for save to complete and verify dirty indicator is gone
    await expect(dirtyIndicator).toHaveCount(0);

    // Verify the save button is now disabled (no more unsaved changes)
    const saveButtonAfter = page.getByRole("button", { name: "Zapisz zmiany" });
    await expect(saveButtonAfter).toBeDisabled();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 8: ConflictIgnore_PartialPersistence
  // ═══════════════════════════════════════════════════════════════════════════
  test("ConflictIgnore_PartialPersistence", async ({ page }) => {
    // Setup schedule with multiple conflicts
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

    // Mock PUT for ignore conflict
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

    // Verify conflict banner is visible with multiple conflicts
    const conflictBanner = page.locator(
      "div.bg-orange-50.border.border-orange-300.rounded-lg",
    );
    await expect(conflictBanner).toBeVisible();

    // Count initial conflicts (should be 2: ALG-PROG at slot 1, ALG-AN at slot 2)
    const ignoreButtons = page.getByRole("button", { name: "Ignoruj" });
    const initialConflictCount = await ignoreButtons.count();
    expect(initialConflictCount).toBeGreaterThanOrEqual(2);

    // Click "Ignoruj" on the first conflict
    await ignoreButtons.first().click();

    // Verify the conflict banner is still visible (other conflicts remain)
    await expect(conflictBanner).toBeVisible();

    // Verify at least one ignore button still exists
    const remainingIgnoreButtons = page.getByRole("button", {
      name: "Ignoruj",
    });
    const remainingCount = await remainingIgnoreButtons.count();
    expect(remainingCount).toBe(initialConflictCount - 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 9: BeforeUnload_NativeDialogTrigger
  // ═══════════════════════════════════════════════════════════════════════════
  test("BeforeUnload_NativeDialogTrigger", async ({ page }) => {
    await setupStudentScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    // Make a change to trigger dirty state
    const tile = page.locator(".border-l-4").first();
    await tile.click();
    await page.getByRole("button", { name: "Ukryj zajecia" }).click();

    // Verify dirty indicator is showing
    await expect(page.getByText(/Niezapisane zmiany/)).toBeVisible();

    // Verify that beforeunload event listener is active and would prevent leaving
    const beforeUnloadPrevented = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented || event.returnValue === "";
    });

    expect(beforeUnloadPrevented).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 10: BeforeUnload_NotTriggeredWhenClean
  // ═══════════════════════════════════════════════════════════════════════════
  test("BeforeUnload_NotTriggeredWhenClean", async ({ page }) => {
    await setupStudentScheduleMocks(page);
    await openMyPlanWithSchedule(page);

    // Do NOT make any changes - state should be clean

    // Verify dirty indicator is NOT showing
    await expect(page.getByText(/Niezapisane zmiany/)).toHaveCount(0);

    // Verify that beforeunload would NOT prevent leaving when state is clean
    const beforeUnloadPrevented = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented || event.returnValue === "";
    });

    expect(beforeUnloadPrevented).toBe(false);
  });
});
