param(
  [ValidateSet('Test','DesktopTest','Backend','Desktop','Build','Check','AvatarCheck','ContentCheck','UserHomeCheck','EmojiCheck','CommunityIconCheck','CommentImageCheck')][string]$Mode = 'Test',
  [string]$ConfigPath,
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo
$locator = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$vsRoot = & $locator -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (!$vsRoot) { throw 'Install Visual Studio Build Tools with MSVC C++ tools and the Windows SDK.' }
$compiler = Get-ChildItem -LiteralPath (Join-Path $vsRoot 'VC/Tools/MSVC') -Directory | Sort-Object Name -Descending | Select-Object -First 1
$sdkRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10'
$sdk = Get-ChildItem -LiteralPath (Join-Path $sdkRoot 'Lib') -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'um/x64/kernel32.lib') } | Sort-Object Name -Descending | Select-Object -First 1
if (!$compiler -or !$sdk) { throw 'MSVC or Windows SDK installation is incomplete.' }
$env:PATH = (Join-Path $compiler.FullName 'bin/Hostx64/x64') + ';' + (Join-Path $sdkRoot "bin/$($sdk.Name)/x64") + ';' + $env:PATH
$env:LIB = (Join-Path $compiler.FullName 'lib/x64') + ';' + (Join-Path $sdk.FullName 'um/x64') + ';' + (Join-Path $sdk.FullName 'ucrt/x64')
$env:INCLUDE = (Join-Path $compiler.FullName 'include') + ';' + (Join-Path $sdkRoot "Include/$($sdk.Name)/ucrt") + ';' + (Join-Path $sdkRoot "Include/$($sdk.Name)/um") + ';' + (Join-Path $sdkRoot "Include/$($sdk.Name)/shared")
$env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = Join-Path $compiler.FullName 'bin/Hostx64/x64/link.exe'
$env:CARGO_BUILD_JOBS = '6'
if ($CheckOnly) {
  Write-Host 'MSVC and Windows SDK are ready.'
  exit 0
}
switch ($Mode) {
  'Test' { & cargo test -p heybox-backend --features server }
  'DesktopTest' { & cargo test -p heybox-community }
  'Backend' { & cargo run -p heybox-backend --features server --bin heybox-dev-server }
  'Check' { & cargo check -p heybox-community }
  'AvatarCheck' { & cargo run -p heybox-backend --example check_account_avatar }
  'ContentCheck' { & cargo run -p heybox-backend --example check_post_content }
  'UserHomeCheck' { & cargo run -p heybox-backend --example check_user_home }
  'EmojiCheck' { & cargo run -p heybox-backend --example check_emojis }
  'CommunityIconCheck' { & cargo run -p heybox-backend --example check_community_icons }
  'CommentImageCheck' { & cargo run -p heybox-backend --example check_comment_images }
  'Desktop' {
    if ($ConfigPath) { & npm exec -- tauri dev --config $ConfigPath }
    else { & npm exec -- tauri dev }
  }
  'Build' { & npm exec tauri build }
}
exit $LASTEXITCODE
