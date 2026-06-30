$ErrorActionPreference = 'Continue'
Set-Location c:\Projects\B2B-Wholesale-Hub
$log = @()
# Make sure the Vercel link dir is not tracked
git rm -r --cached frontend/.vercel 2>&1 | Out-Null
git add -A 2>&1 | Out-Null
$staged = git diff --cached --name-only 2>&1
$bad = $staged | Where-Object { $_ -match '(^|/)\.kiro/' -or $_ -match '(^|/)\.vercel/' -or $_ -match '(^|/)\.env$' -or $_ -match '(^|/)\.env\.local' -or $_ -match 'docker-compose\.override\.yml' }
$log += "to-commit: $(@($staged).Count) files"
$log += "SENSITIVE staged (should be EMPTY): [$([string]::Join(', ', @($bad)))]"
git commit -m "chore(vercel): add Next.js framework config and ignore .vercel" 2>&1 | Out-Null
$log += "commit exit: $LASTEXITCODE"
git push origin main 2>&1 | Out-Null
$log += "push exit: $LASTEXITCODE"
$log -join "`n" | Set-Content _git.txt
