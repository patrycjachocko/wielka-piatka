using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;
using TimetableApp.Endpoints;
using TimetableApp.Services;

var builder = WebApplication.CreateBuilder(args);

// SQLite
builder.Services.AddDbContext<TimetableDbContext>(options =>
    options.UseSqlite("Data Source=timetable.db"));

// HttpClient dla pobierania XML z API
builder.Services.AddHttpClient<ApiDataFetcher>();
builder.Services.AddScoped<ApiDataFetcher>();

// Background sync co godzinę
builder.Services.AddHostedService<XmlSyncBackgroundService>();

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .WithExposedHeaders("Content-Disposition");
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

// Tworzenie bazy danych
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TimetableDbContext>();
    db.Database.EnsureCreated();

    // Dodaj tabelę saved_schedules jeśli nie istnieje (EnsureCreated nie modyfikuje istniejącej bazy)
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS saved_schedules (
            Id INTEGER PRIMARY KEY AUTOINCREMENT,
            Name TEXT NOT NULL,
            ScheduleType TEXT NOT NULL,
            ConfigurationJson TEXT NOT NULL,
            CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
            UpdateSnapshotsJson TEXT,
            OverridesJson TEXT
        )
        """);

    // Dodaj kolumnę UpdateSnapshotsJson jeśli nie istnieje (migracja istniejącej bazy)
    try
    {
        db.Database.ExecuteSqlRaw("ALTER TABLE saved_schedules ADD COLUMN UpdateSnapshotsJson TEXT;");
    }
    catch { /* kolumna już istnieje */ }

    // Dodaj kolumnę OverridesJson jeśli nie istnieje
    try
    {
        db.Database.ExecuteSqlRaw("ALTER TABLE saved_schedules ADD COLUMN OverridesJson TEXT;");
    }
    catch { /* kolumna już istnieje */ }

    // Dodaj kolumnę IgnoredConflictIdsJson jeśli nie istnieje
    try
    {
        db.Database.ExecuteSqlRaw("ALTER TABLE saved_schedules ADD COLUMN IgnoredConflictIdsJson TEXT;");
    }
    catch { /* kolumna już istnieje */ }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();

// Endpointy API
app.MapStudiaEndpoints();
app.MapRozkladEndpoints();
app.MapNauczycielEndpoints();
app.MapKonfiguracjaEndpoints();
app.MapPowiadomieniaEndpoints();
app.MapSyncEndpoints();
app.MapEksportEndpoints();
app.MapScheduleEndpoints();

app.Run();
