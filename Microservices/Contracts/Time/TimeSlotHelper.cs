namespace TimetableApp.Contracts.Time;

public static class TimeSlotHelper
{
    private static readonly (TimeOnly Start, TimeOnly End)[] WeekdaySlots =
    [
        (new(8, 30), new(9, 15)),
        (new(9, 15), new(10, 0)),
        (new(10, 15), new(11, 0)),
        (new(11, 0), new(11, 45)),
        (new(12, 0), new(12, 45)),
        (new(12, 45), new(13, 30)),
        (new(14, 0), new(14, 45)),
        (new(14, 45), new(15, 30)),
        (new(16, 0), new(16, 45)),
        (new(16, 45), new(17, 30)),
        (new(17, 40), new(18, 25)),
        (new(18, 25), new(19, 10)),
        (new(19, 20), new(20, 5)),
        (new(20, 5), new(20, 50)),
    ];

    private static readonly (TimeOnly Start, TimeOnly End)[] WeekendSlots =
    [
        (new(8, 0), new(8, 45)),
        (new(8, 50), new(9, 35)),
        (new(9, 50), new(10, 35)),
        (new(10, 40), new(11, 25)),
        (new(11, 40), new(12, 25)),
        (new(12, 30), new(13, 15)),
        (new(13, 30), new(14, 15)),
        (new(14, 20), new(15, 5)),
        (new(15, 10), new(15, 55)),
        (new(16, 0), new(16, 45)),
        (new(16, 50), new(17, 35)),
        (new(17, 40), new(18, 25)),
        (new(18, 30), new(19, 15)),
        (new(19, 20), new(20, 5)),
        (new(20, 10), new(20, 55)),
    ];

    public static (TimeOnly Start, TimeOnly End) GetTimeRange(int dzien, int slot, int ilosc)
    {
        var slots = dzien >= 6 ? WeekendSlots : WeekdaySlots;
        var maxSlot = slots.Length;

        if (slot < 1 || slot > maxSlot)
            throw new ArgumentOutOfRangeException(nameof(slot), $"Slot musi byc w zakresie 1-{maxSlot}");

        var endSlot = Math.Min(slot + ilosc - 1, maxSlot);
        return (slots[slot - 1].Start, slots[endSlot - 1].End);
    }

    public static string FormatTimeRange(int dzien, int slot, int ilosc)
    {
        var (start, end) = GetTimeRange(dzien, slot, ilosc);
        return $"{start:HH:mm} - {end:HH:mm}";
    }

    public static string GetDayName(int dzien) => dzien switch
    {
        1 => "Poniedzialek",
        2 => "Wtorek",
        3 => "Sroda",
        4 => "Czwartek",
        5 => "Piatek",
        6 => "Sobota",
        7 => "Niedziela",
        _ => "?"
    };
}
