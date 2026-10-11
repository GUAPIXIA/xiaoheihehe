param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo

try {
  # Support double-click launches whose inherited PATH has not been refreshed.
  $toolDirectories = @(
    (Join-Path $env:ProgramFiles 'nodejs'),
    (Join-Path $env:USERPROFILE '.cargo/bin'),
    'D:/npx',
    'E:/tools/rust/cargo/bin'
  )
  if ($env:CARGO_HOME) { $toolDirectories += Join-Path $env:CARGO_HOME 'bin' }
  foreach ($toolDirectory in $toolDirectories) {
    if (Test-Path -LiteralPath $toolDirectory -PathType Container) {
      $env:PATH += ';' + $toolDirectory
    }
  }
  foreach ($tool in @('node.exe', 'npm.cmd', 'cargo.exe')) {
    if (!(Get-Command $tool -ErrorAction SilentlyContinue)) { throw "找不到 $tool，请先安装 Node.js 和 Rust MSVC 工具链。" }
  }

  $reuseServer = $false
  $listeners = @(Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)
  foreach ($listener in $listeners) {
    $serverProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $listener.OwningProcess)
    $commandLine = ([string]$serverProcess.CommandLine).Replace('\', '/').ToLowerInvariant()
    $projectPath = $repo.Replace('\', '/').ToLowerInvariant() + '/'
    if (!$commandLine.Contains($projectPath) -or !$commandLine.Contains('/vite/')) {
      throw "5173 端口被其他程序占用（进程 $($listener.OwningProcess)），请关闭它后重新启动。"
    }
    $reuseServer = $true
  }
  if ($reuseServer) {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 5
    # Vite appends a timestamp query to the entry module after a hot update.
    if ($response.Content -notmatch 'src="/src/main\.tsx(?:\?[^"\r\n]*)?"') { throw '现有预览服务尚未就绪，请稍后重试。' }
    Write-Host '已检测到本项目的预览服务，将自动复用。'
  }

  if ($CheckOnly) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'native.ps1') -Mode Desktop -CheckOnly
    if ($LASTEXITCODE -ne 0) { throw '桌面开发环境检查失败。' }
    Write-Host '启动环境检查通过。'
    exit 0
  }

  if (!(Test-Path -LiteralPath 'node_modules/.bin/tauri.cmd') -or !(Test-Path -LiteralPath 'node_modules/.bin/vite.cmd')) {
    Write-Host '首次运行，正在安装项目依赖…'
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw '项目依赖安装失败。' }
  }

  $nativeArguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'native.ps1'), '-Mode', 'Desktop')
  if ($reuseServer) {
    $launchDirectory = Join-Path $repo 'output/dev-launch'
    New-Item -ItemType Directory -Path $launchDirectory -Force | Out-Null
    $configPath = Join-Path $launchDirectory 'reuse-vite.json'
    [IO.File]::WriteAllText($configPath, '{"build":{"beforeDevCommand":null}}', [Text.UTF8Encoding]::new($false))
    $nativeArguments += @('-ConfigPath', $configPath)
  }
  Write-Host '正在启动小黑盒盒开发版。首次编译可能需要几分钟。'
  Write-Host '请保留此窗口；界面修改会自动刷新。在此窗口按 Ctrl+C 停止开发进程。'
  & powershell.exe @nativeArguments
  exit $LASTEXITCODE
} catch {
  Write-Host ('启动失败：' + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
