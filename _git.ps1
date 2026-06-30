$ErrorActionPreference = 'Continue'
Set-Location c:\Projects\B2B-Wholesale-Hub
$log = @()

if (-not (Test-Path .git)) {
  git init 2>&1 | Out-Null
  $log += 'git init: created'
} else {
  $log += 'git init: already a repo'
}
git symbolic-ref HEAD refs/heads/main 2>&1 | Out-Null

# Configure identity if missing (local only)
if (-not (git config user.email)) { git config user.email "shahriar.ahmed.seam@users.noreply.github.com" }
if (-not (git config user.name))  { git config user.name  "shahriar-ahmed-seam" }

git add -A 2>&1 | Out-Null

# SAFETY: ensure no secrets / .kiro are staged
$staged = git diff --cached --name-only 2>&1
$bad = $staged | Where-Object { $_ -match '(^|/)\.kiro/' -or $_ -match '(^|/)\.env($|\.)' -or $_ -match 'docker-compose\.override\.yml' -or $_ -match '\.pem$' -or $_ -match '\.key$' }
$log += "staged files: $(@($staged).Count)"
$log += "SENSITIVE staged (should be EMPTY): [$([string]::Join(', ', @($bad)))]"
$log += "kiro present on disk: $(Test-Path .kiro)"

$log -join "`n" | Set-Content _git.txt
