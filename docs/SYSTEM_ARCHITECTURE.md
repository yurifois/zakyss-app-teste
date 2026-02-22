# System Architecture Documentation

## Overview
The "Agendamento" (BeautyBook) project is a full-stack web application designed for scheduling beauty and wellness services. It utilizes a decoupled architecture with a React frontend and a Node.js/Express backend.

## Technology Stack

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Routing:** React Router DOM
- **Styling:** CSS Modules / Vanilla CSS with Variables
- **HTTP Client:** Native `fetch` API

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Cross-Origin:** CORS enabled for frontend communication
- **Environment config:** `dotenv`

## Directory Structure

```text
/
├── public/              # Static assets
├── server/              # Backend Application
│   ├── data/            # JSON Persistence Layer (Database)
│   ├── middleware/      # Express Middleware (Error handling, etc.)
│   ├── routes/          # API Route Definitions
│   └── index.js         # Entry point
├── src/                 # Frontend Application
│   ├── components/      # Reusable UI Components
│   ├── contexts/        # React Contexts (State Management)
│   ├── layouts/         # Page Layout Wrappers
│   ├── pages/           # Application Views
│   ├── services/        # API Integration Logic
│   └── main.jsx         # Frontend Entry point
└── docs/                # Project Documentation
```

## Data Persistence Strategy
The application uses a **JSON-based file system storage** as a lightweight database, located in `server/data/`. This avoids the need for external database dependencies during development/prototyping.

### Data Models
- **users.json:** Stores user accounts (Clients).
- **admins.json:** Stores administrative accounts.
- **establishments.json:** Stores partner businesses (Salons, Spas).
- **services.json:** Stores services offered by establishments.
- **categories.json:** Stores service categories (Hair, Nails, etc.).
- **appointments.json:** Stores booking records linking users, establishments, and services.

## API Architecture
The backend exposes a RESTful API with the base URL `/api`.

### Core Endpoints

#### Authentication (`/api/auth`)
- `POST /login`: Authenticate users (Client/Admin).
- `POST /register`: Register a new client.

#### Establishments (`/api/establishments`)
- `GET /`: List all establishments (supports search/filtering).
- `GET /:id`: Get details for a specific establishment.
- `GET /:id/services`: Get services for a specific establishment.

#### Services (`/api/services`)
- `GET /`: List all available services.

#### Categories (`/api/categories`)
- `GET /`: List all service categories.

#### Appointments (`/api/appointments`)
- `POST /`: Create a new appointment.
- `GET /user/:userId`: Get appointments for a specific user.

## Frontend Architecture

### Routing Strategy
- **Public Routes:** Home, Search, Establishment Details.
- **Auth Routes:** Login, Register.
- **Private/Protected Routes:**
    - **User Profile:** View history and settings.
    - **Partner/Admin Dashboard:** Manage business data (guarded by role).

### State Management
- **Context API:** Used for global state like Authentication (`AuthContext`).
- **Local State:** Component-level state for forms and UI controls.
