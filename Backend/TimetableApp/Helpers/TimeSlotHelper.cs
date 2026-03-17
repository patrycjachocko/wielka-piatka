namespace TimetableApp.Helpers;

/// <summary>
/// Mapowanie slotów godzinowych (1-14) na rzeczywiste godziny.
/// Dni robocze (pon-pt) i weekend (sob-ndz) mają różne rozkłady.
/// </summary>
public static class TimeSlotHelper
{
    // (start, end) dla każdego slotu — indeks 0 = slot 1
    private static readonly (TimeOnly Start, TimeOnly End)[] WeekdaySlots =
    [
        (new(8, 30), new(9, 15)),   // 1
        (new(9, 15), new(10, 0)),   // 2
        (new(10, 15), new(11, 0)),  // 3
        (new(11, 0), new(11, 45)),  // 4
        (new(12, 0), new(12, 45)),  // 5
        (new(12, 45), new(13, 30)), // 6
        (new(14, 0), new(14, 45)),  // 7
        (new(14, 45), new(15, 30)), // 8
        (new(16, 0), new(16, 45)),  // 9
        (new(16, 45), new(17, 30)), // 10
        (new(17, 40), new(18, 25)), // 11
        (new(18, 25), new(19, 10)), // 12
        (new(19, 20), new(20, 5)),  // 13
        (new(20, 5), new(20, 50)),  // 14
    ];

    private static readonly (TimeOnly Start, TimeOnly End)[] WeekendSlots =
    [
        (new(8, 0), new(8, 45)),    // 1
        (new(8, 50), new(9, 35)),   // 2
        (new(9, 50), new(10, 35)),  // 3
        (new(10, 40), new(11, 25)), // 4
        (new(11, 40), new(12, 25)), // 5
        (new(12, 30), new(13, 15)), // 6
        (new(13, 30), new(14, 15)), // 7
        (new(14, 20), new(15, 5)),  // 8
        (new(15, 10), new(15, 55)), // 9
        (new(16, 0), new(16, 45)),  // 10
        (new(16, 50), new(17, 35)), // 11
        (new(17, 40), new(18, 25)), // 12
        (new(18, 30), new(19, 15)), // 13
        (new(19, 20), new(20, 5)),  // 14
        (new(20, 10), new(20, 55)), // 15
    ];

    /// <summary>
    /// Zwraca godzinę rozpoczęcia i zakończenia dla danego slotu i ilości slotów.
    /// </summary>
    /// <param name="dzien">Dzień tygodnia (1-7)</param>
    /// <param name="slot">Numer slotu (1-14)</param>
    /// <param name="ilosc">Ilość kolejnych slotów (zazwyczaj 2)</param>
    public static (TimeOnly Start, TimeOnly End) GetTimeRange(int dzien, int slot, int ilosc)
    {
        var slots = dzien >= 6 ? WeekendSlots : WeekdaySlots;
        var maxSlot = slots.Length;

        if (slot < 1 || slot > maxSlot)
            throw new ArgumentOutOfRangeException(nameof(slot), $"Slot musi być w zakresie 1-{maxSlot}");

        var endSlot = Math.Min(slot + ilosc - 1, maxSlot);

        return (slots[slot - 1].Start, slots[endSlot - 1].End);
    }

    /// <summary>
    /// Zwraca sformatowany string czasu, np. "14:00 - 15:30"
    /// </summary>
    public static string FormatTimeRange(int dzien, int slot, int ilosc)
    {
        var (start, end) = GetTimeRange(dzien, slot, ilosc);
        return $"{start:HH:mm} - {end:HH:mm}";
    }

    /// <summary>
    /// Zwraca nazwę dnia tygodnia.
    /// </summary>
    public static string GetDayName(int dzien) => dzien switch
    {
        1 => "Poniedziałek",
        2 => "Wtorek",
        3 => "Środa",
        4 => "Czwartek",
        5 => "Piątek",
        6 => "Sobota",
        7 => "Niedziela",
        _ => "?"
    };

    /// <summary>
    /// Zwraca pełną siatkę godzin dla danego typu dnia.
    /// </summary>
    public static IReadOnlyList<(TimeOnly Start, TimeOnly End)> GetAllSlots(bool weekend)
        => weekend ? WeekendSlots : WeekdaySlots;
}
