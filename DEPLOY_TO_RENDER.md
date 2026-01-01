# Deploy to Render - Simple Step-by-Step Guide

Your app is now configured to **automatically create database tables** when it starts. No manual SQL required!

---

## Step 1: Push Code to GitHub

First, push your code to GitHub:

```bash
cd islamic-school-management
git init
git add .
git commit -m "Ready for Render deployment"
git remote add origin https://github.com/YOUR_USERNAME/islamic-school.git
git push -u origin main
```
postgresql://school_management_7mok_user:vxotLcKN8dbFw7NSbOwIzKqrcgbfQ7Mf@dpg-d5b2kije5dus73fdc140-a/school_management_7mok
---

## Step 2: Create a Render Account

1. Go to https://render.com
2. Click **Get Started for Free**
3. Sign up with your GitHub account (easiest)

---

## Step 3: Create PostgreSQL Database

1. In Render Dashboard, click **New +** → **PostgreSQL**
2. Fill in:
   - **Name:** `islamic-school-db`
   - **Region:** Singapore (or closest to you)
   - **PostgreSQL Version:** 15
   - **Instance Type:** Free
3. Click **Create Database**
4. Wait for it to be ready (1-2 minutes)
5. **IMPORTANT:** Copy the **Internal Database URL** (looks like `postgres://...`)

---

## Step 4: Create Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub account if not already connected
3. Select your repository (islamic-school)
4. Configure:
   - **Name:** `islamic-school-management`
   - **Region:** Same as your database
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Click **Create Web Service** (don't deploy yet!)

---

## Step 5: Add Environment Variables

In your Web Service, go to **Environment** tab and add these:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Paste the Internal Database URL from Step 3 |
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | Click "Generate" for a random secret |
| `EMAIL_USER` | Your Gmail address (for sending emails) |
| `EMAIL_PASS` | Your Gmail App Password (not regular password) |
| `APP_URL` | `https://islamic-school-management.onrender.com` |

### How to get Gmail App Password:
1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification**
3. Go to https://myaccount.google.com/apppasswords
4. Generate a new App Password
5. Use that 16-character password as `EMAIL_PASS`

---

## Step 6: Deploy!

1. Click **Manual Deploy** → **Deploy latest commit**
2. Wait for deployment (5-10 minutes for first deploy)
3. Watch the logs - you should see:
   ```
   ✅ PostgreSQL Connected
   🔧 Initializing database...
   ✅ Database tables initialized successfully!
   🚀 Server running on http://localhost:10000
   ```

---

## Step 7: Test Your App

1. Click the URL at the top of your Render service (e.g., `https://islamic-school-management.onrender.com`)
2. Try logging in as admin:
   - **Email:** admin@school.com
   - **Password:** admin123

---

## That's It! 🎉

Your database tables are created automatically when the app starts. No need to run any SQL manually!

---

## Troubleshooting

### "Database connection failed"
- Make sure DATABASE_URL is the **Internal** URL (starts with `postgres://`)
- Check that your database is running (not suspended)

### "Tables not created"
- Check the Render logs for errors
- The app auto-creates tables on every startup

### Free Tier Notes
- Free web services sleep after 15 min of inactivity
- First request after sleep takes ~30 seconds
- Free databases may suspend after 90 days of inactivity

---

## Default Admin Login

After deployment, use these credentials:
- **Email:** admin@school.com
- **Password:** admin123

**Change this password immediately after logging in!**
