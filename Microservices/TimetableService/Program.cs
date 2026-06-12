using Microsoft.EntityFrameworkCore;
using TimetableApp.Contracts.Messaging;
using TimetableService.Data;
using TimetableService.Endpoints;
using TimetableService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<TimetableDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("TimetableDb")
        ?? "Data Source=timetable-service.db";
    options.UseSqlite(connectionString);
});

builder.Services.AddSingleton(
    builder.Configuration.GetSection("RabbitMq").Get<RabbitMqHttpOptions>() ?? new RabbitMqHttpOptions());
builder.Services.AddHttpClient("RabbitMqManagement");
builder.Services.AddScoped(sp => new RabbitMqHttpEventBus(
    sp.GetRequiredService<IHttpClientFactory>().CreateClient("RabbitMqManagement"),
    sp.GetRequiredService<RabbitMqHttpOptions>()));

builder.Services.AddHttpClient<TimetableSyncService>();
builder.Services.AddHostedService<TimetableSyncWorker>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("Content-Disposition"));
});
builder.Services.AddOpenApi();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TimetableDbContext>();
    db.Database.EnsureCreated();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "TimetableService" }));
app.MapTimetableEndpoints();
app.MapSyncEndpoints();

app.Run();
