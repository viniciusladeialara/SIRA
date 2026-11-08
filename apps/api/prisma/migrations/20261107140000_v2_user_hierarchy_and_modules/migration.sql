-- ==============================================================================
-- SIRA - Sistema Integrado de Recursos Acadêmicos
-- Migration: 20261107140000_v2_user_hierarchy_and_modules
-- Descrição: Tabelas core.usuario_unidades e core.usuario_modulos,
--            Perfil super_admin, reset de usuários e seed do SUPER_ADMIN único.
-- ==============================================================================

-- 1. Criação da Tabela core.usuario_unidades (Multi-Unidade Granular)
CREATE TABLE IF NOT EXISTS core.usuario_unidades (
    usuario_id UUID NOT NULL REFERENCES core.usuarios(id) ON DELETE CASCADE,
    unidade_id UUID NOT NULL REFERENCES core.unidades(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT pk_usuario_unidades PRIMARY KEY (usuario_id, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_unidades_unidade ON core.usuario_unidades(unidade_id);

-- 2. Criação da Tabela core.usuario_modulos (Liberação de Módulos por Usuário)
CREATE TABLE IF NOT EXISTS core.usuario_modulos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES core.usuarios(id) ON DELETE CASCADE,
    modulo_slug VARCHAR(100) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_usuario_modulos_slug UNIQUE (usuario_id, modulo_slug)
);

CREATE INDEX IF NOT EXISTS idx_usuario_modulos_usuario ON core.usuario_modulos(usuario_id);

-- 3. Perfil Oficial SUPER_ADMIN
INSERT INTO core.perfis (id, slug, nome, descricao, ativo) VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b00', 'super_admin', 'Super Administrador', 'Acesso irrestrito a todos os recursos, módulos e configurações globais do sistema', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Associar todas as permissões ao Super Administrador
INSERT INTO core.perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, perm.id
FROM core.perfis p
CROSS JOIN core.permissoes perm
WHERE p.slug = 'super_admin'
ON CONFLICT DO NOTHING;

-- 4. Limpeza de Usuários Legados / Teste (Preservando integridade relacional)
UPDATE academico.docentes SET usuario_id = NULL WHERE usuario_id IS NOT NULL;
UPDATE planejamento.agendamentos SET criado_por = NULL WHERE criado_por IS NOT NULL;
UPDATE planejamento.substituicoes SET avaliado_por = NULL WHERE avaliado_por IS NOT NULL;

DELETE FROM core.usuario_perfis;
DELETE FROM core.usuario_unidades;
DELETE FROM core.usuario_modulos;
DELETE FROM core.usuarios;

-- 5. Seed do Único Usuário Master SUPER_ADMIN
INSERT INTO core.usuarios (id, unidade_id, nome, email, senha_hash, ativo) VALUES
    (
        'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- Polo Principal Cuiabá
        'Super Administrador SIRA',
        'admin@sira.local',
        crypt('Admin@2026', gen_salt('bf', 10)),
        TRUE
    );

-- 6. Associação aos Perfis de Alta Governança
INSERT INTO core.usuario_perfis (usuario_id, perfil_id) VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b00'), -- super_admin
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01')  -- administrador
ON CONFLICT DO NOTHING;

-- 7. Atribuição de Todas as Unidades Operacionais ao SUPER_ADMIN
INSERT INTO core.usuario_unidades (usuario_id, unidade_id)
SELECT 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', u.id
FROM core.unidades u
ON CONFLICT DO NOTHING;

-- 8. Ativação de Todos os Módulos para o SUPER_ADMIN
INSERT INTO core.usuario_modulos (usuario_id, modulo_slug, ativo) VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'overview', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'user-management', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'professors', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'classes', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'courses', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'environments', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'schedules', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'conflicts', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'swaps', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'teacher-allocation', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'teacher-monitoring', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'uniforms', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'assets', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'report-issue', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'diary-import', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'reports', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'core-eventos', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'core-demo', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'system-settings', TRUE)
ON CONFLICT (usuario_id, modulo_slug) DO UPDATE SET ativo = TRUE;
