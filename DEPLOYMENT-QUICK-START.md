# 🚀 QUICK START: Deploy to Render + Vercel

Complete this checklist to deploy your application in ~30 minutes.

---

## ✅ Pre-Deployment Checklist

### Accounts & Credentials

- [ ] **Vercel Account**
  - [ ] Create account at https://vercel.com
  - [ ] Create personal access token at https://vercel.com/account/tokens
  - [ ] Get Organization ID from dashboard
  - [ ] Get Project ID from project settings

- [ ] **Render Account**
  - [ ] Create account at https://render.com
  - [ ] Connect GitHub repository
  - [ ] Get Deploy Hook URL from service settings

- [ ] **GitHub Account**
  - [ ] Install GitHub CLI: https://cli.github.com
  - [ ] Run: `gh auth login`

- [ ] **Database Ready**
  - [ ] MySQL instance accessible (cloud or local)
  - [ ] Database credentials handy
  - [ ] Test connection works

- [ ] **Google Cloud Credentials**
  - [ ] API keys for Document AI
  - [ ] API keys for Gemini
  - [ ] Credentials JSON file ready

---

## 🎯 Step-by-Step Deployment

### Phase 1: Manual Vercel Setup (5 minutes)

1. **Go to Vercel Dashboard**
   ```
   https://vercel.com/dashboard
   ```

2. **Click "Add New" → "Project"**

3. **Import Repository**
   - Search: `banking_name_change`
   - Click "Import"

4. **Configure**
   - Framework: `Vite`
   - Project Name: `name-change-frontend`
   - Root Directory: `./frontend`
   - **Branch: `feature/deployment-vercel-render`** ⭐

5. **Add Environment Variable**
   - Key: `VITE_API_URL`
   - Value: (leave empty for now, we'll update after Render deploys)

6. **Deploy**
   - Click "Deploy"
   - Wait 1-2 minutes
   - Copy your frontend URL: `https://name-change-frontend.vercel.app`

---

### Phase 2: Manual Render Setup (5 minutes)

1. **Go to Render Dashboard**
   ```
   https://render.com/dashboard
   ```

2. **Click "New +" → "Web Service"**

3. **Connect Repository**
   - Search: `banking_name_change`
   - Select and connect

4. **Configure**
   - Name: `name-change-backend`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm run dev`
   - **Branch: `feature/deployment-vercel-render`** ⭐
   - Root Directory: `./backend`
   - Plan: `Free`

5. **Add Environment Variables**

   Click "Advanced" and add these groups:

   **Database:**
   ```
   DB_HOST=your-host.com
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your-password
   DB_NAME=name_change_db
   ```

   **Google Cloud:**
   ```
   GOOGLE_APPLICATION_CREDENTIALS=./config/google-credentials.json
   GOOGLE_DOCUMENT_AI_PROCESSOR_ID=your-processor-id
   GOOGLE_DOCUMENT_AI_PROJECT_ID=your-project-id
   GOOGLE_DOCUMENT_AI_LOCATION=us
   ```

   **Gemini:**
   ```
   GEMINI_API_KEY=your-api-key
   ```

   **LangSmith:**
   ```
   LANGCHAIN_TRACING_V2=true
   LANGCHAIN_API_KEY=your-key
   LANGCHAIN_PROJECT=name-change-verification
   ```

   **S3:**
   ```
   S3_ENDPOINT=https://s3.amazonaws.com
   S3_ACCESS_KEY=your-access-key
   S3_SECRET_KEY=your-secret-key
   S3_BUCKET=name-change-docs
   ```

   **App:**
   ```
   NODE_ENV=production
   PORT=3001
   ```

6. **Deploy**
   - Click "Create Web Service"
   - Wait 2-3 minutes
   - Copy your backend URL: `https://name-change-backend.onrender.com`

---

### Phase 3: Link Services (2 minutes)

1. **Update Vercel with Backend URL**

   - Go to Vercel Dashboard → `name-change-frontend` → Settings
   - Click "Environment Variables"
   - Update `VITE_API_URL`:
     ```
     https://name-change-backend.onrender.com
     ```
   - Redeploy: Click "Deployments" → Latest → "Redeploy"

2. **Verify Connection**

   - Open frontend in browser
   - Open DevTools (F12) → Network tab
   - Try submitting a request
   - Check API calls go to `name-change-backend.onrender.com`

---

### Phase 4: GitHub Actions Setup (Optional, 5 minutes)

For **automatic** future deployments:

1. **Get Tokens**

   - Vercel Token: https://vercel.com/account/tokens
   - Render Deploy Hook: Service → Settings → Deploy Hook

2. **Add GitHub Secrets**

   ```bash
   # Run in PowerShell
   cd path\to\project
   .\scripts\setup-deployment.ps1
   ```

   OR manually add via GitHub:

   - Go to GitHub Repo → Settings → Secrets and variables → Actions
   - Add these secrets:
     ```
     VERCEL_TOKEN=your-token
     VERCEL_ORG_ID=your-org-id
     VERCEL_PROJECT_ID=your-project-id
     RENDER_SERVICE_ID=srv-xxxxx
     RENDER_DEPLOY_KEY=your-key
     ```

3. **Test Automation**

   ```bash
   git push origin feature/deployment-vercel-render
   ```

   - Check GitHub Actions: Repo → Actions → Deploy workflow
   - Should automatically deploy both services

---

## ✅ Verify Deployment

- [ ] Frontend loads at `https://name-change-frontend.vercel.app`
- [ ] Can navigate through pages without errors
- [ ] Can submit a request form
- [ ] Backend responds with AI findings
- [ ] Dashboard loads without 404 errors
- [ ] Can approve/reject requests
- [ ] Audit logs display correctly

---

## 📊 Monitor Services

### Vercel
- Dashboard: https://vercel.com/dashboard
- View logs: Projects → name-change-frontend → Deployments → Logs
- Check analytics: Projects → name-change-frontend → Analytics

### Render
- Dashboard: https://render.com/dashboard
- View logs: Services → name-change-backend → Logs
- Check metrics: Services → name-change-backend → Metrics

---

## 🐛 Troubleshooting

### "Cannot connect to API"
- [ ] Check Vercel env variable `VITE_API_URL` is set
- [ ] Make sure Render backend is running (green status)
- [ ] Test backend directly: `curl https://name-change-backend.onrender.com/api/requests`
- [ ] Check browser console (F12) for CORS errors

### "502 Bad Gateway"
- [ ] Check Render logs for errors
- [ ] Verify all environment variables are set
- [ ] Check database connection works
- [ ] Try manual redeploy in Render dashboard

### "Database connection failed"
- [ ] Verify `DB_HOST`, `DB_USER`, `DB_PASSWORD` correct
- [ ] Ensure database is accessible from internet
- [ ] Check firewall allows Render's IP
- [ ] Test connection locally first

### "Document upload fails"
- [ ] Check file size < 20MB
- [ ] Verify file format (PDF, JPEG, PNG)
- [ ] Check Google Cloud credentials valid
- [ ] Review Render logs for API errors

---

## 📧 Share with Evaluators

```
Subject: Name Change Verification System - Live Demo

Hi,

Our AI-powered verification system is now live!

🔗 Live Demo: https://name-change-frontend.vercel.app

You can:
✓ View dashboard
✓ Submit requests
✓ See AI analysis
✓ Approve/reject
✓ Check audit logs

Please test and share feedback!

Best regards,
[Your Name]
```

---

## ✨ Success! 🎉

Your application is now deployed and accessible to evaluators. You can:

- ✅ Share live URL
- ✅ Monitor performance
- ✅ View analytics
- ✅ Update code anytime
- ✅ Automatic redeployment on git push

---

**Deployment Time:** 15-30 minutes  
**Cost:** Free tier (sufficient for demo)  
**Support:** See DEPLOYMENT.md for detailed guide
