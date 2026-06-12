using TimetableApp.Contracts.Messaging;
using PlansService.Endpoints;
using PlansService.Persistence;
using PlansService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(
    builder.Configuration.GetSection("RabbitMq").Get<RabbitMqHttpOptions>() ?? new RabbitMqHttpOptions());
builder.Services.AddHttpClient("RabbitMqManagement");
builder.Services.AddSingleton(sp => new RabbitMqHttpEventBus(
    sp.GetRequiredService<IHttpClientFactory>().CreateClient("RabbitMqManagement"),
    sp.GetRequiredService<RabbitMqHttpOptions>()));

builder.Services.AddSingleton<JsonPlansStore>();
builder.Services.AddSingleton<ScheduleProjectionService>();
builder.Services.AddSingleton<IcsExportService>();
builder.Services.AddHostedService<TimetableEventsConsumer>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("Content-Disposition"));
});
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "PlansService" }));
app.MapPlansEndpoints();
app.Run();
