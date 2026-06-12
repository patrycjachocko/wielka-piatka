namespace TimetableApp.Models;

/// <summary>
/// Encja wewnatrz agregatu KonfiguracjaUzytkownika.
/// Przechowuje wybor grupy dla rodzaju zajec oraz opcjonalne nadpisanie dla przedmiotu.
/// </summary>
public class WyborGrupy
{
    private WyborGrupy() { }

    private WyborGrupy(string rodzajZajec, int numerGrupy, int? idPrzedmiotu)
    {
        if (string.IsNullOrWhiteSpace(rodzajZajec))
            throw new ArgumentException("Rodzaj zajec jest wymagany", nameof(rodzajZajec));
        if (numerGrupy <= 0)
            throw new ArgumentException("Numer grupy musi byc dodatni", nameof(numerGrupy));
        if (idPrzedmiotu < 0)
            throw new ArgumentException("Przedmiot nie moze miec ujemnego identyfikatora", nameof(idPrzedmiotu));

        RodzajZajec = rodzajZajec.Trim();
        NumerGrupy = numerGrupy;
        IdPrzedmiotu = idPrzedmiotu;
    }

    public int Id { get; private set; }
    public int IdKonfiguracji { get; private set; }
    public string RodzajZajec { get; private set; } = string.Empty;
    public int NumerGrupy { get; private set; }
    public int? IdPrzedmiotu { get; private set; }

    public bool JestNadpisaniemPrzedmiotu => IdPrzedmiotu.HasValue;

    public static WyborGrupy Utworz(string rodzajZajec, int numerGrupy, int? idPrzedmiotu = null)
        => new(rodzajZajec, numerGrupy, idPrzedmiotu);
}
