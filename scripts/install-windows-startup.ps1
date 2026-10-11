$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$NodePath = (Get-Command node.exe -ErrorAction Stop).Source
$Runner = Join-Path $PSScriptRoot "home-server.mjs"
$EnvironmentFile = Join-Path $ProjectRoot ".env.local"
if (!(Test-Path (Join-Path $ProjectRoot ".next\BUILD_ID"))) {
  throw "Run npm run build before registering startup."
}
if (!(Test-Path $EnvironmentFile)) {
  throw "Create .env.local before registering startup."
}
$Arguments = "--env-file-if-exists=`"$EnvironmentFile`" `"$Runner`""
$Action = New-ScheduledTaskAction -Execute $NodePath -Argument $Arguments -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "ArtificialMana" -Action $Action -Trigger $Trigger -Settings $Settings -Description "Artificial Mana localhost server; starts when this Windows user signs in." | Out-Null
Write-Host "Startup registered for this Windows user's sign-in."
Write-Host "Start now: Start-ScheduledTask -TaskName ArtificialMana"
