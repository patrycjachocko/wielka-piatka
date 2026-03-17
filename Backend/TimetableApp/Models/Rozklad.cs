namespace TimetableApp.Models;

public class Rozklad
{
    public int Id { get; set; }
    public int Dzien { get; set; }
    public int Godzina { get; set; }
    public int Ilosc { get; set; }
    public int Tydzien { get; set; } // 0=co tydzień, 1=parzyste, 2=nieparzyste
    public int IdNauczyciela { get; set; }
    public int IdSali { get; set; }
    public int IdPrzedmiotu { get; set; }
    public string Rodzaj { get; set; } = string.Empty; // W, C, L, Ps, P, S, J itp.
    public int Grupa { get; set; }
    public int IdStudiow { get; set; }
    public int Semestr { get; set; }
    public int IdSpecjalnosci { get; set; }
    public long DataAktualizacji { get; set; }
}
