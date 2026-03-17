namespace TimetableApp.Models;

public class Nauczyciel
{
    public int Id { get; set; }
    public string Nazwisko { get; set; } = string.Empty;
    public string Imie { get; set; } = string.Empty;
    public string ImieSkrot { get; set; } = string.Empty;
    public int IdTytulu { get; set; }
    public long DataAktualizacji { get; set; }

    public Tytul Tytul { get; set; } = null!;
}
