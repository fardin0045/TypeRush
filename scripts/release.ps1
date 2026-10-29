$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
  npm.cmd run check
  if ($LASTEXITCODE -ne 0) { throw 'Release checks failed. No upload package was created.' }
  $outputFolder = Join-Path $projectRoot 'dist'
  foreach ($required in @('index.html', '_headers', 'favicon.svg', 'audio\mechanical\key-1.wav')) {
    if (-not (Test-Path -LiteralPath (Join-Path $outputFolder $required))) { throw "Missing release asset: $required" }
  }
  $releaseFolder = Join-Path $projectRoot 'release'
  New-Item -ItemType Directory -Force -Path $releaseFolder | Out-Null
  $archivePath = Join-Path $releaseFolder 'typerush-site.zip'
  Compress-Archive -Path (Join-Path $outputFolder '*') -DestinationPath $archivePath -Force
  $hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
  $archiveStream = [System.IO.File]::OpenRead($archivePath)
  try { $checksum = [System.BitConverter]::ToString($hashAlgorithm.ComputeHash($archiveStream)).Replace('-', '') }
  finally { $archiveStream.Dispose(); $hashAlgorithm.Dispose() }
  "$checksum  typerush-site.zip" | Set-Content -LiteralPath (Join-Path $releaseFolder 'typerush-site.sha256')
  Write-Output "Ready to upload: $archivePath"
} finally { Pop-Location }
