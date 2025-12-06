param(
    [Parameter(Mandatory=$true)][string]$RepoUrl,
    [string]$Branch = 'main'
)

$ErrorActionPreference = 'Stop'

function Run-Git($args) {
    Write-Host "git $args" -ForegroundColor Cyan
    git $args
}

# Check git
try { Run-Git '--version' | Out-Null } catch { Write-Error 'Git is not installed or not available on PATH.'; exit 1 }

# Init repo if not initialized
if (-not (Test-Path '.git')) {
    Run-Git 'init'
}

# Ensure branch
try {
    Run-Git "branch -M $Branch"
} catch { }

# Add files
Run-Git 'add index.html script.js style.css dev-server.ps1 DEPLOY.md'

# Commit
try {
    Run-Git 'commit -m "Initial or update deploy"'
} catch {
    Write-Host 'Nothing to commit or commit failed (possibly empty changes).' -ForegroundColor Yellow
}

# Add remote if missing
$remotes = git remote
if (-not ($remotes -match 'origin')) {
    Run-Git "remote add origin $RepoUrl"
}

# Push
Run-Git "push -u origin $Branch"

Write-Host "Pushed to $RepoUrl ($Branch)." -ForegroundColor Green
Write-Host 'Next: Enable GitHub Pages: Settings > Pages > Source = Deploy from a branch > Branch = main > /' -ForegroundColor Yellow