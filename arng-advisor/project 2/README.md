# ARNG Eligibility Advisor
### by Andres Quintero

An AI-powered eligibility advisor for Army National Guard enlistment. Ask questions about eligibility requirements, waiver processes, ASVAB scores, prior service rules, suitability screening, and more — all grounded in official ARNG regulations.

## Knowledge Base

This app references 20 regulatory documents including:
- **AR 601-210** – Active and Reserve Components Enlistment Program
- **PPOM 25-042** – FY26 ARNG Accession Options Criteria (AOC)
- **WASP FY26** – Waiver Authority and Standards of Processing
- **SMOM 25-028** – Suitability Screening and Compliance Requirements
- **SMOM 26-003** – Processing 09M and CAT-IV Applicants FY26
- **SMOM 25-022** – Prior Service BCT Update
- **CASP** – Civilian Acquired Skills Program
- And more SMOMs covering ECLT, Live Scan, REAL ID, medical waivers, etc.

## Setup & Deployment

### Prerequisites
- A [Netlify](https://netlify.com) account
- An [Anthropic API key](https://console.anthropic.com/)

### Deploy to Netlify

1. **Push this folder to a Git repo** (GitHub, GitLab, or Bitbucket)

2. **Connect to Netlify:**
   - Go to [app.netlify.com](https://app.netlify.com) → "Add new site" → "Import an existing project"
   - Select your repo
   - Build settings should auto-detect from `netlify.toml`:
     - Build command: `npm run build`
     - Publish directory: `dist`

3. **Set your environment variable:**
   - In Netlify: Site settings → Environment variables
   - Add: `ANTHROPIC_API_KEY` = your Anthropic API key

4. **Deploy!** Netlify will build and deploy automatically.

### Local Development

```bash
npm install
npx netlify dev
```

Make sure you have a `.env` file with:
```
ANTHROPIC_API_KEY=sk-ant-...
```

## Architecture

- **Frontend:** React + Vite (static site)
- **Backend:** Netlify serverless function (`/api/chat`)
- **AI:** Claude Sonnet via Anthropic API
- **Two-step process:**
  1. Claude selects the most relevant document chunks for the question
  2. Claude reads those regulations and generates a cited answer

## Disclaimer

This tool is for reference only. Always verify information with your chain of command and current regulations.
