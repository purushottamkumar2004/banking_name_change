# ============================================================================
# Name Change System - Automated Deployment Setup (PowerShell)
# ============================================================================
# This script helps you set up GitHub Actions for automated deployment
# ============================================================================

Write-Host "🚀 Name Change System - Deployment Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Step 1: Vercel Setup
# ============================================================================
Write-Host "Step 1: Vercel Setup" -ForegroundColor Blue
Write-Host "Follow these steps:" -ForegroundColor White
Write-Host "1. Go to https://vercel.com/account/tokens"
Write-Host "2. Click 'Create Token'"
Write-Host "3. Name it: 'GitHub Actions'"
Write-Host "4. Copy the token"
Write-Host ""

$VERCEL_TOKEN = Read-Host "Paste your Vercel Token"
$VERCEL_ORG_ID = Read-Host "Enter your Vercel Organization ID (from dashboard URL)"
$VERCEL_PROJECT_ID = Read-Host "Enter your Vercel Project ID (project settings)"

Write-Host "✓ Vercel tokens captured" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 2: Render Setup
# ============================================================================
Write-Host "Step 2: Render Setup" -ForegroundColor Blue
Write-Host "Follow these steps:" -ForegroundColor White
Write-Host "1. Go to https://dashboard.render.com/services"
Write-Host "2. Click on 'name-change-backend' service"
Write-Host "3. Go to 'Settings' → 'Deploy Hook'"
Write-Host "4. Copy the Deploy URL"
Write-Host ""

$RENDER_DEPLOY_URL = Read-Host "Paste your Render Deploy Hook URL"

# Extract service ID and key from URL
if ($RENDER_DEPLOY_URL -match "srv-([a-z0-9]+)") {
    $RENDER_SERVICE_ID = $matches[1]
}
if ($RENDER_DEPLOY_URL -match "key=([a-zA-Z0-9_-]+)") {
    $RENDER_DEPLOY_KEY = $matches[1]
}

Write-Host "✓ Render credentials extracted" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 3: Add GitHub Secrets
# ============================================================================
Write-Host "Step 3: Adding GitHub Secrets" -ForegroundColor Blue
Write-Host ""

# Check if gh CLI is installed
$ghInstalled = $null -ne (Get-Command gh -ErrorAction SilentlyContinue)

if (-not $ghInstalled) {
    Write-Host "⚠️  GitHub CLI not found. Please install it:" -ForegroundColor Yellow
    Write-Host "   https://cli.github.com"
    Write-Host ""
    Write-Host "After installing, run these commands in PowerShell:" -ForegroundColor White
    Write-Host ""
    Write-Host "gh secret set VERCEL_TOKEN --body '$VERCEL_TOKEN'" -ForegroundColor Yellow
    Write-Host "gh secret set VERCEL_ORG_ID --body '$VERCEL_ORG_ID'" -ForegroundColor Yellow
    Write-Host "gh secret set VERCEL_PROJECT_ID --body '$VERCEL_PROJECT_ID'" -ForegroundColor Yellow
    Write-Host "gh secret set RENDER_SERVICE_ID --body '$RENDER_SERVICE_ID'" -ForegroundColor Yellow
    Write-Host "gh secret set RENDER_DEPLOY_KEY --body '$RENDER_DEPLOY_KEY'" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Add secrets using GitHub CLI
Write-Host "Adding secrets to GitHub..." -ForegroundColor White
gh secret set VERCEL_TOKEN --body $VERCEL_TOKEN
gh secret set VERCEL_ORG_ID --body $VERCEL_ORG_ID
gh secret set VERCEL_PROJECT_ID --body $VERCEL_PROJECT_ID
gh secret set RENDER_SERVICE_ID --body $RENDER_SERVICE_ID
gh secret set RENDER_DEPLOY_KEY --body $RENDER_DEPLOY_KEY

Write-Host "✓ Secrets added to GitHub" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 4: Success
# ============================================================================
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Push changes to feature/deployment-vercel-render branch"
Write-Host "2. GitHub Actions will automatically trigger"
Write-Host "3. Monitor at: https://github.com/[owner]/[repo]/actions"
Write-Host "4. Your app will be live at:" -ForegroundColor Cyan
Write-Host "   - Frontend: https://name-change-frontend.vercel.app"
Write-Host "   - Backend:  https://name-change-backend.onrender.com"
Write-Host ""
