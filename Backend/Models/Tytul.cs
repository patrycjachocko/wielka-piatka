namespace TimetableApp.Models;

public class Tytul
{
    public int Id { get; set; }
    public string Nazwa { get; set; } = string.Empty;
    public long DataAktualizacji { get; set; }

    public ICollection<Nauczyciel> Nauczyciele { get; set; } = [];
}
