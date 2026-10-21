-- ============================================================
-- XYZ Bank Data Insight Agent - Complete PostgreSQL Schema
-- Generated from Lovable Cloud (Supabase) configuration
-- Compatible with standalone PostgreSQL 14+
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'business_user');

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Profiles table (stores user metadata)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,               -- References auth system user ID
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    dept TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',      -- pending | active | suspended | deactivated
    created_at TIMESTAMPTZ DEFAULT now(),
    last_active TIMESTAMPTZ DEFAULT now()
);

-- User roles table (RBAC - separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Data marts table
CREATE TABLE public.data_marts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '📊',
    db_type TEXT DEFAULT 'PostgreSQL',   -- PostgreSQL, Oracle, MySQL, etc.
    status TEXT DEFAULT 'connected',     -- connected | disconnected | syncing
    tables_metadata JSONB DEFAULT '[]'::jsonb,
    connection_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_sync TIMESTAMPTZ DEFAULT now()
);

-- User-to-DataMart assignments (controls access)
CREATE TABLE public.user_data_mart_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    data_mart_id UUID NOT NULL REFERENCES public.data_marts(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, data_mart_id)
);

-- Chat conversations
CREATE TABLE public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    data_mart_id UUID REFERENCES public.data_marts(id) ON DELETE SET NULL,
    title TEXT DEFAULT 'New Conversation',
    bookmarked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,                  -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_assignments_user_id ON public.user_data_mart_assignments(user_id);
CREATE INDEX idx_assignments_data_mart_id ON public.user_data_mart_assignments(data_mart_id);
CREATE INDEX idx_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX idx_conversations_data_mart_id ON public.chat_conversations(data_mart_id);
CREATE INDEX idx_conversations_updated_at ON public.chat_conversations(updated_at DESC);
CREATE INDEX idx_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_messages_content ON public.chat_messages(content);

-- ============================================================
-- 4. FUNCTIONS
-- ============================================================

-- Check if a user has a specific role (used in RLS policies)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Promote a user to admin (security definer - bypasses RLS)
CREATE OR REPLACE FUNCTION public.promote_to_admin(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Allow if caller is admin OR if no admins exist yet (first setup)
    IF NOT public.has_role(current_setting('app.current_user_id')::UUID, 'admin')
       AND EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
        RAISE EXCEPTION 'Only admins can promote users';
    END IF;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin')
    ON CONFLICT DO NOTHING;
END;
$$;

-- Auto-update updated_at timestamp on conversations
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.chat_conversations
    SET updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

-- ============================================================
-- 5. TRIGGERS
-- ============================================================

-- Update conversation timestamp when a new message is inserted
CREATE TRIGGER trg_update_conversation_timestamp
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_conversation_timestamp();

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
-- NOTE: These are Supabase-specific RLS policies.
-- For standalone PostgreSQL, you'll implement access control
-- in your Express.js backend middleware instead.
-- These are included here for reference/documentation.

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_marts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_data_mart_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (id = current_setting('app.current_user_id')::UUID
        OR has_role(current_setting('app.current_user_id')::UUID, 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (id = current_setting('app.current_user_id')::UUID);

CREATE POLICY "Admins can update any profile" ON public.profiles
    FOR UPDATE USING (has_role(current_setting('app.current_user_id')::UUID, 'admin'));

CREATE POLICY "Admins can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (has_role(current_setting('app.current_user_id')::UUID, 'admin'));

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (user_id = current_setting('app.current_user_id')::UUID
        OR has_role(current_setting('app.current_user_id')::UUID, 'admin'));

CREATE POLICY "Admins can insert roles" ON public.user_roles
    FOR INSERT WITH CHECK (has_role(current_setting('app.current_user_id')::UUID, 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
    FOR DELETE USING (has_role(current_setting('app.current_user_id')::UUID, 'admin'));

-- Data marts policies
CREATE POLICY "Admins can do all on data marts" ON public.data_marts
    FOR ALL USING (has_role(current_setting('app.current_user_id')::UUID, 'admin'));

CREATE POLICY "Users can view assigned data marts" ON public.data_marts
    FOR SELECT USING (id IN (
        SELECT data_mart_id FROM public.user_data_mart_assignments
        WHERE user_id = current_setting('app.current_user_id')::UUID
    ));

-- Assignments policies
CREATE POLICY "Admins can manage assignments" ON public.user_data_mart_assignments
    FOR ALL USING (has_role(current_setting('app.current_user_id')::UUID, 'admin'));

CREATE POLICY "Users can view own assignments" ON public.user_data_mart_assignments
    FOR SELECT USING (user_id = current_setting('app.current_user_id')::UUID);

-- Conversations policies
CREATE POLICY "Users manage own conversations" ON public.chat_conversations
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY "Admins can view all conversations" ON public.chat_conversations
    FOR SELECT USING (has_role(current_setting('app.current_user_id')::UUID, 'admin'));

-- Messages policies
CREATE POLICY "Users manage own messages" ON public.chat_messages
    FOR ALL USING (conversation_id IN (
        SELECT id FROM public.chat_conversations
        WHERE user_id = current_setting('app.current_user_id')::UUID
    ));

CREATE POLICY "Admins can view all messages" ON public.chat_messages
    FOR SELECT USING (has_role(current_setting('app.current_user_id')::UUID, 'admin'));

-- ============================================================
-- 7. SAMPLE SEED DATA (Optional)
-- ============================================================

-- Insert a sample data mart for testing
INSERT INTO public.data_marts (name, description, icon, db_type, tables_metadata) VALUES
('Retail Banking', 'Core retail banking data including deposits, loans, and customer accounts', '🏦', 'Oracle', '[
    {"name": "customers", "description": "Customer master data", "rowCount": 5200000, "columns": [
        {"name": "customer_id", "type": "VARCHAR(20)", "isPrimaryKey": true, "isForeignKey": false, "description": "Unique customer identifier"},
        {"name": "full_name", "type": "VARCHAR(200)", "isPrimaryKey": false, "isForeignKey": false, "description": "Customer full name"},
        {"name": "account_type", "type": "VARCHAR(50)", "isPrimaryKey": false, "isForeignKey": false, "description": "Type of account (savings, checking, etc.)"},
        {"name": "branch_id", "type": "VARCHAR(10)", "isPrimaryKey": false, "isForeignKey": true, "description": "Branch identifier"},
        {"name": "total_deposits", "type": "DECIMAL(15,2)", "isPrimaryKey": false, "isForeignKey": false, "description": "Total deposit balance in ETB"},
        {"name": "created_date", "type": "DATE", "isPrimaryKey": false, "isForeignKey": false, "description": "Account creation date"}
    ]},
    {"name": "transactions", "description": "Daily transaction records", "rowCount": 150000000, "columns": [
        {"name": "txn_id", "type": "VARCHAR(30)", "isPrimaryKey": true, "isForeignKey": false, "description": "Transaction identifier"},
        {"name": "customer_id", "type": "VARCHAR(20)", "isPrimaryKey": false, "isForeignKey": true, "description": "Customer reference"},
        {"name": "txn_type", "type": "VARCHAR(20)", "isPrimaryKey": false, "isForeignKey": false, "description": "Transaction type (deposit, withdrawal, transfer)"},
        {"name": "amount", "type": "DECIMAL(15,2)", "isPrimaryKey": false, "isForeignKey": false, "description": "Transaction amount in ETB"},
        {"name": "txn_date", "type": "TIMESTAMP", "isPrimaryKey": false, "isForeignKey": false, "description": "Transaction timestamp"},
        {"name": "channel", "type": "VARCHAR(20)", "isPrimaryKey": false, "isForeignKey": false, "description": "Channel used (branch, ATM, mobile, internet)"}
    ]},
    {"name": "branches", "description": "Branch information", "rowCount": 2100, "columns": [
        {"name": "branch_id", "type": "VARCHAR(10)", "isPrimaryKey": true, "isForeignKey": false, "description": "Branch identifier"},
        {"name": "branch_name", "type": "VARCHAR(100)", "isPrimaryKey": false, "isForeignKey": false, "description": "Branch name"},
        {"name": "region", "type": "VARCHAR(50)", "isPrimaryKey": false, "isForeignKey": false, "description": "Geographic region"},
        {"name": "district", "type": "VARCHAR(50)", "isPrimaryKey": false, "isForeignKey": false, "description": "District name"},
        {"name": "total_deposits", "type": "DECIMAL(18,2)", "isPrimaryKey": false, "isForeignKey": false, "description": "Total branch deposits in ETB"},
        {"name": "total_loans", "type": "DECIMAL(18,2)", "isPrimaryKey": false, "isForeignKey": false, "description": "Total branch outstanding loans in ETB"}
    ]}
]'::jsonb),
('Digital Banking', 'Mobile and internet banking analytics', '📱', 'PostgreSQL', '[
    {"name": "mobile_users", "description": "Mobile banking user data", "rowCount": 8500000, "columns": [
        {"name": "user_id", "type": "VARCHAR(20)", "isPrimaryKey": true, "isForeignKey": false, "description": "Mobile user identifier"},
        {"name": "customer_id", "type": "VARCHAR(20)", "isPrimaryKey": false, "isForeignKey": true, "description": "Linked customer ID"},
        {"name": "device_type", "type": "VARCHAR(20)", "isPrimaryKey": false, "isForeignKey": false, "description": "Device type (Android, iOS)"},
        {"name": "registration_date", "type": "DATE", "isPrimaryKey": false, "isForeignKey": false, "description": "Registration date"},
        {"name": "last_login", "type": "TIMESTAMP", "isPrimaryKey": false, "isForeignKey": false, "description": "Last login timestamp"},
        {"name": "status", "type": "VARCHAR(20)", "isPrimaryKey": false, "isForeignKey": false, "description": "Account status (active, inactive, blocked)"}
    ]},
    {"name": "digital_transactions", "description": "Digital channel transactions", "rowCount": 45000000, "columns": [
        {"name": "txn_id", "type": "VARCHAR(30)", "isPrimaryKey": true, "isForeignKey": false, "description": "Transaction identifier"},
        {"name": "user_id", "type": "VARCHAR(20)", "isPrimaryKey": false, "isForeignKey": true, "description": "Mobile user reference"},
        {"name": "service_type", "type": "VARCHAR(50)", "isPrimaryKey": false, "isForeignKey": false, "description": "Service (transfer, bill_pay, airtime, QR)"},
        {"name": "amount", "type": "DECIMAL(15,2)", "isPrimaryKey": false, "isForeignKey": false, "description": "Transaction amount in ETB"},
        {"name": "channel", "type": "VARCHAR(20)", "isPrimaryKey": false, "isForeignKey": false, "description": "Channel (mobile_app, USSD, internet_banking)"},
        {"name": "txn_date", "type": "TIMESTAMP", "isPrimaryKey": false, "isForeignKey": false, "description": "Transaction timestamp"}
    ]}
]'::jsonb);

-- User authentication table (separate from profiles for security)
CREATE TABLE public.user_auth (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    reset_token TEXT,
    reset_token_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_user_auth_reset_token ON public.user_auth(reset_token);

-- ============================================================
-- 8. ADDITIONAL TABLES (referenced by backend)
-- ============================================================

-- Database connections for external data marts
CREATE TABLE public.db_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'default',
    host TEXT NOT NULL,
    port INTEGER DEFAULT 5432,
    database TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    ssl BOOLEAN DEFAULT true,
    schema_name TEXT DEFAULT 'public',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activity logs table
CREATE TABLE public.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL DEFAULT 'info',
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_logs_composite ON public.logs(created_at DESC, level, source);
CREATE INDEX idx_logs_details ON public.logs USING gin(details);

-- Notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);

-- Create initial admin user (password: admin123)
-- NOTE: Run this manually after schema is created
-- INSERT INTO public.profiles (id, name, email, dept, status)
-- VALUES (gen_random_uuid(), 'Admin', 'admin@cbe.com', 'IT', 'active');
-- INSERT INTO public.user_auth (user_id, password_hash)
-- VALUES ((SELECT id FROM public.profiles WHERE email = 'admin@cbe.com'), '$2a$12$...');