-- ==============================================================================
-- SIRA - Sistema Integrado de Recursos Acadêmicos
-- 04_auditoria_tables.sql: Estrutura imutável de Trilha de Auditoria
-- ==============================================================================

CREATE TABLE IF NOT EXISTS auditoria.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID,
    usuario_email VARCHAR(255),
    unidade_id UUID,
    schema_name VARCHAR(100) NOT NULL DEFAULT 'public',
    tabela VARCHAR(100) NOT NULL DEFAULT 'unknown',
    registro_id VARCHAR(255),
    acao VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE, LOGIN, LOGOUT
    data_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(45),
    user_agent TEXT,
    dados_anteriores JSONB,
    dados_novos JSONB
);

CREATE INDEX IF NOT EXISTS idx_auditoria_data_hora ON auditoria.logs(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id ON auditoria.logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_unidade_id ON auditoria.logs(unidade_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabela ON auditoria.logs(tabela);
CREATE INDEX IF NOT EXISTS idx_auditoria_acao ON auditoria.logs(acao);

COMMENT ON TABLE auditoria.logs IS 'Trilha de auditoria imutável de eventos operacionais, autenticação e alterações de dados';
