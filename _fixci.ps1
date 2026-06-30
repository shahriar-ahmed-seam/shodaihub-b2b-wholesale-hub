$ErrorActionPreference = 'Continue'
Set-Location c:\Projects\B2B-Wholesale-Hub
$log = @()

# Remove the deploy workflow (GHCR push + deploy hooks add no value here; Vercel handles FE deploys).
git rm -q .github/workflows/deploy.yml 2>&1 | Out-Null
$log += "removed deploy.yml: exit $LASTEXITCODE"

# Mark gradlew executable in the index (so it works on Linux if the wrapper is used).
git update-index --chmod=+x services/inventory/gradlew 2>&1 | Out-Null
$log += "gradlew +x: exit $LASTEXITCODE"

# Remove stray local build logs (gitignored, but clutter the working dir).
Get-ChildItem -Path . -File -Filter 'build-*.log' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Remove-Item -Force frontend/build-output.log -ErrorAction SilentlyContinue
Remove-Item -Force _ci.txt,_node.txt,_full.txt,_chk.txt -ErrorAction SilentlyContinue

git add -A 2>&1 | Out-Null
git commit -m "ci: lean, reliable pipeline (Node 22, gradle compile, skip ES); drop GHCR deploy workflow" 2>&1 | Out-Null
$log += "commit: exit $LASTEXITCODE"
git push origin main 2>&1 | Out-Null
$log += "push: exit $LASTEXITCODE"

$log -join "`n" | Set-Content _fixci.txt
