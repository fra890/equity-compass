# Vercel Deployment Guide for EquityCompass

## Quick Deploy Steps

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect it as a Vite project

### 3. Configure Environment Variables

In Vercel Dashboard > Project Settings > Environment Variables, add:

**Required:**
```
VITE_API_KEY=your_gemini_api_key_here
VITE_FIREBASE_API_KEY=AIzaSyA0gPPt5_am4dIsxaAnvJoNzlV5TaHM0sI
VITE_FIREBASE_AUTH_DOMAIN=equitycompass-6bc83.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=equitycompass-6bc83
VITE_FIREBASE_STORAGE_BUCKET=equitycompass-6bc83.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=28907585032
VITE_FIREBASE_APP_ID=1:28907585032:web:d2810c79341b098f309bbd
```

**Important:** Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 4. Deploy

Click "Deploy" - Vercel will build and deploy automatically.

---

## Local Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your environment variables in `.env.local`

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run dev server:
   ```bash
   npm run dev
   ```

---

## Build Settings (Auto-detected)

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

---

## Troubleshooting

### Build Fails
- Check that all environment variables are set in Vercel
- Ensure VITE_API_KEY is provided
- Check build logs for specific errors

### Firebase Connection Issues
- Verify Firebase credentials are correct
- Check Firebase project is active
- Ensure Firestore is initialized in Firebase Console

### API Key Errors
- Gemini API key must be valid
- Check key has appropriate permissions
- Visit [Google AI Studio](https://aistudio.google.com) to manage keys

---

## Security Note

Never commit `.env.local` or expose API keys in code. All credentials are now properly externalized to environment variables.
