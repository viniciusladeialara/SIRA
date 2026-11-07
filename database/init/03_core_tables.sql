-- ==============================================================================
-- SIRA - Sistema Integrado de Recursos Acadêmicos
-- 03_core_tables.sql: Tabelas estruturais do Schema CORE (Multiunidade & RBAC)
-- ==============================================================================

-- 1. Unidades Operacionais (Multi-tenancy)
CREATE TABLE IF NOT EXISTS core.unidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) UNIQUE,
    nome VARCHAR(255) NOT NULL,
    sigla VARCHAR(50),
    cidade VARCHAR(100),
    estado VARCHAR(2) DEFAULT 'MT',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_unidades_ativo ON core.unidades(ativo);
CREATE INDEX IF NOT EXISTS idx_unidades_cidade ON core.unidades(cidade);

COMMENT ON TABLE core.unidades IS 'Unidades operacionais SENAI suportadas pelo SIRA';

-- 2. Usuários do Sistema
CREATE TABLE IF NOT EXISTS core.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id UUID REFERENCES core.unidades(id) ON DELETE SET NULL,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON core.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_unidade ON core.usuarios(unidade_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON core.usuarios(ativo);

COMMENT ON TABLE core.usuarios IS 'Cadastro unificado de usuários e credenciais de acesso';

-- 3. Perfis de Acesso (Roles)
CREATE TABLE IF NOT EXISTS core.perfis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_perfis_slug ON core.perfis(slug);

COMMENT ON TABLE core.perfis IS 'Catálogo de papéis/perfis de usuários no sistema (RBAC)';

-- 4. Permissões Atômicas (Granular Permissions)
CREATE TABLE IF NOT EXISTS core.permissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modulo VARCHAR(50) NOT NULL,
    acao VARCHAR(50) NOT NULL,
    chave VARCHAR(100) UNIQUE NOT NULL,
    descricao TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permissoes_modulo ON core.permissoes(modulo);
CREATE INDEX IF NOT EXISTS idx_permissoes_chave ON core.permissoes(chave);

COMMENT ON TABLE core.permissoes IS 'Permissões atômicas granulares no padrão modulo.acao';

-- 5. Junção Usuários x Perfis
CREATE TABLE IF NOT EXISTS core.usuario_perfis (
    usuario_id UUID NOT NULL REFERENCES core.usuarios(id) ON DELETE CASCADE,
    perfil_id UUID NOT NULL REFERENCES core.perfis(id) ON DELETE CASCADE,
    atribuido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, perfil_id)
);

-- 6. Junção Perfis x Permissões
CREATE TABLE IF NOT EXISTS core.perfil_permissoes (
    perfil_id UUID NOT NULL REFERENCES core.perfis(id) ON DELETE CASCADE,
    permissao_id UUID NOT NULL REFERENCES core.permissoes(id) ON DELETE CASCADE,
    atribuido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (perfil_id, permissao_id)
);

-- 7. Configurações Globais do Sistema
CREATE TABLE IF NOT EXISTS core.configuracoes_globais (
    chave VARCHAR(100) PRIMARY KEY,
    valor JSONB NOT NULL,
    descricao TEXT,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE core.configuracoes_globais IS 'Parâmetros e configurações globais do sistema em formato JSON';
