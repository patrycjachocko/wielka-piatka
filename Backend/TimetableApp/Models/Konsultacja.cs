namespace TimetableApp.Models;

public class Konsultacja
{
    public int Id { get; set; }
    public int IdNauczyciela { get; set; }
    public int Dzien { get; set; }
    public int Godzina { get; set; }
    public string Opis { get; set; } = string.Empty;
    public string? Typ { get; set; } // null=konsultacje, "D"=dodatkowe
}
