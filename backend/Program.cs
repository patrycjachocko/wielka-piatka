using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using wielkapiatka.Data;

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

var app = builder.Build();

// 5. Konfiguracja pipeline'u - zamiana Swaggera na Scalara
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