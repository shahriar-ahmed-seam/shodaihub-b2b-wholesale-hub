$ErrorActionPreference = 'Continue'
Set-Location c:\Projects\B2B-Wholesale-Hub\frontend
$tok = $env:VERCEL_TOKEN
$log = @()

# Link (create if missing) the project non-interactively.
npx --yes vercel@latest link --yes --project shodaihub-b2b --token $tok *> ..\_vercel_link.log
$log += "link exit: $LASTEXITCODE"

# Deploy to production; capture stdout (last https line is the prod URL).
npx --yes vercel@latest deploy --prod --yes --token $tok *> ..\_vercel_deploy.log
$log += "deploy exit: $LASTEXITCODE"

$deployOut = Get-Content ..\_vercel_deploy.log -Raw
$urls = [regex]::Matches($deployOut, 'https://[a-zA-Z0-9._-]+\.vercel\.app') | ForEach-Object { $_.Value } | Select-Object -Unique
$log += "URLs: " + ($urls -join ', ')
$log -join "`n" | Set-Content ..\_deploy.txt
