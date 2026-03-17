namespace TimetableApp.Models;

/// <summary>
/// Powiadomienie o zmianie w rozkładzie zajęć śledzonych przez użytkownika.
/// </summary>
public class Powiadomienie
{
    public int Id { get; set; }
    public string Tresc { get; set; } = string.Empty;
    public DateTime DataUtworzenia { get; set; }
    public bool Przeczytane { get; set; }

    // Kontekst zmiany
    public int? IdPrzedmiotu { get; set; }
    public long PoprzedniaAktualizacja { get; set; }
    public long NowaAktualizacja { get; set; }

    public Przedmiot? Przedmiot { get; set; }
}
