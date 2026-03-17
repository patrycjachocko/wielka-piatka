using System.Text.Json;
using Xunit;
using TimetableApp.Helpers;
using TimetableApp.Models;

namespace Tests_Filip;

// Klasa z testami jednostkowymi dla backendu - Filip
public class FilipScheduleTests
{
    #region Test 1: Konwersja slotów czasowych

    // Sprawdza czy numer slotu poprawnie przelicza się na konkretne godziny.
    // Przypadek testowy: pierwszy slot w zwykły dzień roboczy (8:30 - 9:15).
    [Fact]
    public void GetTimeRange_WeekdaySlot1_ReturnsCorrectTime()
    {
        // Arrange
        int dzien = 1; // poniedziałek
        int slot = 1;  // pierwsze zajęcia
        int ilosc = 1; // czas trwania: 1 okienko

        // Act
        var (start, end) = TimeSlotHelper.GetTimeRange(dzien, slot, ilosc);

        // Assert
        Assert.Equal(new TimeOnly(8, 30), start);
        Assert.Equal(new TimeOnly(9, 15), end);
    }

    #endregion

    #region Test 2: Filtrowanie ukrytych zajęć w planie

    // Sprawdza czy po zastosowaniu nadpisań (Overrides) zajęcia oznaczone jako ukryte 
    // faktycznie znikają z końcowej listy i nie trafią np. do pliku ical.
    [Fact]
    public void ApplyOverrides_HiddenTrue_ExcludesEntryFromResults()
    {
        // Arrange - przykładowa lista zajęć pobrana z API
        var rozkladEntries = new List<(int IdPrzedmiotu, string Rodzaj, int Dzien, int Godzina, int Tydzien, int Grupa, string Nazwa)>
        {
            (1, "W", 1, 3, 0, 1, "Matematyka - Wykład"),    // to chcemy ukryć
            (2, "C", 1, 5, 0, 1, "Fizyka - Ćwiczenia"),     // to ma zostać
            (3, "L", 2, 7, 0, 2, "Informatyka - Laby"),     // to też zostaje
        };

        // Tworzymy słownik z nadpisaniami
        var overrides = new Dictionary<string, EntryOverride>
        {
            ["1_W_1_3_0_1"] = new EntryOverride { Hidden = true },  // ukrywamy matematykę
            ["2_C_1_5_0_1"] = new EntryOverride { Hidden = false }, // fizyka bez zmian
        };

        // Act - pętla filtrująca zajęcia (symulacja logiki z ScheduleEndpoints)
        var visibleEntries = new List<string>();
        foreach (var entry in rozkladEntries)
        {
            var overrideKey = $"{entry.IdPrzedmiotu}_{entry.Rodzaj}_{entry.Dzien}_{entry.Godzina}_{entry.Tydzien}_{entry.Grupa}";

            if (overrides.TryGetValue(overrideKey, out var ov))
            {
                if (ov.Hidden) continue; // pomijamy ukryte zajęcia
            }

            visibleEntries.Add(entry.Nazwa);
        }

        // Assert - sprawdzamy co ostatecznie zostało na liście
        Assert.Equal(2, visibleEntries.Count);
        Assert.DoesNotContain("Matematyka - Wykład", visibleEntries);
        Assert.Contains("Fizyka - Ćwiczenia", visibleEntries);
        Assert.Contains("Informatyka - Laby", visibleEntries);
    }

    #endregion

    #region Test 3: Wykrywanie idealnego pokrycia zajęć

    // Testuje sytuację, gdzie dwa przedmioty wypadają dokładnie w tym samym czasie.
    // Zgodnie z nowymi ustaleniami, taka sytuacja to tzw. "idealne pokrycie" 
    // i system nie powinien rzucać błędu o konflikcie.
    [Fact]
    public void ConflictDetection_PerfectCoverage_NoConflict()
    {
        // Arrange - dwa różne przedmioty w tym samym dniu i godzinie
        var entryA = new TestScheduleEntry { Dzien = 1, Godzina = 3, Ilosc = 2, Tydzien = 0 };
        var entryB = new TestScheduleEntry { Dzien = 1, Godzina = 3, Ilosc = 2, Tydzien = 0 };

        // Act
        bool isPerfectCoverage = IsPerfectCoverage(entryA, entryB);

        // Assert
        Assert.True(isPerfectCoverage);
    }

    // Prosta metoda pomocnicza do sprawdzania czasu w tym teście
    private static bool IsPerfectCoverage(TestScheduleEntry a, TestScheduleEntry b)
    {
        return a.Dzien == b.Dzien
            && a.Godzina == b.Godzina
            && a.Ilosc == b.Ilosc;
    }

    // Klasa pomocnicza udająca model z bazy na potrzeby testu
    private class TestScheduleEntry
    {
        public int Dzien { get; set; }
        public int Godzina { get; set; }
        public int Ilosc { get; set; }
        public int Tydzien { get; set; }
    }

    #endregion
}