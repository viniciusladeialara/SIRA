-- scripts/init-db.sql
-- Inicialização do Banco de Dados PostgreSQL para o Macro-Micro Schedule

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. TABELA DE USUÁRIOS (Autenticação e RBAC)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'PROFESSOR', 'USER', 'COORDENADOR')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE CURSOS
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    modality VARCHAR(100) DEFAULT 'Presencial',
    workload_hours INTEGER DEFAULT 1200,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE PROFESSORES (Docentes)
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    specialty VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    allocated_hours NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABELA DE AMBIENTES / SALAS DE AULA
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    block VARCHAR(50),
    floor VARCHAR(50),
    type VARCHAR(100) DEFAULT 'Sala de Aula', -- Ex: Laboratório, Auditório, Sala de Teoria
    capacity INTEGER DEFAULT 40,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABELA CENTRAL DE TURMAS (BASE DA GERAÇÃO DE AGENDAMENTOS)
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    course_id UUID REFERENCES courses(id) ON DELETE RESTRICT,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    shift VARCHAR(50) NOT NULL CHECK (shift IN ('MATUTINO', 'VESPERTINO', 'NOTURNO', 'INTEGRAL')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    daily_hours NUMERIC(4, 2) DEFAULT 4.0,
    student_count INTEGER DEFAULT 30,
    status VARCHAR(50) DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'PAUSADA', 'CONCLUIDA', 'CANCELADA')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABELA DE AGENDAMENTOS (TURMA + EXCEÇÕES/REUNIÕES)
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE, -- NULL se for evento/reunião isolada
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    schedule_type VARCHAR(50) DEFAULT 'TURMA' CHECK (schedule_type IN ('TURMA', 'EXCECAO', 'REUNIAO', 'MANUTENCAO')),
    title VARCHAR(255),
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'CONFIRMADO' CHECK (status IN ('CONFIRMADO', 'CANCELADO', 'REMANEJADO')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABELA DE LOGS DE AUDITORIA
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_schedules_range ON schedules(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_schedules_class ON schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_schedules_room ON schedules(room_id);
CREATE INDEX IF NOT EXISTS idx_schedules_teacher ON schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_course ON classes(course_id);

-- DADOS INICIAIS DE TESTE (SEED DATA)

-- Senha padrão do admin: 'admin123' (hash bcrypt)
INSERT INTO users (id, email, password_hash, name, role) 
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@admin.com',
    '$2a$10$7R4zI0x./GkK1.n9P03eue4Q53Y2o4L.a.q5w1Y0e2Zg8K4h1s6Yy', 
    'Administrador do Sistema',
    'ADMIN'
) ON CONFLICT (email) DO NOTHING;

-- Inserir Curso Inicial
INSERT INTO courses (id, name, code, modality, workload_hours)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Técnico em Desenvolvimento de Sistemas',
    'TDS-2026',
    'Presencial',
    1200
) ON CONFLICT (code) DO NOTHING;

-- Inserir Professor Inicial
INSERT INTO teachers (id, user_id, name, email, phone, specialty)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000001',
    'Prof. Vinícius Lara',
    'vinicius@senai.br',
    '(31) 99999-8888',
    'Desenvolvimento Web e SQL'
) ON CONFLICT (email) DO NOTHING;

-- Inserir Salas de Aula Iniciais
INSERT INTO rooms (id, name, block, floor, type, capacity)
VALUES 
    ('33333333-3333-3333-3333-333333333331', 'Laboratório de Informática 01', 'Bloco A', '1º Andar', 'Laboratório', 35),
    ('33333333-3333-3333-3333-333333333332', 'Sala de Teoria 102', 'Bloco B', 'Térreo', 'Sala de Aula', 40)
ON CONFLICT DO NOTHING;

-- Inserir Turma Inicial (FOCO PRINCIPAL)
INSERT INTO classes (id, code, name, course_id, teacher_id, room_id, shift, start_date, end_date, daily_hours)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    'TURMA-TDS-01',
    'Turma TDS 2026/1 - Matutino',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333331',
    'MATUTINO',
    '2026-02-01',
    '2026-07-30',
    4.0
) ON CONFLICT (code) DO NOTHING;

-- Inserir Agendamento de Exemplo da Turma
INSERT INTO schedules (id, class_id, room_id, teacher_id, schedule_type, title, start_time, end_time, created_by)
VALUES (
    gen_random_uuid(),
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333331',
    '22222222-2222-2222-2222-222222222222',
    'TURMA',
    'Aula de Banco de Dados SQL',
    '2026-08-10 08:00:00-03',
    '2026-08-10 12:00:00-03',
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- Inserir Agendamento de Exceção/Reunião de Exemplo
INSERT INTO schedules (id, class_id, room_id, teacher_id, schedule_type, title, description, start_time, end_time, created_by)
VALUES (
    gen_random_uuid(),
    NULL,
    '33333333-3333-3333-3333-333333333332',
    '22222222-2222-2222-2222-222222222222',
    'REUNIAO',
    'Reunião de Planejamento Pedagógico',
    'Alinhamento semestral de corpo docente',
    '2026-08-11 14:00:00-03',
    '2026-08-11 16:00:00-03',
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;
