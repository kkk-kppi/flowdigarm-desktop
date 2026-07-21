$ErrorActionPreference = 'Stop'

$waitSeconds = 8
$executable = Join-Path $PSScriptRoot '..\src-tauri\target\release\flowchart-editor.exe'
if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
  throw "Windows release executable not found: $executable"
}

$file = Get-Item -LiteralPath $executable
$process = $null

try {
  $process = Start-Process -FilePath $file.FullName -PassThru
  Start-Sleep -Seconds $waitSeconds
  $process.Refresh()
  if ($process.HasExited) {
    throw "Windows startup smoke failed: process exited with code $($process.ExitCode)."
  }

  "Windows startup smoke: PASS (process survival only; UI semantics not asserted)."
  "PID: $($process.Id)"
  "Path: $($file.FullName)"
  "SizeBytes: $($file.Length)"
  "ObservedSeconds: $waitSeconds"
}
finally {
  if ($null -ne $process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id
    Wait-Process -Id $process.Id -ErrorAction SilentlyContinue
  }
}
