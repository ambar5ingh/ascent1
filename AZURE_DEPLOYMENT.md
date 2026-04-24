# ASCENT — Azure + GitHub Deployment Guide

## Overview

This guide walks you through deploying the ASCENT GHG Scenario Planning Tool to **Microsoft Azure App Service** using **GitHub Actions** for CI/CD.

---

## Prerequisites

- Azure account (free at portal.azure.com)
- GitHub account
- Python 3.11+ installed locally (for testing)
- Azure CLI (optional but helpful)

---

## Step 1: Test Locally

```bash
# Clone or navigate to the project folder
cd ascent

# Create virtual environment
python -m venv venv
source venv/bin/activate       # macOS/Linux
# venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Run the app
python app.py
# Open http://localhost:5000
```

---

## Step 2: Push to GitHub

1. Create a **new GitHub repository** (e.g., `ascent-ghg-tool`).

2. Initialize and push:

```bash
cd ascent
git init
git add .
git commit -m "Initial ASCENT commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ascent-ghg-tool.git
git push -u origin main
```

---

## Step 3: Create Azure App Service

### Option A — Azure Portal (GUI)

1. Go to **portal.azure.com** → **Create a resource** → **Web App**
2. Fill in:
   | Setting | Value |
   |---|---|
   | Subscription | Your subscription |
   | Resource Group | Create new: `rg-ascent` |
   | Name | `ascent-ghg-tool` *(must be globally unique)* |
   | Publish | **Code** |
   | Runtime stack | **Python 3.11** |
   | OS | **Linux** |
   | Region | Central India / South India |
   | Plan | B1 (Basic, ~$13/month) or Free F1 for testing |

3. Click **Review + Create** → **Create**
4. Wait ~2 minutes for provisioning.

### Option B — Azure CLI

```bash
# Login
az login

# Create resource group
az group create --name rg-ascent --location centralindia

# Create App Service plan
az appservice plan create \
  --name ascent-plan \
  --resource-group rg-ascent \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --resource-group rg-ascent \
  --plan ascent-plan \
  --name ascent-ghg-tool \
  --runtime "PYTHON:3.11"
```

---

## Step 4: Configure Startup Command

1. In Azure Portal → Your Web App → **Configuration** → **General settings**
2. Set **Startup Command**:
   ```
   gunicorn --bind=0.0.0.0:8000 --workers=4 --timeout=120 app:app
   ```
3. Click **Save**

---

## Step 5: Get Publish Profile

1. In Azure Portal → Your Web App → **Overview**
2. Click **Download publish profile** (top menu bar)
3. Save the `.PublishSettings` file — you'll need its contents in the next step.

---

## Step 6: Add GitHub Secret

1. In your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
4. Value: Paste the **entire contents** of the `.PublishSettings` file downloaded above
5. Click **Add secret**

---

## Step 7: Update GitHub Actions Workflow

Open `.github/workflows/deploy.yml` and update line 9:

```yaml
  AZURE_WEBAPP_NAME: ascent-ghg-tool    # ← Your exact App Service name
```

---

## Step 8: Deploy!

Any push to the `main` branch will automatically trigger deployment:

```bash
git add .
git commit -m "Deploy ASCENT"
git push origin main
```

### Monitor deployment:
- GitHub → **Actions** tab → Watch the workflow run
- Azure Portal → Your Web App → **Deployment Center** for logs

---

## Step 9: Access Your App

Once deployed, your app will be live at:
```
https://ascent-ghg-tool.azurewebsites.net
```

---

## Step 10: Configure Custom Domain (Optional)

1. Azure Portal → Web App → **Custom domains**
2. Click **Add custom domain** → enter your domain
3. Follow DNS verification steps
4. Add TXT/CNAME records at your domain registrar

---

## Environment Variables (Optional)

If you add any secrets or config later:
1. Azure Portal → Web App → **Configuration** → **Application settings**
2. Add key-value pairs (accessed via `os.environ.get('KEY')` in Python)

---

## Cost Estimate

| Tier | vCPU | RAM | Monthly Cost (approx) |
|---|---|---|---|
| F1 Free | Shared | 1 GB | ₹0 (limited hours) |
| B1 Basic | 1 | 1.75 GB | ~₹1,100/month |
| B2 Basic | 2 | 3.5 GB | ~₹2,200/month |

For production with multiple users, **B2** is recommended.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `ModuleNotFoundError` | Check `requirements.txt` has all packages |
| 500 error on startup | Verify startup command in Configuration |
| Build fails in GitHub Actions | Check Python version matches `requirements.txt` |
| App works locally but not on Azure | Check `app.run()` isn't blocking — gunicorn handles this |
| Slow cold starts | Upgrade from F1 to B1; enable "Always On" |

### Enable "Always On" (prevents cold starts):
Azure Portal → Web App → **Configuration** → **General settings** → **Always On: On**
*(Requires B1 or higher)*

---

## Updating the App

Simply push to `main`:

```bash
git add .
git commit -m "Update: your changes"
git push origin main
```

GitHub Actions will automatically build and redeploy. Zero downtime with slot swapping is available on Standard tier and above.

---

## Architecture Summary

```
User Browser
    │
    ▼
GitHub (source code)
    │ push to main
    ▼
GitHub Actions CI/CD
    │ build → test → zip
    ▼
Azure App Service (Linux, Python 3.11)
    │ gunicorn → Flask app
    ▼
ASCENT API (/api/calculate, /api/download/*)
```

---

*ASCENT v2.0 · WRI India · IPCC 2019 / GPC Framework*
