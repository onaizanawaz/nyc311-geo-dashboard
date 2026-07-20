# NYC 311 Complaints API

This backend provides a small Express API layer for the NYC 311 complaints dashboard. It sits between the React frontend and the Supabase/PostGIS data source, while leaving GeoServer in place for map tiles.

## Install dependencies

From the backend folder, run:

```bash
npm install
```

## Configure environment

Copy the example environment file and update the values:

```bash
cp .env.example .env
```

Required variables:

- SUPABASE_DB_URL: your Supabase Postgres connection string
- PORT: the port the API should listen on (default: 5000)
- ALLOWED_ORIGIN: comma-separated list of frontend origins allowed by CORS

## Run locally

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## Available endpoints

- GET /api/health
- GET /api/complaints/types
- GET /api/complaints/stats
- GET /api/complaints?type=Noise&limit=50&offset=0
