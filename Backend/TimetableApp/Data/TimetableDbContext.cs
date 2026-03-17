using Microsoft.EntityFrameworkCore;
using TimetableApp.Models;

namespace TimetableApp.Data;

public class TimetableDbContext : DbContext
{
    public TimetableDbContext(DbContextOptions<TimetableDbContext> options) : base(options) { }

    // Tabele lustrzane API
    public DbSet<Sala> Sale { get; set; }
    public DbSet<Nauczyciel> Nauczyciele { get; set; }
    public DbSet<Tytul> Tytuly { get; set; }
    public DbSet<Studia> Studia { get; set; }
    public DbSet<Specjalnosc> Specjalnosci { get; set; }
    public DbSet<Przedmiot> Przedmioty { get; set; }
    public DbSet<Rozklad> Rozklady { get; set; }
    public DbSet<Konsultacja> Konsultacje { get; set; }

    // Tabele aplikacyjne (lokalne)
    public DbSet<KonfiguracjaUzytkownika> KonfiguracjaUzytkownika { get; set; }
    public DbSet<WyborGrupy> WyboryGrup { get; set; }
    public DbSet<Powiadomienie> Powiadomienia { get; set; }
    public DbSet<SyncLog> SyncLogi { get; set; }
    public DbSet<SavedSchedule> SavedSchedules { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // === Sala ===
        modelBuilder.Entity<Sala>(entity =>
        {
            entity.ToTable("sale");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Nazwa).IsRequired().HasMaxLength(100);
        });

        // === Tytul ===
        modelBuilder.Entity<Tytul>(entity =>
        {
            entity.ToTable("tytuly");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Nazwa).HasMaxLength(50);
        });

        // === Nauczyciel ===
        modelBuilder.Entity<Nauczyciel>(entity =>
        {
            entity.ToTable("nauczyciele");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Nazwisko).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Imie).IsRequired().HasMaxLength(100);
            entity.Property(e => e.ImieSkrot).HasMaxLength(10);

            entity.HasOne(e => e.Tytul)
                .WithMany(t => t.Nauczyciele)
                .HasForeignKey(e => e.IdTytulu)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // === Studia ===
        modelBuilder.Entity<Studia>(entity =>
        {
            entity.ToTable("studia");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Nazwa).IsRequired().HasMaxLength(200);
        });

        // === Specjalnosc ===
        modelBuilder.Entity<Specjalnosc>(entity =>
        {
            entity.ToTable("specjalnosci");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Nazwa).HasMaxLength(200);
        });

        // === Przedmiot ===
        modelBuilder.Entity<Przedmiot>(entity =>
        {
            entity.ToTable("przedmioty");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Nazwa).IsRequired().HasMaxLength(300);
            entity.Property(e => e.NazwaSkrot).HasMaxLength(50);
        });

        // === Rozklad (KLUCZOWA TABELA) ===
        // Brak FK constraints — dane z API nie gwarantują integralności referencyjnej
        modelBuilder.Entity<Rozklad>(entity =>
        {
            entity.ToTable("rozklad");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Rodzaj).IsRequired().HasMaxLength(10);

            entity.HasIndex(e => new { e.IdStudiow, e.Semestr, e.IdSpecjalnosci });
            entity.HasIndex(e => e.IdNauczyciela);
        });

        // === Konsultacja ===
        modelBuilder.Entity<Konsultacja>(entity =>
        {
            entity.ToTable("konsultacje");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Opis).HasMaxLength(500);
            entity.Property(e => e.Typ).HasMaxLength(5);
        });

        // === KonfiguracjaUzytkownika ===
        modelBuilder.Entity<KonfiguracjaUzytkownika>(entity =>
        {
            entity.ToTable("konfiguracja_uzytkownika");
            entity.HasKey(e => e.Id);

            entity.HasOne(e => e.Studia)
                .WithMany()
                .HasForeignKey(e => e.IdStudiow)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Specjalnosc)
                .WithMany()
                .HasForeignKey(e => e.IdSpecjalnosci)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // === WyborGrupy ===
        modelBuilder.Entity<WyborGrupy>(entity =>
        {
            entity.ToTable("wybory_grup");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.RodzajZajec).IsRequired().HasMaxLength(10);

            entity.HasOne(e => e.Konfiguracja)
                .WithMany(k => k.WyboryGrup)
                .HasForeignKey(e => e.IdKonfiguracji)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Przedmiot)
                .WithMany()
                .HasForeignKey(e => e.IdPrzedmiotu)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // === Powiadomienie ===
        modelBuilder.Entity<Powiadomienie>(entity =>
        {
            entity.ToTable("powiadomienia");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Tresc).IsRequired().HasMaxLength(1000);
            entity.Property(e => e.DataUtworzenia).HasDefaultValueSql("datetime('now')");

            entity.HasOne(e => e.Przedmiot)
                .WithMany()
                .HasForeignKey(e => e.IdPrzedmiotu)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // === SyncLog ===
        modelBuilder.Entity<SyncLog>(entity =>
        {
            entity.ToTable("sync_logi");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Timestamp).HasDefaultValueSql("datetime('now')");
            entity.Property(e => e.Szczegoly).HasMaxLength(2000);
        });

        // === SavedSchedule ===
        modelBuilder.Entity<SavedSchedule>(entity =>
        {
            entity.ToTable("saved_schedules");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.ScheduleType).IsRequired().HasMaxLength(20);
            entity.Property(e => e.ConfigurationJson).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("datetime('now')");
        });
    }
}
