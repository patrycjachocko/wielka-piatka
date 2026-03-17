namespace TimetableApp.Models;

/// <summary>
/// Wybór grupy dla danego rodzaju zajęć.
/// Pozwala na nadpisanie domyślnej grupy dla konkretnego przedmiotu (personalizacja).
/// </summary>
public class WyborGrupy
{
    public int Id { get; set; }
    public int IdKonfiguracji { get; set; }
    public string RodzajZajec { get; set; } = string.Empty; // W, C, L, Ps, P, S, J itp.
    public int NumerGrupy { get; set; }

    // Opcjonalne: jeśli null — to jest domyślna grupa dla tego rodzaju zajęć.
    // Jeśli ustawione — to nadpisanie grupy tylko dla tego przedmiotu.
    public int? IdPrzedmiotu { get; set; }

    public KonfiguracjaUzytkownika Konfiguracja { get; set; } = null!;
    public Przedmiot? Przedmiot { get; set; }
}
