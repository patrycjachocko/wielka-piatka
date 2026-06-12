FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Microservices/Contracts/TimetableApp.Contracts.csproj Microservices/Contracts/
COPY Microservices/TimetableService/TimetableService.csproj Microservices/TimetableService/
RUN dotnet restore Microservices/TimetableService/TimetableService.csproj

COPY Microservices/Contracts/ Microservices/Contracts/
COPY Microservices/TimetableService/ Microservices/TimetableService/
RUN dotnet publish Microservices/TimetableService/TimetableService.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "TimetableService.dll"]
