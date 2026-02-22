-- SQL para criar as tabelas no Supabase (Rodar no SQL Editor do Supabase)

-- 1. Usuários
CREATE TABLE users (
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

-- 2. Administradores
CREATE TABLE admins (
    id BIGINT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    "establishmentId" BIGINT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Estabelecimentos
CREATE TABLE establishments (
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

-- 4. Categorias
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT,
    slug TEXT,
    icon TEXT,
    color TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Serviços
CREATE TABLE services (
    id BIGINT PRIMARY KEY,
    name TEXT,
    description TEXT,
    price DOUBLE PRECISION,
    duration INTEGER,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Agendamentos (Appointments)
CREATE TABLE appointments (
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

-- 7. Funcionários (Employees)
CREATE TABLE employees (
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

-- Habilitar acesso público para testes (Desabilitar RLS ou criar políticas)
-- ATENÇÃO: Em produção real, você deve configurar Políticas de RLS.
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE establishments DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
