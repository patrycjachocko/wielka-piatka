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
    }
}