$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
# Allow passing a custom port as first argument; default to 5522 to avoid conflicts
$port = if ($args.Count -ge 1) { $args[0] } else { 5522 }
$prefix = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $root at $prefix"
Start-Process $prefix | Out-Null
try {
  while ($true) {
    try {
      $ctx = $listener.GetContext()
      $req = $ctx.Request
      $localPath = $req.Url.LocalPath.TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($localPath)) { $localPath = 'index.html' }
      $path = [System.IO.Path]::Combine($root, $localPath)
      if ([System.IO.Directory]::Exists($path)) { $path = [System.IO.Path]::Combine($path, 'index.html') }
      Write-Host "→" $req.HttpMethod $localPath

      if (-not [System.IO.File]::Exists($path)) {
        $ctx.Response.StatusCode = 404
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
        $ctx.Response.Headers['Cache-Control'] = 'no-cache'
        $ctx.Response.Close()
        continue
      }

      $bytes = [System.IO.File]::ReadAllBytes($path)
      $lower = $path.ToLower()
      $mime = 'text/html'
      if ($lower.EndsWith('.css')) { $mime = 'text/css' }
      elseif ($lower.EndsWith('.js')) { $mime = 'application/javascript' }
      elseif ($lower.EndsWith('.mjs')) { $mime = 'application/javascript' }
      elseif ($lower.EndsWith('.json')) { $mime = 'application/json' }
      elseif ($lower.EndsWith('.map')) { $mime = 'application/json' }
      elseif ($lower.EndsWith('.png')) { $mime = 'image/png' }
      elseif ($lower.EndsWith('.jpg') -or $lower.EndsWith('.jpeg')) { $mime = 'image/jpeg' }
      elseif ($lower.EndsWith('.webp')) { $mime = 'image/webp' }
      elseif ($lower.EndsWith('.gif')) { $mime = 'image/gif' }
      elseif ($lower.EndsWith('.svg')) { $mime = 'image/svg+xml' }
      elseif ($lower.EndsWith('.ico')) { $mime = 'image/x-icon' }
      elseif ($lower.EndsWith('.pdf')) { $mime = 'application/pdf' }
      elseif ($lower.EndsWith('.txt')) { $mime = 'text/plain' }
      elseif ($lower.EndsWith('.woff')) { $mime = 'font/woff' }
      elseif ($lower.EndsWith('.woff2')) { $mime = 'font/woff2' }
      elseif ($lower.EndsWith('.ttf')) { $mime = 'font/ttf' }

      $ctx.Response.ContentType = $mime
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.Headers['Cache-Control'] = 'no-cache'
      $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
      $ctx.Response.Close()
    }
    catch {
      try {
        $ctx.Response.StatusCode = 500
        $err = "Internal Server Error: $($_.Exception.Message)"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($err)
        $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
        $ctx.Response.Headers['Cache-Control'] = 'no-cache'
        $ctx.Response.Close()
      } catch {}
      Write-Warning $_
    }
  }
}
finally {
  try { $listener.Stop() } catch {}
}
