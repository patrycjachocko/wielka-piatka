namespace TimetableApp.Models;

/// <summary>
/// Lokalna konfiguracja użytkownika — zastępuje system kont.
/// Przechowuje wybrany kierunek, semestr i specjalność.
/// Zakładamy jednego użytkownika na instancję aplikacji.
/// </summary>
public class KonfiguracjaUzytkownika
{
    private readonly List<WyborGrupy> _wyboryGrup = [];

    private KonfiguracjaUzytkownika() { }

    private KonfiguracjaUzytkownika(int idStudiow, int semestr, int idSpecjalnosci)
    {
        if (idStudiow <= 0)
            throw new ArgumentException("Kierunek studiow jest wymagany", nameof(idStudiow));
        if (semestr <= 0)
            throw new ArgumentException("Semestr musi byc dodatni", nameof(semestr));
        if (idSpecjalnosci < 0)
            throw new ArgumentException("Specjalnosc nie moze miec ujemnego identyfikatora", nameof(idSpecjalnosci));

        IdStudiow = idStudiow;
        Semestr = semestr;
        IdSpecjalnosci = idSpecjalnosci;
    }

    public int Id { get; private set; }
    public int IdStudiow { get; private set; }
    public int Semestr { get; private set; }
    public int IdSpecjalnosci { get; private set; }

    public IReadOnlyCollection<WyborGrupy> WyboryGrup => _wyboryGrup.AsReadOnly();

    public static KonfiguracjaUzytkownika Utworz(
        int idStudiow,
        int semestr,
        int idSpecjalnosci,
        IEnumerable<WyborGrupySpec> wyboryGrup)
    {
        var konfiguracja = new KonfiguracjaUzytkownika(idStudiow, semestr, idSpecjalnosci);

        foreach (var wybor in wyboryGrup)
        {
            konfiguracja.UstawWyborGrupy(wybor.RodzajZajec, wybor.NumerGrupy, wybor.IdPrzedmiotu);
        }

        return konfiguracja;
    }

    public void UstawWyborGrupy(string rodzajZajec, int numerGrupy, int? idPrzedmiotu = null)
    {
        var nowyWybor = WyborGrupy.Utworz(rodzajZajec, numerGrupy, idPrzedmiotu);

        _wyboryGrup.RemoveAll(w =>
            w.RodzajZajec == nowyWybor.RodzajZajec
            && w.IdPrzedmiotu == nowyWybor.IdPrzedmiotu);

        _wyboryGrup.Add(nowyWybor);
    }

    public bool UsunWyborGrupy(int idWyboru)
    {
        var wybor = _wyboryGrup.FirstOrDefault(w => w.Id == idWyboru);
        if (wybor == null)
            return false;

        _wyboryGrup.Remove(wybor);
        return true;
    }

    public int? ZnajdzNumerGrupyDla(string rodzajZajec, int idPrzedmiotu)
    {
        var nadpisanie = _wyboryGrup.FirstOrDefault(w =>
            w.RodzajZajec == rodzajZajec && w.IdPrzedmiotu == idPrzedmiotu);
        var domyslny = _wyboryGrup.FirstOrDefault(w =>
            w.RodzajZajec == rodzajZajec && w.IdPrzedmiotu == null);

        return nadpisanie?.NumerGrupy ?? domyslny?.NumerGrupy;
    }
}

public readonly record struct WyborGrupySpec(
    string RodzajZajec,
    int NumerGrupy,
    int? IdPrzedmiotu);
