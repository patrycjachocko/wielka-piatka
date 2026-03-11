using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using wielkapiatka.Data;
using wielkapiatka.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Rejestracja bazy danych SQLite
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2. Dodanie obsługi CORS (pozwala Vue na porcie 5173 na komunikację z API)
builder.Services.AddCors(options =>
{
    options.AddPolicy("VueCorsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// 3. Dodanie kontrolerów
builder.Services.AddControllers();

// 4. Natywne OpenAPI dla .NET (zamiast Swashbuckle)
builder.Services.AddOpenApi();

// 5. Rejestracja HttpClient i serwisu API Degra
builder.Services.AddHttpClient<DegraApiService>();

// 6. Rejestracja serwisu synchronizacji jako singleton + hosted service
builder.Services.AddSingleton<ScheduleSyncService>();
builder.Services.AddHostedService(provider => provider.GetRequiredService<ScheduleSyncService>());

// 7. Serwis eksportu kalendarza (iCal / CalDAV)
builder.Services.AddScoped<CalendarExportService>();

var app = builder.Build();

// 7. Automatyczna migracja bazy przy starcie
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

// 8. Konfiguracja pipeline'u - zamiana Swaggera na Scalara
if (app.Environment.IsDevelopment())
{
    // Generuje plik openapi.json pod adresem /openapi/v1.json
    app.MapOpenApi(); 

    // Udostępnia piękny interfejs Scalar pod adresem /scalar/v1
    app.MapScalarApiReference(); 
}

app.UseCors("VueCorsPolicy");

app.UseAuthorization();

app.MapControllers();

app.Run();