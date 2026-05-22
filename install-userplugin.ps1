param(
    [string]$VencordPath = $env:VENCORD_DIR
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginDir = Join-Path $ScriptDir "gifFolders"

if ([string]::IsNullOrWhiteSpace($VencordPath)) {
    $Candidate = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Vencord"

    if (Test-Path (Join-Path $Candidate "src")) {
        $VencordPath = $Candidate
    } else {
        throw "Usage: .\install-userplugin.ps1 -VencordPath C:\path\to\Vencord. You can also set VENCORD_DIR."
    }
}

if (!(Test-Path $PluginDir)) {
    throw "Plugin folder not found: $PluginDir"
}

$SourceDir = Join-Path $VencordPath "src"
if (!(Test-Path $SourceDir)) {
    throw "This does not look like a Vencord source folder: $VencordPath. Expected to find: $SourceDir"
}

$TargetDir = Join-Path $SourceDir "userplugins\gifFolders"

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
Copy-Item -Path (Join-Path $PluginDir "*") -Destination $TargetDir -Recurse -Force

Write-Host "GifFolders copied to: $TargetDir"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  cd `"$VencordPath`""
Write-Host "  pnpm build --dev"
Write-Host ""
Write-Host "Discord Desktop:"
Write-Host "  pnpm inject"
Write-Host "  Restart Discord, then enable GifFolders in Vencord plugins."
Write-Host ""
Write-Host "Vesktop:"
Write-Host "  Open Vesktop Settings > Vencord Location > Change"
Write-Host "  Select: $VencordPath\dist"
Write-Host "  Fully restart Vesktop, then enable GifFolders in Vencord plugins."
