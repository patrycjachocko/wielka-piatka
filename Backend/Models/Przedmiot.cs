namespace TimetableApp.Models;

public class Przedmiot
{
    public int Id { get; set; }
    public string Nazwa { get; set; } = string.Empty;
    public string NazwaSkrot { get; set; } = string.Empty;
    public long DataAktualizacji { get; set; }
}
