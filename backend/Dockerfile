# Stage 1: Build .NET API & Libraries
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project files for caching restore layer
COPY backend/Directory.Build.props backend/
COPY backend/Ayni.sln backend/
COPY backend/src/Ayni.Core/Ayni.Core.csproj backend/src/Ayni.Core/
COPY backend/src/Ayni.Infrastructure/Ayni.Infrastructure.csproj backend/src/Ayni.Infrastructure/
COPY backend/src/Ayni.Api/Ayni.Api.csproj backend/src/Ayni.Api/

RUN dotnet restore backend/src/Ayni.Api/Ayni.Api.csproj

# Copy backend source files
COPY backend/src/ backend/src/

# Publish Release build
RUN dotnet publish backend/src/Ayni.Api/Ayni.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime image with .NET 9 + Python 3 for AI Agents
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Install Python 3, pip, venv for the AI agent runner
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up AI Agents virtual environment
WORKDIR /app/ai-agents
COPY ai-agents/requirements.txt .
RUN python3 -m venv .venv && \
    .venv/bin/pip install --no-cache-dir -r requirements.txt
COPY ai-agents/ .

# Copy published .NET application
WORKDIR /app
COPY --from=build /app/publish .

# Environment defaults
ENV ASPNETCORE_URLS=http://+:5000 \
    ASPNETCORE_ENVIRONMENT=Development \
    PYTHON_PATH=/app/ai-agents/.venv/bin/python3 \
    AI_AGENTS_RUNNER_PATH=/app/ai-agents/runner.py

EXPOSE 5000

ENTRYPOINT ["dotnet", "Ayni.Api.dll"]
