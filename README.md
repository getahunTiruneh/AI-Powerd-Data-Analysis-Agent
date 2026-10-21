# XYZ Bank Data Insight Agent

<div align="center">

![XYZ Bank Data Insight Agent](https://img.shields.io/badge/XYZ%20Bank-Data%20Insight%20Agent-purple?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-Private-red?style=for-the-badge)

**An AI-powered data analytics platform for XYZ Bank.**
Query banking data marts using natural language, generate charts, and manage access — all in one place.

</div>

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [1. Database Setup](#1-database-setup)
   - [2. Backend Setup](#2-backend-setup)
   - [3. AI Service Setup](#3-ai-service-setup)
   - [4. Frontend Setup](#4-frontend-setup)
7. [Environment Variables](#environment-variables)
   - [Backend (.env)](#backend-env)
   - [AI Service (.env)](#ai-service-env)
   - [Frontend (.env)](#frontend-env)
8. [Default Users](#default-users)
9. [API Reference](#api-reference)
   - [Authentication](#authentication-endpoints)
   - [Chat](#chat-endpoints)
   - [Data Marts](#data-mart-endpoints)
   - [Admin](#admin-endpoints)
   - [AI Service](#ai-service-endpoints)
10. [Database Schema](#database-schema)
11. [Role & Permissions](#roles--permissions)
12. [Security](#security)
13. [Troubleshooting](#troubleshooting)
14. [Contributing](#contributing)

---

## Overview

**XYZ Bank Data Insight Agent** is an internal analytics platform built for analysts and business users at XYZ Bank. It connects to banking data marts and exposes them through a natural language chat interface powered by **Llama 3 8B** (via local Ollama for complete on-premise security).

Users can:
- **Ask questions in plain English** — no SQL required
- **Upload CSV/Excel files** for instant analysis
- **Get auto-generated charts** (bar, line, pie) and tables
- **Export results** as CSV
- **Admins** manage users, data mart access, and view audit logs

---

## Features

| Feature | Description |
|---------|-------------|
| 🤖 **Natural Language Querying** | Ask questions in plain English against live data mart tables |
| 📁 **File Upload Analysis** | Upload CSV or Excel files and chat against them directly |
| 📊 **Auto-Generated Visualizations** | AI responds with formatted tables, bar/line/pie charts |
| 🔐 **Role-Based Access Control** | Admin and Business User roles with granular data mart assignments |
| 🗣️ **Voice Input** | Browser-native speech-to-text for hands-free queries |
| 💡 **AI Autocomplete** | Smart query suggestions as you type |
| 📜 **Audit Logging** | Full activity log: logins, queries, admin actions, all with IP tracking |
| 🔔 **Notifications** | In-app notifications for new user registrations and assignments |
| 🌙 **Dark / Light Theme** | Full theme support |
| 🏦 **Multi Data Mart Support** | Connect and import tables from external PostgreSQL databases |
| 💬 **Conversation History** | All chats are saved and can be resumed |
| 📤 **CSV Export** | Export AI-generated tables to CSV with one click |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser Client                                          │
│  React + Vite + Tailwind + shadcn/ui  (Port 5173)       │
└─────────────────────────┬────────────────────────────────┘
                          │ HTTPS / REST
┌─────────────────────────▼────────────────────────────────┐
│  Backend API Server                                      │
│  Node.js + Express 5  (Port 3001)                        │
│  JWT Auth · 10 Route Modules · Audit Logger              │
└───────────┬─────────────────────────┬────────────────────┘
            │                         │
   ┌────────▼────────┐      ┌─────────▼──────────────────┐
   │  PostgreSQL DB  │      │  AI Microservice           │
   │  public schema  │      │  Python FastAPI (Port 3002)│
   │  data_mart      │      │  Ollama API → Llama 3 8B   │
   │  schema         │      └────────────────────────────┘
   └─────────────────┘
```

**Data flow for a chat message:**
1. User types a query → Frontend sends it to Backend `/api/chat`
2. Backend fetches data mart table data from PostgreSQL
3. Backend calls AI Service with messages + data context
4. AI Service calls local Ollama API and streams the response
5. Backend returns the AI response; Frontend renders it as markdown/chart/table

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18+ | UI framework |
| TypeScript | 5+ | Type safety |
| Vite | 5+ | Build tool & dev server |
| Tailwind CSS | 3+ | Styling |
| shadcn/ui | latest | Component library |
| Recharts | 2+ | Data visualization |
| Framer Motion | 11+ | Animations |
| TanStack Query | 5+ | Server state management |
| React Router | 6+ | Client-side routing |
| PapaParse | 5+ | CSV parsing |
| SheetJS (xlsx) | latest | Excel parsing |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | 5+ | HTTP framework |
| PostgreSQL (pg) | 8+ | Database driver |
| jsonwebtoken | 9+ | JWT authentication |
| bcryptjs | 3+ | Password hashing |
| helmet | 8+ | Security headers |
| express-rate-limit | 7+ | Brute force protection |

### AI Service
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.9+ | Runtime |
| FastAPI | 0.109+ | HTTP framework |
| Uvicorn | 0.27+ | ASGI server |
| pandas | 2+ | Data processing |
| requests | 2.31+ | Ollama API client |
| Ollama API | — | Local LLM provider (Llama 3 8B) |

### Database
| Technology | Purpose |
|------------|---------|
| PostgreSQL 14+ | Primary database (`public` schema) |
| `data_mart` schema | Isolated schema for imported banking tables |

---

## Project Structure

```
xyz-bank-data-insight-agent/
│
├── Frontend/                    # React application
│   ├── src/
│   │   ├── components/          # Shared UI components
│   │   │   ├── AppLayout.tsx    # Main layout with sidebar navigation
│   │   │   ├── AppSidebar.tsx   # Navigation sidebar
│   │   │   ├── MarkdownRenderer.tsx  # Renders AI responses (tables, charts)
│   │   │   └── ErrorBoundary.tsx
│   │   ├── pages/               # Route-level page components (21 pages)
│   │   │   ├── ChatPage.tsx         # Main AI chat interface
│   │   │   ├── LandingPage.tsx      # Public landing page
│   │   │   ├── LoginPage.tsx        # Auth page
│   │   │   ├── AdminDashboard.tsx   # Admin overview
│   │   │   ├── DataMartManagement.tsx
│   │   │   ├── UserManagement.tsx
│   │   │   ├── AuditLogPage.tsx
│   │   │   └── ...
│   │   ├── hooks/               # Custom React hooks (API calls, streaming)
│   │   ├── contexts/            # AuthContext (global auth state)
│   │   ├── stores/              # Zustand stores (if any)
│   │   ├── utils/               # Helpers (CSV export, PDF export)
│   │   └── lib/                 # Utility functions
│   ├── public/
│   │   └── xyz-bank-logo.svg    # XYZ Bank logo used in chat UI
│   ├── .env.example             # Environment variable template
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
├── Backend/                     # Node.js API server
│   ├── src/
│   │   ├── routes/              # Express route modules
│   │   │   ├── auth.js          # Register, login, password reset
│   │   │   ├── chat.js          # Chat proxy to AI service + autocomplete
│   │   │   ├── dataMarts.js     # Data mart CRUD + external DB connection
│   │   │   ├── admin.js         # Admin-only operations
│   │   │   ├── profiles.js      # User profile management
│   │   │   ├── assignments.js   # Data mart assignment to users
│   │   │   ├── conversations.js # Chat conversation CRUD
│   │   │   ├── auditLogs.js     # Log retrieval and filtering
│   │   │   ├── notifications.js # In-app notifications
│   │   │   └── messages.js      # Chat message CRUD
│   │   ├── middleware/
│   │   │   └── auth.js          # requireAuth + requireAdmin middleware
│   │   └── services/
│   │       ├── db.js            # PostgreSQL connection pool
│   │       └── logger.js        # Activity logger (writes to `logs` table)
│   ├── scripts/                 # Seed scripts
│   ├── index.js                 # App entry point + route mounting
│   ├── .env.example             # Environment variable template
│   └── package.json
│
├── AI_Service/                  # Python FastAPI microservice
│   ├── app.py                   # FastAPI app: /api/chat + /api/autocomplete
│   ├── requirements.txt
│   └── .env.example             # Environment variable template
│
├── DB/
│   ├── schema.sql               # Full PostgreSQL schema (tables, indexes, RLS)
│   └── seed.sql                 # Sample seed data
│
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** 18 or higher → [nodejs.org](https://nodejs.org)
- **Python** 3.9 or higher → [python.org](https://python.org)
- **PostgreSQL** 14 or higher → [postgresql.org](https://postgresql.org)
- **Ollama** → [ollama.com](https://ollama.com) (for local Llama 8B model)
- **Git**

---

### 1. Database Setup

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create the database
CREATE DATABASE cbe_db;

# Connect to it
\c cbe_db

# Run the full schema (creates all tables, indexes, roles, functions)
\i DB/schema.sql

# (Optional) Run seed data for sample data marts
\i DB/seed.sql
```

The schema creates two schemas:
- **`public`** — application tables (profiles, roles, data_marts, logs, etc.)
- **`data_mart`** — isolated schema for imported banking data tables

---

### 2. Backend Setup

```bash
cd Backend

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your database credentials and JWT secret

# Install dependencies
npm install

# Start development server (with auto-reload)
npm run dev
# ✅ Backend running at http://localhost:3001

# Or start in production mode
npm start
```

---

### 3. AI Service Setup

```bash
cd AI_Service

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your Ollama configuration if needed

# Create a virtual environment (recommended)
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the service
python app.py
# ✅ AI Service running at http://localhost:3002
```

---

### 4. Frontend Setup

```bash
cd Frontend

# Copy and configure environment variables
cp .env.example .env
# Edit .env if your backend is not at http://localhost:3001

# Install dependencies
npm install

# Start development server
npm run dev
# ✅ Frontend running at http://localhost:5173

# Build for production
npm run build
```

> **Quick Start Order:** PostgreSQL → Backend → AI Service → Frontend

---

## Environment Variables

### Backend (`.env`)

```env
# PostgreSQL Connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cbe_db
DB_USER=postgres
DB_PASSWORD=your_db_password_here

# JWT Secret — REQUIRED. Must be strong (32+ chars).
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_strong_jwt_secret_here

# Server Port
PORT=3001

# AI Service URL
AI_SERVICE_URL=http://localhost:3002
```

### AI Service (`.env`)

```env
# Ollama API (Local / On-Prem)
OLLAMA_BASE_URL=http://localhost:11434

# LLM Model (Local)
OLLAMA_MODEL=llama3:8b

# Generation parameters
MAX_TOKENS=4000
TEMPERATURE=0.3

# Server Port
PORT=3002
```

### Frontend (`.env`)

```env
# Backend API base URL
VITE_API_URL=http://localhost:3001
```

---

## Default Users

> ⚠️ **Change all default passwords immediately after first login.**

| Email | Password | Role |
|-------|----------|------|
| `admin@cbe.com.et` | `admin1234` | Admin |
| `abebe@cbe.com.et` | `user1234` | Business User |

To create the admin user manually after schema setup, run in `psql`:

```sql
-- 1. Insert profile (use any UUID)
INSERT INTO public.profiles (id, name, email, dept, status)
VALUES (gen_random_uuid(), 'System Admin', 'admin@cbe.com.et', 'IT', 'active');

-- 2. Set password hash (bcrypt of "admin1234", cost 10)
INSERT INTO public.user_auth (user_id, password_hash)
SELECT id, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
FROM public.profiles WHERE email = 'admin@cbe.com.et';

-- 3. Assign admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM public.profiles WHERE email = 'admin@cbe.com.et';
```

---

## API Reference

All Backend endpoints are prefixed with `http://localhost:3001`.  
Protected routes require `Authorization: Bearer <token>` header.

---

### Authentication Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | ❌ | Register a new `@cbe.com.et` user |
| `POST` | `/api/auth/login` | ❌ | Login, returns JWT token |
| `GET` | `/api/auth/me` | ✅ | Get current user profile |
| `PATCH` | `/api/auth/profile` | ✅ | Update own name/department |
| `PATCH` | `/api/auth/password` | ✅ | Change own password |
| `POST` | `/api/auth/forgot-password` | ❌ | Request a password reset token |
| `POST` | `/api/auth/reset-password` | ❌ | Reset password with token |

**POST `/api/auth/login`** — Request body:
```json
{ "email": "user@cbe.com.et", "password": "yourpassword" }
```
Response:
```json
{
  "token": "eyJ...",
  "user": { "id": "uuid", "name": "Abebe", "email": "...", "role": "business_user", "status": "active", "dept": "Finance" }
}
```

> 🔒 Login is rate-limited to **5 attempts per 15 minutes** per IP address.

---

### Chat Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/chat` | ✅ | Send a chat message, get AI response |
| `POST` | `/api/chat/autocomplete` | ✅ | Get AI query autocomplete suggestion |

**POST `/api/chat`** — Request body:
```json
{
  "messages": [
    { "role": "user", "content": "Show total deposits by branch" }
  ],
  "dataMartId": "retail_banking",
  "fileData": null
}
```
Response:
```json
{
  "content": "## Branch Deposits\n\n| Branch | Total Deposits |\n|...",
  "model": "llama3:8b"
}
```

To chat against an **uploaded file**, set `dataMartId: "file"` and pass `fileData`:
```json
{
  "messages": [{ "role": "user", "content": "Summarize this data" }],
  "dataMartId": "file",
  "fileData": {
    "name": "loans_q1.csv",
    "headers": ["branch", "amount", "status"],
    "data": [{ "branch": "Addis", "amount": 500000, "status": "active" }],
    "totalRows": 1200
  }
}
```

**POST `/api/chat/autocomplete`** — Request body:
```json
{ "currentInput": "Show top bran", "dataMartName": "Retail Banking" }
```
Response:
```json
{ "suggestion": "Show top branches by deposit volume" }
```

---

### Conversation Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/conversations` | ✅ | List all conversations for current user |
| `POST` | `/api/conversations` | ✅ | Create a new conversation |
| `GET` | `/api/conversations/:id` | ✅ | Get single conversation |
| `DELETE` | `/api/conversations/:id` | ✅ | Delete a conversation |
| `PATCH` | `/api/conversations/:id/bookmark` | ✅ | Toggle bookmark |

---

### Data Mart Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/admin/data-marts/assigned` | ✅ User | Get data marts assigned to current user |
| `GET` | `/api/admin/data-marts/local` | ✅ User | List all local data_mart schema tables |
| `GET` | `/api/admin/data-marts/:id/data` | ✅ User | Get paginated rows from a data mart table |
| `GET` | `/api/admin/data-marts/:id/columns` | ✅ User | Get column schema of a data mart table |
| `GET` | `/api/admin/data-marts/connection/status` | ✅ User | Check external DB connection status |
| `GET` | `/api/admin/data-marts/list` | 🔑 Admin | List all data mart definitions |
| `POST` | `/api/admin/data-marts` | 🔑 Admin | Create a new data mart table manually |
| `DELETE` | `/api/admin/data-marts/:table` | 🔑 Admin | Drop a data mart table |
| `POST` | `/api/admin/data-marts/connection` | 🔑 Admin | Connect to external PostgreSQL DB |
| `DELETE` | `/api/admin/data-marts/connection` | 🔑 Admin | Disconnect from external DB |
| `GET` | `/api/admin/data-marts/connection/schemas` | 🔑 Admin | List schemas in connected external DB |
| `POST` | `/api/admin/data-marts/connection/schema` | 🔑 Admin | Select active schema from external DB |
| `POST` | `/api/admin/data-marts/import` | 🔑 Admin | Import all tables from a schema |
| `POST` | `/api/admin/data-marts/import/tables` | 🔑 Admin | Import specific tables from external DB |

---

### Admin Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/admin/profiles` | 🔑 Admin | List all users |
| `GET` | `/api/admin/profiles/:id` | 🔑 Admin | Get single user details |
| `PATCH` | `/api/admin/profiles/:id/status` | 🔑 Admin | Activate / suspend / deactivate user |
| `GET` | `/api/admin/assignments` | 🔑 Admin | List all data mart assignments |
| `POST` | `/api/admin/assignments` | 🔑 Admin | Assign a data mart to a user |
| `DELETE` | `/api/admin/assignments/:id` | 🔑 Admin | Remove a data mart assignment |
| `GET` | `/api/admin/audit-logs` | 🔑 Admin | Get paginated audit log entries |
| `GET` | `/api/notifications` | ✅ User | Get current user's notifications |
| `PATCH` | `/api/notifications/:id/read` | ✅ User | Mark a notification as read |

---

### AI Service Endpoints

Base URL: `http://localhost:3002` (internal — not exposed to the browser directly)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Process chat with context, call Ollama, return AI response |
| `POST` | `/api/autocomplete` | Generate a short query completion |
| `GET` | `/health` | Health check |
| `GET` | `/` | Service info |

---

## Database Schema

### Core Tables (`public` schema)

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts (name, email, dept, status) |
| `user_auth` | Password hashes + reset tokens (separate from profiles for security) |
| `user_roles` | RBAC roles (`admin`, `business_user`) — separate table |
| `data_marts` | Data mart definitions and metadata |
| `user_data_mart_assignments` | Which users have access to which data marts |
| `chat_conversations` | Conversation sessions per user |
| `chat_messages` | Individual messages within conversations |
| `logs` | Audit log entries (level, source, message, details JSONB) |
| `notifications` | In-app notification records |
| `db_connections` | Saved external database connection configs |

### Data Mart Tables (`data_mart` schema)

Tables imported or created by admins live in the `data_mart` schema, isolated from application tables. Example:

```
data_mart.retail_banking
data_mart.digital_transactions
data_mart.branch_performance
```

### Key Indexes

```sql
idx_user_roles_user_id          -- Fast role lookup
idx_assignments_user_id         -- Fast assignment lookup
idx_conversations_user_id       -- Fast conversation list
idx_messages_conversation_id    -- Fast message fetch
idx_logs_created_at             -- Fast log pagination
idx_profiles_email              -- Fast login query
```

---

## Roles & Permissions

| Action | Business User | Admin |
|--------|:---:|:---:|
| Login / Register | ✅ | ✅ |
| Chat with assigned data marts | ✅ | ✅ |
| Chat with all data marts | ❌ | ✅ |
| Upload CSV/Excel for analysis | ✅ | ✅ |
| View conversation history | ✅ (own) | ✅ (all) |
| Manage own profile & password | ✅ | ✅ |
| View notifications | ✅ | ✅ |
| Manage users (activate/suspend) | ❌ | ✅ |
| Assign data marts to users | ❌ | ✅ |
| Create / delete data mart tables | ❌ | ✅ |
| Connect to external databases | ❌ | ✅ |
| Import tables from external DB | ❌ | ✅ |
| View audit logs | ❌ | ✅ |
| View log monitoring | ❌ | ✅ |

### Account Status Flow

```
Registration → pending → (admin approves) → active
                                          ↘ suspended
                                          ↘ deactivated
```

Users with `pending` or `suspended` status see a dedicated screen and cannot access the app.

---

## Security

### Implemented Protections

| Protection | Implementation |
|------------|---------------|
| **Password Hashing** | bcrypt with cost factor 10–12 |
| **JWT Authentication** | RS256 tokens, 24h expiry, verified on every request |
| **Email Restriction** | Only `@cbe.com.et` addresses can register |
| **Rate Limiting** | 5 login attempts per IP per 15 minutes (`express-rate-limit`) |
| **Security Headers** | `helmet` middleware (CSP, HSTS, X-Frame-Options, etc.) |
| **SQL Injection Prevention** | Parameterized queries throughout; dynamic table names validated against whitelist |
| **User Enumeration Prevention** | Forgot-password always returns 200 regardless of email existence |
| **Reset Token Safety** | Tokens stored server-side only; never returned in HTTP response |
| **RBAC** | `requireAuth` and `requireAdmin` middleware on all protected routes |
| **Audit Logging** | All critical events logged with user, IP, and timestamp |

### Security Checklist for Production

- [ ] Set `JWT_SECRET` to a cryptographically random 64+ char string
- [ ] Enable SSL on PostgreSQL connections
- [ ] Place backend and AI service behind a reverse proxy (nginx)
- [ ] Restrict AI service CORS to backend origin only (not `"*"`)
- [ ] Enable HTTPS on all services
- [ ] Remove debug endpoints (`/api/debug/connection`) before production
- [ ] Configure a proper email service for password reset tokens
- [ ] Set up database backups
- [ ] Review and tighten PostgreSQL RLS policies for your environment

---

## Troubleshooting

### Backend won't start
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
→ PostgreSQL is not running. Start it: `net start postgresql` (Windows) or `sudo systemctl start postgresql` (Linux).

---

### Login returns 500
```
Error: JWT_SECRET environment variable...
```
→ Check your `Backend/.env` file has `JWT_SECRET` set.

---

### Chat returns "No database connected"
→ An admin needs to connect to an external database from the **Data Marts** admin page, or tables need to be created manually in the `data_mart` schema.

---

### AI responses are empty or garbled
→ Check the AI Service logs. Common causes:
- Ollama is not running (start the Ollama app or run `ollama serve`)
- Model is not downloaded (run `ollama run llama3:8b`)
- Context too large — try a smaller data set

---

### File upload analysis gives poor results
→ The AI receives up to 50 rows of your file for context. For best results:
- Ensure your CSV/Excel has clear column headers
- Remove empty rows before uploading
- Try asking more specific questions referencing column names

---

### Voice input doesn't work
→ Browser requirements:
- Must use Chrome or Edge (Firefox does not support Web Speech API)
- Site must be served over `https://` or `localhost`
- Microphone permission must be granted

---

## Contributing

This is an internal XYZ Bank project. Contributions are managed internally.

### Development Guidelines

1. **Branch Naming**: `feature/short-description`, `fix/bug-name`, `chore/task`
2. **Commit Style**: Use [Conventional Commits](https://www.conventionalcommits.org/)  
   Example: `feat(chat): add PDF export button` | `fix(auth): prevent user enumeration`
3. **Code Style**:
   - Backend: ESM modules, async/await, always use parameterized queries
   - Frontend: TypeScript strict mode, avoid `any` types, extract reusable components
   - Python: PEP 8, type hints on all function signatures
4. **Security**: Never commit `.env` files. Use `.env.example` for templates.
5. **Testing**: Test all auth and admin flows manually before pushing.

### Running a Health Check

```bash
# Backend
curl http://localhost:3001/api/test
# → { "message": "Backend is running 🚀" }

# AI Service
curl http://localhost:3002/health
# → { "status": "ok", "service": "Python AI Service", "model": "llama3:8b" }
```

---

## Roadmap

- [ ] Email delivery for password reset tokens (currently dev-only)
- [ ] JWT refresh token mechanism (currently hard 24h expiry)
- [ ] Mobile-responsive sidebar for data source selection in chat
- [ ] PDF export button wired to existing `exportAsPDF` utility
- [ ] Async HTTP client (`httpx`) in AI Service for better performance
- [ ] Conversation title editing by user
- [ ] Multi-language support (Amharic)
- [ ] Oracle / MySQL data mart support

---

## License

**Private — XYZ Bank**
This software is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

---

<div align="center">

Built with ❤️ for **XYZ Bank**
© 2026 XYZ Bank — All Rights Reserved · Internal Use Only

</div>