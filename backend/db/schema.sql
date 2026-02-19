-- Schema for SGIAC-ISC Database
-- Tables for inventory management system

-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('administrador', 'docente', 'alumno');

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role user_role DEFAULT 'alumno',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories for assets and consumables
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'consumable'))
);

-- Assets table
CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    serial_number VARCHAR(100) UNIQUE,
    location VARCHAR(100),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'borrowed', 'maintenance')),
    quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consumables table
CREATE TABLE consumables (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
    min_quantity INTEGER DEFAULT 0 CHECK (min_quantity >= 0),
    unit VARCHAR(20) DEFAULT 'units',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Requests table (for loan requests)
CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    asset_id INTEGER REFERENCES assets(id),
    consumable_id INTEGER REFERENCES consumables(id),
    quantity_requested INTEGER DEFAULT 1 CHECK (quantity_requested > 0),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'returned')),
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approval_date TIMESTAMP,
    return_date TIMESTAMP,
    notes TEXT,
    CHECK (
        (asset_id IS NOT NULL AND consumable_id IS NULL) OR
        (asset_id IS NULL AND consumable_id IS NOT NULL)
    )
);

-- Reservations table (for lab reservations)
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lab_name VARCHAR(100) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    purpose TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time)
);

-- Logs table for audit
CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INTEGER,
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_assets_category ON assets(category_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_consumables_category ON consumables(category_id);
CREATE INDEX idx_requests_user ON requests(user_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_logs_user ON logs(user_id);
CREATE INDEX idx_logs_timestamp ON logs(timestamp);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data, admins can see all
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid()::text = id::text OR auth.jwt() ->> 'role' = 'administrador');

CREATE POLICY "Admins can manage all users" ON users
    FOR ALL USING (auth.jwt() ->> 'role' = 'administrador');

-- Assets: All can view, but modifications restricted
CREATE POLICY "All can view assets" ON assets FOR SELECT USING (true);
CREATE POLICY "Only admins can modify assets" ON assets
    FOR ALL USING (auth.jwt() ->> 'role' = 'administrador');

-- Consumables: Similar to assets
CREATE POLICY "All can view consumables" ON consumables FOR SELECT USING (true);
CREATE POLICY "Only admins can modify consumables" ON consumables
    FOR ALL USING (auth.jwt() ->> 'role' = 'administrador');

-- Requests: Users can create/view their own, admins can manage all
CREATE POLICY "Users can view own requests" ON requests
    FOR SELECT USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'administrador');
CREATE POLICY "Users can create requests" ON requests FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Admins can manage all requests" ON requests
    FOR ALL USING (auth.jwt() ->> 'role' = 'administrador');

-- Reservations: Similar to requests
CREATE POLICY "Users can view own reservations" ON reservations
    FOR SELECT USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'administrador');
CREATE POLICY "Users can create reservations" ON reservations FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Admins can manage all reservations" ON reservations
    FOR ALL USING (auth.jwt() ->> 'role' = 'administrador');

-- Logs: Only admins can view
CREATE POLICY "Only admins can view logs" ON logs FOR SELECT USING (auth.jwt() ->> 'role' = 'administrador');
CREATE POLICY "System can insert logs" ON logs FOR INSERT WITH CHECK (true);