$envFile = Join-Path (Get-Location) ".env"
if (!(Test-Path $envFile)) {
  Write-Error ".env topilmadi"
  exit 1
}

$dbLine = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $dbLine) {
  Write-Error "DATABASE_URL topilmadi"
  exit 1
}

$databaseUrl = ($dbLine -replace '^DATABASE_URL=', '').Trim().Trim('"')
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
  Write-Error "DATABASE_URL bo'sh"
  exit 1
}

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$name = "manual_diff_$stamp"
$folder = Join-Path "prisma/migrations" $name
New-Item -ItemType Directory -Force -Path $folder | Out-Null

Write-Output "Migration folder: $folder"

$migrationPath = Join-Path $folder "migration.sql"
npx prisma migrate diff --from-url $databaseUrl --to-schema-datamodel prisma/schema.prisma --script | Set-Content -Path $migrationPath

Write-Output "OK: $migrationPath"
