# Asset Inventory & IT Helpdesk Management System (Backend)

Backend REST API for SMIT Asset Inventory & IT Helpdesk Management System built with **Node.js**, **Express**, **TypeScript**, and **MongoDB / Mongoose**.

---

## 📁 Project Structure

```
smit-assets-backend/
├── .env                  # Local environment configuration (ignored by Git)
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore rules
├── package.json          # Node dependencies & npm scripts
├── tsconfig.json         # TypeScript compiler configuration
├── README.md             # Project documentation
└── src/
    ├── app.ts            # Express application factory & middleware setup
    ├── server.ts         # Server entrypoint with DB connection & graceful shutdown
    ├── config/
    │   ├── db.ts         # Mongoose connection & status helper
    │   └── env.ts        # Zod-based environment variable validation
    ├── constants/
    │   ├── enums.ts      # Roles, Asset statuses, conditions & room types
    │   └── permissions.ts# Granular permission definitions & role defaults
    ├── middlewares/
    │   ├── errorHandler.ts# Centralized error handler
    │   └── notFound.ts   # 404 handler
    ├── models/           # Mongoose schemas & TypeScript models
    │   ├── index.ts      # Barrel export
    │   ├── Role.ts       # Roles with permissions matrix
    │   ├── User.ts       # Users with campus scoping & custom permissions
    │   ├── Campus.ts     # Campus entities (root location node)
    │   ├── Building.ts   # Buildings (child of Campus)
    │   ├── Room.ts       # Rooms (child of Building, scoped to Campus)
    │   ├── AssetCategory.ts # Flexible category definitions with custom spec schemas
    │   └── Asset.ts      # Unique Asset IDs, opaque QR tokens, & dynamic specs
    ├── routes/
    │   ├── index.ts      # Main API router (/api)
    │   └── health.routes.ts # Health check & system diagnostics (/api/health)
    ├── scripts/
    │   └── testConnection.ts# Connection & schema compilation verification
    └── utils/
        └── tokenGenerator.ts# Opaque crypto tokens for QR codes & asset tags
```

---

## 🗄️ Database Models Overview

1. **Users & Roles**:
   - `Role`: System roles (`SUPER_ADMIN`, `CAMPUS_ADMIN`, `IT_TECHNICIAN`, etc.) with permission arrays.
   - `User`: Supports **campus scoping** (`campusScope` array of Campus IDs or `isGlobalScope: true`) and granular permission overrides.

2. **Hierarchical Location Tree**:
   - `Campus` ➔ `Building` (unique code per campus) ➔ `Room` (unique room number per building, categorized by `roomType`).

3. **Categories & Assets**:
   - `AssetCategory`: Supports recursive sub-categories, tag prefix (`AST`), and flexible dynamic spec definitions (`ISpecDefinition`).
   - `Asset`:
     - **Unique Asset Tag**: Human-readable identifier (e.g. `AST-2026-X1Y2Z3`).
     - **Opaque QR Token**: Cryptographically secure random URL-safe token preventing ID guessing or enumeration when scanning QR tags.
     - **Flexible Specs**: Mixed schema validated according to category spec definitions.
     - **Location & Assignment Tracking**: References to Campus, Building, Room, and assigned User.
     - **Full-Text Search Index**: Pre-indexed on asset tag, name, brand, model, and serial number.

---

## 🚀 Quick Start Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Ensure `.env` exists (copied from `.env.example`):
```bash
cp .env.example .env
```
Update `MONGODB_URI` if your MongoDB runs on a custom port or MongoDB Atlas connection string.

### 3. Verify Database Connection
Run the connection test script to confirm MongoDB connection and Mongoose model compilation:
```bash
npm run test:db
```

### 4. Start Development Server
```bash
npm run dev
```
The server will start at `http://localhost:5000`.

### 5. Check Health Endpoint
Open in browser or test with curl:
```bash
curl http://localhost:5000/api/health
```

Sample Response:
```json
{
  "success": true,
  "status": "healthy",
  "message": "Asset Management Backend is operational and database connected.",
  "timestamp": "2026-10-21T08:18:00.000Z",
  "uptimeSeconds": 12,
  "environment": "development",
  "database": {
    "state": "connected",
    "statusCode": 1,
    "isConnected": true,
    "host": "127.0.0.1",
    "name": "smit_assets_db"
  },
  "memory": {
    "rssMb": 65.4,
    "heapUsedMb": 28.1,
    "heapTotalMb": 34.2
  }
}
```

---

## 📦 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts server with live auto-reload via `tsx watch` |
| `npm run test:db` | Tests MongoDB connection and model compilation |
| `npm run build` | Compiles TypeScript into `dist/` folder |
| `npm start` | Runs compiled production code from `dist/server.js` |
| `npm run lint` | Type checks codebase (`tsc --noEmit`) |
