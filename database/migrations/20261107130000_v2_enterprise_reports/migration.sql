-- Migration: 20261107130000_v2_enterprise_reports
-- Criação das Materialized Views analíticas de alta performance e função de refresh concorrente

CREATE SCHEMA IF NOT EXISTS relatorios;

-- 1. MATERIALIZED VIEW: Ocupação de Ambientes
DROP MATERIALIZED VIEW IF EXISTS relatorios.vw_ocupacao_ambientes CASCADE;
CREATE MATERIALIZED VIEW relatorios.vw_ocupacao_ambientes AS
SELECT 
    a.id AS ambiente_id,
    a.nome AS ambiente_nome,
    a.tipo AS ambiente_tipo,
    a.capacidade AS capacidade,
    a.unidade_id,
    u.nome AS unidade_nome,
    COUNT(ag.id)::int AS total_agendamentos,
    COUNT(DISTINCT ag.turma_id)::int AS total_turmas_atendidas,
    COUNT(DISTINCT ag.docente_id)::int AS total_docentes_alocados,
    COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (ag.data_fim - ag.data_inicio)) / 3600)::numeric, 2), 0) AS total_horas_ocupadas,
    ROUND(
        COALESCE(
            (COUNT(ag.id)::numeric / NULLIF(200, 0)) * 100, 
            0
        ), 2
    ) AS taxa_ocupacao_estimada_pct
FROM academico.ambientes a
LEFT JOIN core.unidades u ON u.id = a.unidade_id
LEFT JOIN planejamento.agendamentos ag ON ag.ambiente_id = a.id AND ag.status = 'CONFIRMADO'
WHERE a.ativo = true AND a.excluido_em IS NULL
GROUP BY a.id, a.nome, a.tipo, a.capacidade, a.unidade_id, u.nome;

CREATE UNIQUE INDEX idx_vw_ocupacao_ambientes_id ON relatorios.vw_ocupacao_ambientes (ambiente_id);

-- 2. MATERIALIZED VIEW: Carga Horária Docente
DROP MATERIALIZED VIEW IF EXISTS relatorios.vw_carga_docentes CASCADE;
CREATE MATERIALIZED VIEW relatorios.vw_carga_docentes AS
SELECT 
    d.id AS docente_id,
    d.nome AS docente_nome,
    d.email AS docente_email,
    d.unidade_id,
    u.nome AS unidade_nome,
    COUNT(ag.id)::int AS total_agendamentos,
    COUNT(DISTINCT ag.turma_id)::int AS total_turmas,
    COUNT(DISTINCT ag.ambiente_id)::int AS total_ambientes_distintos,
    COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (ag.data_fim - ag.data_inicio)) / 3600)::numeric, 2), 0) AS total_horas_alocadas,
    ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (ag.data_fim - ag.data_inicio)) / 3600)::numeric, 0) / 40.0 * 100, 2) AS percentual_jornada_estimada
FROM academico.docentes d
LEFT JOIN core.unidades u ON u.id = d.unidade_id
LEFT JOIN planejamento.agendamentos ag ON ag.docente_id = d.id AND ag.status = 'CONFIRMADO'
WHERE d.ativo = true AND d.excluido_em IS NULL
GROUP BY d.id, d.nome, d.email, d.unidade_id, u.nome;

CREATE UNIQUE INDEX idx_vw_carga_docentes_id ON relatorios.vw_carga_docentes (docente_id);

-- 3. MATERIALIZED VIEW: Turmas Ativas
DROP MATERIALIZED VIEW IF EXISTS relatorios.vw_turmas_ativas CASCADE;
CREATE MATERIALIZED VIEW relatorios.vw_turmas_ativas AS
SELECT 
    t.id AS turma_id,
    t.nome AS turma_nome,
    t.codigo AS turma_codigo,
    t.turno AS turno,
    CASE WHEN EXTRACT(MONTH FROM t.data_inicio) <= 6 THEN 1 ELSE 2 END AS semestre,
    EXTRACT(YEAR FROM t.data_inicio)::int AS ano_letivo,
    t.curso_id,
    c.nome AS curso_nome,
    t.unidade_id,
    u.nome AS unidade_nome,
    COUNT(ag.id)::int AS total_agendamentos,
    COUNT(DISTINCT ag.docente_id)::int AS total_docentes,
    COUNT(DISTINCT ag.ambiente_id)::int AS total_ambientes,
    t.data_inicio AS data_inicio_turma,
    t.data_fim AS data_fim_turma,
    MIN(ag.data_inicio) AS primeiro_agendamento,
    MAX(ag.data_fim) AS ultimo_agendamento
FROM academico.turmas t
LEFT JOIN academico.cursos c ON c.id = t.curso_id
LEFT JOIN core.unidades u ON u.id = t.unidade_id
LEFT JOIN planejamento.agendamentos ag ON ag.turma_id = t.id AND ag.status = 'CONFIRMADO'
WHERE t.ativo = true AND t.excluido_em IS NULL
GROUP BY t.id, t.nome, t.codigo, t.turno, t.data_inicio, t.data_fim, t.curso_id, c.nome, t.unidade_id, u.nome;

CREATE UNIQUE INDEX idx_vw_turmas_ativas_id ON relatorios.vw_turmas_ativas (turma_id);

-- 4. MATERIALIZED VIEW: Detecção de Conflitos
DROP MATERIALIZED VIEW IF EXISTS relatorios.vw_conflitos CASCADE;
CREATE MATERIALIZED VIEW relatorios.vw_conflitos AS
SELECT 
    ag1.id AS agendamento_1_id,
    ag2.id AS agendamento_2_id,
    ag1.unidade_id,
    u.nome AS unidade_nome,
    CASE 
        WHEN ag1.ambiente_id = ag2.ambiente_id AND ag1.docente_id = ag2.docente_id THEN 'CONFLITO_DUPLO_AMBIENTE_E_DOCENTE'
        WHEN ag1.ambiente_id = ag2.ambiente_id THEN 'CONFLITO_SOBREPOSICAO_AMBIENTE'
        WHEN ag1.docente_id = ag2.docente_id THEN 'CONFLITO_SOBREPOSICAO_DOCENTE'
        ELSE 'OUTRO_CONFLITO'
    END AS tipo_conflito,
    ag1.ambiente_id,
    amb.nome AS ambiente_nome,
    ag1.docente_id,
    doc.nome AS docente_nome,
    ag1.data_inicio AS inicio_1,
    ag1.data_fim AS fim_1,
    ag2.data_inicio AS inicio_2,
    ag2.data_fim AS fim_2,
    GREATEST(ag1.data_inicio, ag2.data_inicio) AS inicio_sobreposicao,
    LEAST(ag1.data_fim, ag2.data_fim) AS fim_sobreposicao
FROM planejamento.agendamentos ag1
JOIN planejamento.agendamentos ag2 ON ag1.id < ag2.id 
    AND ag1.unidade_id = ag2.unidade_id
    AND ag1.status = 'CONFIRMADO' 
    AND ag2.status = 'CONFIRMADO'
    AND (ag1.ambiente_id = ag2.ambiente_id OR ag1.docente_id = ag2.docente_id)
    AND ag1.data_inicio < ag2.data_fim 
    AND ag1.data_fim > ag2.data_inicio
LEFT JOIN core.unidades u ON u.id = ag1.unidade_id
LEFT JOIN academico.ambientes amb ON amb.id = ag1.ambiente_id
LEFT JOIN academico.docentes doc ON doc.id = ag1.docente_id;

CREATE UNIQUE INDEX idx_vw_conflitos_ids ON relatorios.vw_conflitos (agendamento_1_id, agendamento_2_id);

-- Função de Refresh Concorrente
CREATE OR REPLACE FUNCTION relatorios.refresh_all_reports()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY relatorios.vw_ocupacao_ambientes;
    REFRESH MATERIALIZED VIEW CONCURRENTLY relatorios.vw_carga_docentes;
    REFRESH MATERIALIZED VIEW CONCURRENTLY relatorios.vw_turmas_ativas;
    REFRESH MATERIALIZED VIEW CONCURRENTLY relatorios.vw_conflitos;
END;
$$ LANGUAGE plpgsql;
