param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$estudioRoot = [System.IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$estudioLocal = Join-Path $estudioRoot '.local'
$estudioUrl = 'http://localhost:3000'
$estudioMutex = New-Object System.Threading.Mutex($false, 'Local\ESTUDIO_OS_Launcher')
$estudioLocked = $false
function Test-EstudioReady {
    try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/acceso' -UseBasicParsing -TimeoutSec 2
        return ($response.StatusCode -eq 200 -and $response.Content -match '<title>[^<]*ESTUDIO OS')
    } catch { return $false }
}
function Show-EstudioError([string]$message) {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show($message, 'ESTUDIO OS', 'OK', 'Error')
}
try {
    # Un doble clic repetido no abre varios servidores ni varias ventanas.
    try { $estudioLocked = $estudioMutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $estudioLocked = $true }
    if (-not $estudioLocked) { exit 0 }
    if (-not (Test-EstudioReady)) {
        $tcp = New-Object System.Net.Sockets.TcpClient
        try {
            $connection = $tcp.ConnectAsync('127.0.0.1', 3000)
            if ($connection.Wait(700) -and $tcp.Connected) {
                throw 'El puerto 3000 lo esta usando otro proceso. Cierra la otra aplicacion e intenta nuevamente.'
            }
        } catch [System.AggregateException] { } finally { $tcp.Dispose() }
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $nodeCommand) { throw 'No se encuentra Node.js. Revisa la instalacion de ESTUDIO OS.' }
        $next = Join-Path $estudioRoot 'node_modules\next\dist\bin\next'
        if (-not (Test-Path -LiteralPath $next)) { throw 'Faltan las dependencias del estudio. Solicita preparar la instalacion.' }
        [void][System.IO.Directory]::CreateDirectory($estudioLocal)
        if (-not (Test-Path -LiteralPath (Join-Path $estudioRoot '.next\BUILD_ID'))) {
            $build = Start-Process -FilePath $nodeCommand.Source -ArgumentList ('"' + $next + '" build --webpack') -WorkingDirectory $estudioRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $estudioLocal 'launcher-build.log') -RedirectStandardError (Join-Path $estudioLocal 'launcher-build-error.log') -PassThru -Wait
            if ($build.ExitCode -ne 0) { throw 'No se pudo preparar la aplicacion. Solicita revisar la compilacion antes de continuar.' }
        }
        $server = Start-Process -FilePath $nodeCommand.Source -ArgumentList ('"' + $next + '" start --hostname 0.0.0.0 --port 3000') -WorkingDirectory $estudioRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $estudioLocal 'launcher-server.log') -RedirectStandardError (Join-Path $estudioLocal 'launcher-server-error.log') -PassThru
        $ready = $false
        for ($attempt = 0; $attempt -lt 45; $attempt++) {
            if (Test-EstudioReady) { $ready = $true; break }
            $server.Refresh()
            if ($server.HasExited) { break }
            Start-Sleep -Milliseconds 1000
        }
        if (-not $ready) { throw 'ESTUDIO OS no termino de iniciar. No se modificaron tus datos; solicita revisar el inicio del servidor.' }
        @{ processId = $server.Id; startedAt = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $estudioLocal 'launcher-process.json') -Encoding UTF8
    }
    if (-not $NoBrowser) { Start-Process $estudioUrl }
} catch {
    if ($NoBrowser) { Write-Output 'No se pudo iniciar ESTUDIO OS.'; exit 1 }
    Show-EstudioError $_.Exception.Message
    exit 1
} finally {
    if ($estudioLocked) { $estudioMutex.ReleaseMutex() }
    $estudioMutex.Dispose()
}
