namespace TimetableService.Models;

public class Sala
{
    public int Id { get; set; }
    public string Nazwa { get; set; } = string.Empty;
    public long DataAktualizacji { get; set; }
}

public class Tytul
{
    public int Id { get; set; }
    public string Nazwa { get; set; } = string.Empty;
    public long DataAktualizacji { get; set; }
}

public class Nauczyciel
{
    public int Id { get; set; }
    public string Nazwisko { get; set; } = string.Empty;
    public string Imie { get; set; } = string.Empty;
    public string ImieSkrot { get; set; } = string.Empty;
    public int IdTytulu { get; set; }
    public long DataAktualizacji { get; set; }
}

public class Studia
{
    public int Id { get; set; }
    public string Nazwa { get; set; } = string.Empty;
    public long DataAktualizacji { get; set; }
}

public class Specjalnosc
{
    public int Id { get; set; }
    public string Nazwa { get; set; } = string.Empty;
    public long DataAktualizacji { get; set; }
}

public class Przedmiot
{
    public int Id { get; set; }
    public string Nazwa { get; set; } = string.Empty;
    public string NazwaSkrot { get; set; } = string.Empty;
    public long DataAktualizacji { get; set; }
}

public class Rozklad
{
    public int Id { get; set; }
    public int Dzien { get; set; }
    public int Godzina { get; set; }
    public int Ilosc { get; set; }
    public int Tydzien { get; set; }
    public int IdNauczyciela { get; set; }
    public int IdSali { get; set; }
    public int IdPrzedmiotu { get; set; }
    public string Rodzaj { get; set; } = string.Empty;
    public int Grupa { get; set; }
    public int IdStudiow { get; set; }
    public int Semestr { get; set; }
    public int IdSpecjalnosci { get; set; }
    public long DataAktualizacji { get; set; }
}

public class Konsultacja
{
    public int Id { get; set; }
    public int IdNauczyciela { get; set; }
    public int Dzien { get; set; }
    public int Godzina { get; set; }
    public string Opis { get; set; } = string.Empty;
    public string? Typ { get; set; }
}

public class SyncLog
{
    public int Id { get; set; }
    public DateTime Timestamp { get; set; }
    public bool Sukces { get; set; }
    public string? Szczegoly { get; set; }
}
