# University Management System (UMS)

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8+ (create database `university_db`)

### Backend Setup

1. `cd backend`
2. Copy `.env.example` to `.env` and configure MySQL credentials:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=yourpassword
   DB_NAME=university_db
   JWT_SECRET=your-super-secret-jwt-key
   ```
3. `npm install`
4. `npm run dev` → http://localhost:5000/api/health

### Frontend Setup

1. `cd frontend`
2. `npm install`
3. `npm run dev` → http://localhost:3000

### One-Click Start

Double-click `start-all.bat` (Windows)

## API Proxy Fixed

- Frontend `/api/*` → Backend `/api/*` (port 5000)
- Auto-fallbacks: 127.0.0.1:5000, localhost:5000
- Error 503 only if backend down

## Troubleshooting

**\"API proxy failed\"?** → Start backend: `start-backend.bat`
**DB connection failed?** → Check MySQL + backend/.env
**Port conflicts?** → Backend 5000, Frontend auto 3000+

Enjoy! 🚀
