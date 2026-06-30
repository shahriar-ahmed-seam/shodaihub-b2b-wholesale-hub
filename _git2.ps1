$ErrorActionPreference = 'Continue'
Set-Location c:\Projects\B2B-Wholesale-Hub
$log = @()

git commit -m "feat: ShodaiHub B2B wholesale marketplace (microservices + Next.js storefront)" 2>&1 | Out-Null
$log += "commit exit: $LASTEXITCODE"

$desc = "ShodaiHub - a multi-vendor B2B wholesale marketplace for Bangladesh. Polyglot microservices (Node/Java/Python) with tiered pricing, Redis stock reservations, Elasticsearch fuzzy search, bKash/Nagad/SSLCommerz payments, and a responsive bilingual Next.js storefront."

# Create the GitHub repo (public), set origin, and push main.
gh repo create shodaihub-b2b-wholesale-hub --public --source . --remote origin --description $desc --push 2>&1 | Tee-Object -Variable createOut | Out-Null
$log += "repo create exit: $LASTEXITCODE"
$log += ($createOut | Out-String).Trim()

# Topics / tags
$repo = "shahriar-ahmed-seam/shodaihub-b2b-wholesale-hub"
gh repo edit $repo `
  --add-topic b2b --add-topic marketplace --add-topic wholesale --add-topic ecommerce `
  --add-topic microservices --add-topic nextjs --add-topic typescript --add-topic spring-boot `
  --add-topic fastapi --add-topic redis --add-topic elasticsearch --add-topic docker `
  --add-topic kubernetes --add-topic tailwindcss --add-topic bangladesh --add-topic vercel 2>&1 | Out-Null
$log += "topics exit: $LASTEXITCODE"

$url = gh repo view $repo --json url -q .url 2>&1
$log += "repo url: $url"

$log -join "`n" | Set-Content _git.txt
