using Microsoft.EntityFrameworkCore;
using TimetableService.Models;

namespace TimetableService.Data;

public class TimetableDbContext : DbContext
{
    public TimetableDbContext(DbContextOptions<TimetableDbContext> options) : base(options) { }

    public DbSet<Sala> Sale { get; set; }
    public DbSet<Tytul> Tytuly { get; set; }
    public DbSet<Nauczyciel> Nauczyciele { get; set; }
    public DbSet<Studia> Studia { get; set; }
    public DbSet<Specjalnosc> Specjalnosci { get; set; }
    public DbSet<Przedmiot> Przedmioty { get; set; }
    public DbSet<Rozklad> Rozklady { get; set; }
    public DbSet<Konsultacja> Konsultacje { get; set; }
    public DbSet<SyncLog> SyncLogi { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Sala>(entity =>
        {
            entity.ToTable("sale");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Nazwa).IsRequired().HasMaxLength(100);
        });

        modelBuilder.Entity<Tytul>(entity =>
        {
            entity.ToTable("tytuly");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Nazwa).HasMaxLength(50);
        });

        modelBuilder.Entity<Nauczyciel>(entity =>
        {
            entity.ToTable("nauczyciele");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Nazwisko).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Imie).IsRequired().HasMaxLength(100);
            entity.Property(e => e.ImieSkrot).HasMaxLength(10);
        });

        modelBuilder.Entity<Studia>(entity =>
        {
            entity.ToTable("studia");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Nazwa).IsRequired().HasMaxLength(200);
        });

        modelBuilder.Entity<Specjalnosc>(entity =>
        {
            entity.ToTable("specjalnosci");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Nazwa).HasMaxLength(200);
        });

        modelBuilder.Entity<Przedmiot>(entity =>
        {
            entity.ToTable("przedmioty");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Nazwa).IsRequired().HasMaxLength(300);
            entity.Property(e => e.NazwaSkrot).HasMaxLength(50);
        });

        modelBuilder.Entity<Rozklad>(entity =>
        {
            entity.ToTable("rozklad");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Rodzaj).IsRequired().HasMaxLength(10);
            entity.HasIndex(e => new { e.IdStudiow, e.Semestr, e.IdSpecjalnosci });
            entity.HasIndex(e => e.IdNauczyciela);
        });

        modelBuilder.Entity<Konsultacja>(entity =>
        {
            entity.ToTable("konsultacje");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Opis).HasMaxLength(500);
            entity.Property(e => e.Typ).HasMaxLength(5);
        });

        modelBuilder.Entity<SyncLog>(entity =>
        {
            entity.ToTable("sync_logi");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Timestamp).HasDefaultValueSql("datetime('now')");
            entity.Property(e => e.Szczegoly).HasMaxLength(2000);
        });
    }
}
