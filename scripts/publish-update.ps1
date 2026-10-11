param(
  [string]$Server = 'admin@47.92.7.207',
  [Parameter(Mandatory = $true)][string]$Notes,
  [string]$Installer
)
$ErrorActionPreference = 'Stop'
if ($Server -notmatch '^[a-zA-Z0-9_.-]+@[a-zA-Z0-9.-]+$') { throw 'Invalid SSH target.' }
$repo = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -LiteralPath (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') { throw 'A stable three-part version is required.' }
if (!$Installer) { $Installer = Join-Path $repo "target/release/bundle/nsis/小黑盒盒_${version}_x64-setup.exe" }
$file = Get-Item -LiteralPath $Installer
if ($file.VersionInfo.ProductName -ne '小黑盒盒' -or $file.VersionInfo.ProductVersion -ne $version) { throw 'Installer version does not match package.json.' }
if ([Text.Encoding]::UTF8.GetByteCount($Notes) -gt 16384) { throw 'Release notes are too long.' }
$uploadId = [Guid]::NewGuid().ToString('N')
$stage = Join-Path $repo "output/releases/$version-$uploadId"
New-Item -ItemType Directory -Path $stage -Force | Out-Null
$manifest = [ordered]@{
  version = $version
  notes = $Notes
  publishedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
  platform = 'windows-x86_64'
  downloadUrl = "https://cjbtj.xyz/xiaoheihehe/releases/$version/xiaoheihehe_${version}_x64-setup.exe"
  sha256 = (Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
  size = $file.Length
}
[IO.File]::WriteAllText((Join-Path $stage 'manifest.json'), ($manifest | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
$remote = "/tmp/heybox-release-$uploadId"
& ssh -o BatchMode=yes -o ConnectTimeout=10 $Server "mkdir -m 700 $remote"
if ($LASTEXITCODE) { throw 'Cannot create remote staging directory.' }
& scp -o BatchMode=yes -- $Installer "${Server}:$remote/installer.exe"
if ($LASTEXITCODE) { throw 'Installer upload failed.' }
& scp -o BatchMode=yes -- (Join-Path $stage 'manifest.json') "${Server}:$remote/manifest.json"
if ($LASTEXITCODE) { throw 'Manifest upload failed.' }
& ssh -o BatchMode=yes $Server "sudo -n python3 /opt/xiaoheihehe-updates/publish.py $remote"
if ($LASTEXITCODE) { throw 'Publishing failed; latest version was not changed.' }
$online = Invoke-RestMethod -Uri 'https://cjbtj.xyz/xiaoheihehe/api/version' -Headers @{ 'Cache-Control' = 'no-cache' }
if ($online.version -ne $version -or $online.sha256 -ne $manifest.sha256) { throw 'Public version verification failed.' }
Write-Host "Published and verified $version. Local manifest: $stage/manifest.json"
