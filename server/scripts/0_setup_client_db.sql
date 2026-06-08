-- 1. Create tables
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    phone TEXT,
    avatar TEXT,
    favorites JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
    id BIGINT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    "establishmentId" BIGINT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS establishments (
    id BIGINT PRIMARY KEY,
    name TEXT,
    description TEXT,
    cnpj TEXT,
    document TEXT,
    "documentType" TEXT,
    "locationType" TEXT,
    "serviceRadius" DOUBLE PRECISION,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    "zipCode" TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    rating DOUBLE PRECISION,
    "reviewCount" INTEGER,
    image TEXT,
    images JSONB DEFAULT '[]',
    categories JSONB DEFAULT '[]',
    services JSONB DEFAULT '[]',
    "workingHours" JSONB DEFAULT '{}',
    plan TEXT,
    "servicePreferences" JSONB DEFAULT '{}',
    "serviceImages" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT,
    slug TEXT,
    icon TEXT,
    color TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
    id BIGINT PRIMARY KEY,
    name TEXT,
    description TEXT,
    price DOUBLE PRECISION,
    duration INTEGER,
    "categoryId" TEXT,
    "establishmentId" BIGINT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
    id BIGINT PRIMARY KEY,
    "establishmentId" BIGINT,
    "userId" BIGINT,
    "professionalId" BIGINT,
    services JSONB DEFAULT '[]',
    date TEXT,
    time TEXT,
    status TEXT,
    "totalPrice" DOUBLE PRECISION,
    "totalDuration" INTEGER,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    notes TEXT,
    assignments JSONB DEFAULT '[]',
    "notificationsSent" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
    id BIGINT PRIMARY KEY,
    name TEXT,
    "establishmentId" BIGINT,
    role TEXT,
    phone TEXT,
    email TEXT,
    avatar TEXT,
    services JSONB DEFAULT '[]',
    "workingHours" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 3. Fix auto-increment
DO $$
DECLARE
  max_id BIGINT;
BEGIN
  -- Users
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM users;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS users_id_seq START WITH %s', max_id + 1);
  ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq');

  -- Admins
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM admins;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS admins_id_seq START WITH %s', max_id + 1);
  ALTER TABLE admins ALTER COLUMN id SET DEFAULT nextval('admins_id_seq');

  -- Establishments
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM establishments;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS establishments_id_seq START WITH %s', max_id + 1);
  ALTER TABLE establishments ALTER COLUMN id SET DEFAULT nextval('establishments_id_seq');

  -- Services
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM services;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS services_id_seq START WITH %s', max_id + 1);
  ALTER TABLE services ALTER COLUMN id SET DEFAULT nextval('services_id_seq');

  -- Appointments
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM appointments;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS appointments_id_seq START WITH %s', max_id + 1);
  ALTER TABLE appointments ALTER COLUMN id SET DEFAULT nextval('appointments_id_seq');

  -- Employees
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM employees;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS employees_id_seq START WITH %s', max_id + 1);
  ALTER TABLE employees ALTER COLUMN id SET DEFAULT nextval('employees_id_seq');
END $$;
