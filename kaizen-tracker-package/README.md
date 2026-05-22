# Kaizen Tracker

Kaizen Tracker is a premium team attendance and training-hours tracking application built with React, Vite, TypeScript, and Supabase.

---

## Getting Started

### 1. Configure Local Environment
1. Copy the example environment file to create your own configuration:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your Supabase project credentials:
   * `VITE_SUPABASE_URL`: The URL of your Supabase project.
   * `VITE_SUPABASE_ANON_KEY`: The anonymous public API key for your Supabase project.

---

### 2. Initialize the Supabase Database
The application requires specific database schemas, Row-Level Security (RLS) rules, path-scoped storage policies, and transactional RPC functions to be active in your Supabase project.

We utilize a clean, sequential migration pipeline. All legacy schema files have been deprecated and deleted in favor of the three canonical migration steps.

👉 **Follow the database setup guide in [migrations/README.md](file:///Users/jfreyman/left-brain-projects/kaizen-tracker/migrations/README.md) to initialize your database correctly.**

---

### 3. Install & Start Application

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```

The app will start running locally at `http://localhost:5173/`. Open it in your browser and log in with your coach account credentials!
