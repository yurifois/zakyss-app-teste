-- Fix auto-increment for all BIGINT ID tables
-- This allows Supabase to auto-generate IDs when not provided

-- Create sequences based on existing max IDs
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
