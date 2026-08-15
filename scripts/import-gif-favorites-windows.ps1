$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoDir = Split-Path -Parent $ScriptDir
$NodeScript = Join-Path $RepoDir "scripts/import-gif-favorites.mjs"
$TokenWasPrompted = $false

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js 18+ est requis."
}

if (-not $env:DISCORD_TOKEN) {
    $SecureToken = Read-Host "Discord token" -AsSecureString
    $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
    try {
        $env:DISCORD_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
        $TokenWasPrompted = $true
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
    }
}

try {
    node $NodeScript @args
} finally {
    if ($TokenWasPrompted) {
        Remove-Item Env:\DISCORD_TOKEN -ErrorAction SilentlyContinue
    }
}
