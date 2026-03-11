using Microsoft.EntityFrameworkCore;
using wielkapiatka.Models.Degra;

namespace wielkapiatka.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Room> Rooms { get; set; }
        public DbSet<AcademicTitle> AcademicTitles { get; set; }
        public DbSet<StudyCourse> StudyCourses { get; set; }
        public DbSet<Specialty> Specialties { get; set; }
        public DbSet<Teacher> Teachers { get; set; }
        public DbSet<Subject> Subjects { get; set; }
        public DbSet<ScheduleEntry> ScheduleEntries { get; set; }
        public DbSet<ScheduleChange> ScheduleChanges { get; set; }
        public DbSet<TrackedSubject> TrackedSubjects { get; set; }
        public DbSet<ScheduleNotification> ScheduleNotifications { get; set; }
        public DbSet<SyncInfo> SyncInfos { get; set; }
        public DbSet<UserProfile> UserProfiles { get; set; }
        public DbSet<UserGroupOverride> UserGroupOverrides { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Lookup tables use explicit IDs from the Degra API
            modelBuilder.Entity<Room>().Property(r => r.Id).ValueGeneratedNever();
            modelBuilder.Entity<AcademicTitle>().Property(t => t.Id).ValueGeneratedNever();
            modelBuilder.Entity<StudyCourse>().Property(s => s.Id).ValueGeneratedNever();
            modelBuilder.Entity<Specialty>().Property(s => s.Id).ValueGeneratedNever();
            modelBuilder.Entity<Teacher>().Property(t => t.Id).ValueGeneratedNever();
            modelBuilder.Entity<Subject>().Property(s => s.Id).ValueGeneratedNever();

            modelBuilder.Entity<ScheduleEntry>()
                .HasIndex(e => e.DataHash);

            modelBuilder.Entity<ScheduleChange>()
                .HasIndex(e => e.Dismissed);

            modelBuilder.Entity<TrackedSubject>()
                .HasIndex(e => e.ClientId);

            modelBuilder.Entity<ScheduleNotification>()
                .HasIndex(e => e.ClientId);

            modelBuilder.Entity<Teacher>()
                .HasOne(t => t.Title)
                .WithMany()
                .HasForeignKey(t => t.TitleId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ScheduleEntry>()
                .HasOne(e => e.Teacher)
                .WithMany()
                .HasForeignKey(e => e.TeacherId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ScheduleEntry>()
                .HasOne(e => e.Room)
                .WithMany()
                .HasForeignKey(e => e.RoomId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ScheduleEntry>()
                .HasOne(e => e.Subject)
                .WithMany()
                .HasForeignKey(e => e.SubjectId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ScheduleEntry>()
                .HasOne(e => e.StudyCourse)
                .WithMany()
                .HasForeignKey(e => e.StudyCourseId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ScheduleEntry>()
                .HasOne(e => e.Specialty)
                .WithMany()
                .HasForeignKey(e => e.SpecialtyId)
                .OnDelete(DeleteBehavior.Restrict);

            // UserProfile — unique per ClientId
            modelBuilder.Entity<UserProfile>()
                .HasIndex(p => p.ClientId)
                .IsUnique();

            modelBuilder.Entity<UserProfile>()
                .HasOne(p => p.StudyCourse)
                .WithMany()
                .HasForeignKey(p => p.StudyCourseId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserProfile>()
                .HasOne(p => p.Specialty)
                .WithMany()
                .HasForeignKey(p => p.SpecialtyId)
                .OnDelete(DeleteBehavior.Restrict);

            // UserGroupOverride — unique per ClientId + SubjectId + Type
            modelBuilder.Entity<UserGroupOverride>()
                .HasIndex(o => new { o.ClientId, o.SubjectId, o.Type })
                .IsUnique();

            modelBuilder.Entity<UserGroupOverride>()
                .HasOne(o => o.Subject)
                .WithMany()
                .HasForeignKey(o => o.SubjectId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}