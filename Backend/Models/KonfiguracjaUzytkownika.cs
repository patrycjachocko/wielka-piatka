namespace TimetableApp.Models;

/// <summary>
/// Lokalna konfiguracja użytkownika — zastępuje system kont.
/// Przechowuje wybrany kierunek, semestr i specjalność.
/// Zakładamy jednego użytkownika na instancję aplikacji.
/// </summary>
public class KonfiguracjaUzytkownika
{
    public int Id { get; set; }
    public int IdStudiow { get; set; }
    public int Semestr { get; set; }
    public int IdSpecjalnosci { get; set; }

    public Studia Studia { get; set; } = null!;
    public Specjalnosc Specjalnosc { get; set; } = null!;
    public ICollection<WyborGrupy> WyboryGrup { get; set; } = [];
}
