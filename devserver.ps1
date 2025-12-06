$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:5500/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $pwd at $prefix"
while ($true) {
  $context = $listener.GetContext()
  $request = $context.Request
  $path = [System.Web.HttpUtility]::UrlDecode($request.Url.AbsolutePath.TrimStart('/'))
  if ([string]::IsNullOrWhiteSpace($path)) { $path = "index.html" }
  $file = Join-Path $pwd $path
  if (Test-Path $file) {
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    switch ($ext) {
      ".html" { $context.Response.ContentType = "text/html" }
      ".htm"  { $context.Response.ContentType = "text/html" }
      ".css"  { $context.Response.ContentType = "text/css" }
      ".js"   { $context.Response.ContentType = "application/javascript" }
      ".png"  { $context.Response.ContentType = "image/png" }
      ".jpg"  { $context.Response.ContentType = "image/jpeg" }
      ".jpeg" { $context.Response.ContentType = "image/jpeg" }
      ".svg"  { $context.Response.ContentType = "image/svg+xml" }
      default  { $context.Response.ContentType = "application/octet-stream" }
    }
    $context.Response.StatusCode = 200
    $context.Response.OutputStream.Write($bytes,0,$bytes.Length)
  } else {
    $msg = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
    $context.Response.StatusCode = 404
    $context.Response.OutputStream.Write($msg,0,$msg.Length)
  }
  $context.Response.OutputStream.Close()
}