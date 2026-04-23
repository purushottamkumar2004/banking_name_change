# 🚀 Deployment Guide: Vercel + Render

This guide walks you through deploying the Name Change System to **Vercel (Frontend)** and **Render (Backend)**.

**Total Setup Time:** ~20 minutes  
**Cost:** Free tier

---

## 📋 Prerequisites

- ✅ GitHub account with repo pushed
- ✅ Vercel account (free)
- ✅ Render account (free)
- ✅ Google Cloud credentials (API keys)
- ✅ MySQL database (cloud or local)

---

## Phase 1: Deploy Backend to Render

### Step 1: Create Render Account

1. Go to https://render.com
2. Click **"Sign Up"**
3. Select **"GitHub"**
4. Authorize access to your GitHub account
5. Click through to dashboard

### Step 2: Create Web Service

1. Dashboard → **"New +"** → **"Web Service"**
2. Search for `name-change-system` repository
3. Select your repo
4. Fill in:
   - **Name:** `name-change-backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm run dev`
   - **Plan:** `Free`

### Step 3: Add Environment Variables

Click **"Advanced"** and add these environment variables:

```
DB_HOST=your_mysql_host
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=name_change_db

GOOGLE_APPLICATION_CREDENTIALS=./config/google-credentials.json
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=your_processor_id
GOOGLE_DOCUMENT_AI_PROJECT_ID=your_project_id
GOOGLE_DOCUMENT_AI_LOCATION=us

GEMINI_API_KEY=your_gemini_api_key

LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_PROJECT=name-change-verification

S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=your_s3_key
S3_SECRET_KEY=your_s3_secret
S3_BUCKET=name-change-docs

NODE_ENV=production
PORT=3001
```

### Step 4: Deploy

Click **"Create Web Service"**

⏳ **Wait 2-3 minutes** for deployment to complete

When done, you'll see:
```
✓ Deploy successful
Your service URL: https://name-change-backend.onrender.com
```

**Save this URL!** You'll need it for the frontend.

---

## Phase 2: Deploy Frontend to Vercel

### Step 1: Create Vercel Account

1. Go to https://vercel.com
2. Click **"Sign Up"**
3. Select **"GitHub"**
4. Authorize access
5. Go to dashboard

### Step 2: Import Project

1. Dashboard → **"Add New..."** → **"Project"**
2. Search for `name-change-system`
3. Click **"Import"**
4. Configure:
   - **Framework Preset:** `Vite`
   - **Project Name:** `name-change-frontend`
   - **Root Directory:** `./frontend`

### Step 3: Add Environment Variables

1. Scroll to **"Environment Variables"**
2. Add:
   ```
   VITE_API_URL=https://name-change-backend.onrender.com
   ```
   *(Replace with your actual Render backend URL)*

3. Click **"Deploy"**

⏳ **Wait 1-2 minutes** for deployment

When done:
```
✓ Deployment successful
Your production URL: https://name-change-frontend.vercel.app
```

---

## ✅ Testing the Deployment

1. Open your frontend URL in browser:
   ```
   https://name-change-frontend.vercel.app
   ```

2. Try submitting a request:
   - Fill out the form
   - Upload a test document
   - Click "Submit"

3. Check the response:
   - Should see AI findings
   - Should see confidence scores
   - Should show "PENDING_HUMAN" status

4. Try approval workflow:
   - Click "Approve" or "Reject"
   - Check audit logs

---

## 🔧 Troubleshooting

### Frontend shows "Cannot reach API"

**Solution:**
1. Check `VITE_API_URL` in Vercel environment variables
2. Make sure Render backend is deployed and running
3. Test the Render URL directly:
   ```bash
   curl https://name-change-backend.onrender.com/api/requests
   ```

### Backend returns 404 errors

**Solution:**
1. Check `NODE_ENV=production` in Render
2. Verify all environment variables are set
3. Check Render logs: Dashboard → Service → "Logs"

### Database connection errors

**Solution:**
1. Verify DB credentials are correct
2. Check MySQL is accessible from Render's IP
3. Run migrations: 
   ```bash
   npm run migrate
   ```

### Timeout errors (>60s)

This shouldn't happen with document processing. If it does:
1. Check Render logs
2. Consider upgrading Render plan for longer timeout

---

## 📊 Monitoring Your Deployment

### Vercel Dashboard
- **Deployments:** Check build logs
- **Environment:** Verify variables
- **Analytics:** Monitor traffic

### Render Dashboard
- **Logs:** Real-time server logs
- **Metrics:** CPU, Memory, Requests
- **Settings:** Change configuration

---

## 🔐 Production Checklist

- [ ] All environment variables set securely
- [ ] Database backups enabled
- [ ] HTTPS enabled (automatic on Vercel/Render)
- [ ] Error logging configured
- [ ] Sample data loaded
- [ ] Test workflow end-to-end
- [ ] Share URL with evaluators

---

## 📧 Share with Evaluators

Send evaluators this email:

```
Subject: Name Change Verification System - Demo Ready

Hi,

Please test our AI-powered document verification system:

🔗 Live Demo: https://name-change-frontend.vercel.app

Features:
✓ Submit name change requests
✓ AI-powered document analysis
✓ Fraud detection scoring
✓ Human approval workflow
✓ Audit trail logging

Sample test requests are pre-populated.

Please test:
1. View dashboard
2. Submit a new request
3. Review AI findings
4. Approve/reject request

Any questions, let me know!

Best regards,
[Your Name]
```

---

## 🆘 Support

If you encounter issues:

1. **Check Render Logs:**
   ```
   Render Dashboard → name-change-backend → Logs
   ```

2. **Check Vercel Logs:**
   ```
   Vercel Dashboard → name-change-frontend → Deployments → Logs
   ```

3. **Test API Directly:**
   ```bash
   curl https://name-change-backend.onrender.com/api/requests
   ```

4. **Check Network Tab:**
   - Open DevTools (F12)
   - Check "Network" tab for failed requests
   - Look for CORS errors

---

## 📚 Next Steps

After deployment:
1. **Monitor logs** for errors
2. **Test thoroughly** with sample documents
3. **Gather feedback** from evaluators
4. **Iterate** on improvements

Good luck! 🎉
