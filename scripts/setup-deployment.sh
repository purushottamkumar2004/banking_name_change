#!/bin/bash

# ============================================================================
# Name Change System - Automated Deployment Setup Script
# ============================================================================
# This script helps you set up GitHub Actions for automated deployment
# ============================================================================

set -e

echo "🚀 Name Change System - Deployment Setup"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Step 1: Vercel Setup
# ============================================================================
echo -e "${BLUE}Step 1: Vercel Setup${NC}"
echo "Follow these steps:"
echo "1. Go to https://vercel.com/account/tokens"
echo "2. Click 'Create Token'"
echo "3. Name it: 'GitHub Actions'"
echo "4. Copy the token"
echo ""
read -p "Paste your Vercel Token: " VERCEL_TOKEN

echo ""
read -p "Enter your Vercel Organization ID (from dashboard URL): " VERCEL_ORG_ID
read -p "Enter your Vercel Project ID (project settings): " VERCEL_PROJECT_ID

echo -e "${GREEN}✓ Vercel tokens captured${NC}"
echo ""

# ============================================================================
# Step 2: Render Setup
# ============================================================================
echo -e "${BLUE}Step 2: Render Setup${NC}"
echo "Follow these steps:"
echo "1. Go to https://dashboard.render.com/services"
echo "2. Click on 'name-change-backend' service"
echo "3. Go to 'Settings' → 'Deploy Hook'"
echo "4. Copy the Deploy URL"
echo ""
read -p "Paste your Render Deploy Hook URL: " RENDER_DEPLOY_URL

# Extract service ID from URL
RENDER_SERVICE_ID=$(echo "$RENDER_DEPLOY_URL" | grep -oP 'srv-[^/?]+')
RENDER_DEPLOY_KEY=$(echo "$RENDER_DEPLOY_URL" | grep -oP 'key=\K[^&]+')

echo -e "${GREEN}✓ Render credentials extracted${NC}"
echo ""

# ============================================================================
# Step 3: Add GitHub Secrets
# ============================================================================
echo -e "${BLUE}Step 3: Adding GitHub Secrets${NC}"
echo ""
echo "GitHub CLI is required. Install from: https://cli.github.com"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI not found. Please install it:${NC}"
    echo "   https://cli.github.com"
    echo ""
    echo "After installing, run these commands:"
    echo ""
    echo "gh secret set VERCEL_TOKEN --body '$VERCEL_TOKEN'"
    echo "gh secret set VERCEL_ORG_ID --body '$VERCEL_ORG_ID'"
    echo "gh secret set VERCEL_PROJECT_ID --body '$VERCEL_PROJECT_ID'"
    echo "gh secret set RENDER_SERVICE_ID --body '$RENDER_SERVICE_ID'"
    echo "gh secret set RENDER_DEPLOY_KEY --body '$RENDER_DEPLOY_KEY'"
    exit 1
fi

# Add secrets using GitHub CLI
echo "Adding secrets to GitHub..."
gh secret set VERCEL_TOKEN --body "$VERCEL_TOKEN"
gh secret set VERCEL_ORG_ID --body "$VERCEL_ORG_ID"
gh secret set VERCEL_PROJECT_ID --body "$VERCEL_PROJECT_ID"
gh secret set RENDER_SERVICE_ID --body "$RENDER_SERVICE_ID"
gh secret set RENDER_DEPLOY_KEY --body "$RENDER_DEPLOY_KEY"

echo -e "${GREEN}✓ Secrets added to GitHub${NC}"
echo ""

# ============================================================================
# Step 4: Success
# ============================================================================
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Push changes to feature/deployment-vercel-render branch"
echo "2. GitHub Actions will automatically trigger"
echo "3. Monitor at: https://github.com/[owner]/[repo]/actions"
echo "4. Your app will be live at:"
echo "   - Frontend: https://name-change-frontend.vercel.app"
echo "   - Backend:  https://name-change-backend.onrender.com"
echo ""
