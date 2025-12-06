param(
    [int]$Port = 5500,
    [string]$BindHost = 'localhost'
)

$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
$prefix = if ($BindHost -eq '*' -or $BindHost -eq '+') { "http://+:$Port/" } else { "http://${BindHost}:$Port/" }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
    $listener.Start()
} catch {
    Write-Host "Failed to start listener on $prefix" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "If binding to '*' or external IP, run (as Admin):" -ForegroundColor Yellow
    Write-Host "  netsh http add urlacl url=$prefix user=Everyone" -ForegroundColor Yellow
    exit 1
}

Write-Host "Serving $root at $prefix" -ForegroundColor Green

function Get-MimeType($ext) {
    switch ($ext.ToLowerInvariant()) {
        '.html' { 'text/html' }
        '.htm'  { 'text/html' }
        '.js'   { 'application/javascript' }
        '.css'  { 'text/css' }
        '.json' { 'application/json' }
        '.png'  { 'image/png' }
        '.jpg'  { 'image/jpeg' }
        '.jpeg' { 'image/jpeg' }
        '.svg'  { 'image/svg+xml' }
        '.ico'  { 'image/x-icon' }
        default { 'application/octet-stream' }
    }
}

while ($true) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.AbsolutePath.TrimStart('/')
        if (-not $path) { $path = 'index.html' }
        $filePath = Join-Path $root $path

        if (Test-Path $filePath) {
            try {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $ext = [System.IO.Path]::GetExtension($filePath)
                $response.ContentType = Get-MimeType $ext
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $response.StatusCode = 500
                $errorBytes = [System.Text.Encoding]::UTF8.GetBytes($_.ToString())
                $response.OutputStream.Write($errorBytes, 0, $errorBytes.Length)
            }
        } else {
            $response.StatusCode = 404
            $msgBytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
            $response.OutputStream.Write($msgBytes, 0, $msgBytes.Length)
        }
        $response.OutputStream.Close()
    } catch {
        Write-Host "Server error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
