-- ==============================================================================
-- SIRA - Sistema Integrado de Recursos Acadêmicos
-- 06_academico_planejamento.sql: Tabelas de Domínio Acadêmico e Planejamento
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SCHEMA: ACADEMICO
-- ------------------------------------------------------------------------------

-- 1. Cursos
CREATE TABLE IF NOT EXISTS academico.cursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id UUID NOT NULL REFERENCES core.unidades(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    modalidade VARCHAR(50) DEFAULT 'presencial',
    nivel VARCHAR(50) DEFAULT 'tecnico',
    carga_horaria INT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cursos_unidade_codigo UNIQUE (unidade_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_cursos_unidade ON academico.cursos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_cursos_ativo ON academico.cursos(ativo);
COMMENT ON TABLE academico.cursos IS 'Catálogo de cursos técnicos, qualificações e aperfeiçoamentos ofertados';

-- 2. Ambientes de Aprendizagem (Salas, Laboratórios, Oficinas)
CREATE TABLE IF NOT EXISTS academico.ambientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id UUID NOT NULL REFERENCES core.unidades(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'Sala de Aula',
    capacidade INT NOT NULL DEFAULT 30,
    bloco VARCHAR(50) DEFAULT 'Bloco A',
    andar VARCHAR(50) DEFAULT 'Térreo',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    recursos JSONB DEFAULT '{}',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ambientes_unidade ON academico.ambientes(unidade_id);
CREATE INDEX IF NOT EXISTS idx_ambientes_ativo ON academico.ambientes(ativo);
CREATE INDEX IF NOT EXISTS idx_ambientes_bloco ON academico.ambientes(bloco);
COMMENT ON TABLE academico.ambientes IS 'Salas de aula, laboratórios especializados e oficinas operacionais';

-- 3. Docentes (Quadro de Professores e Instrutores)
CREATE TABLE IF NOT EXISTS academico.docentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id UUID NOT NULL REFERENCES core.unidades(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES core.usuarios(id) ON DELETE SET NULL,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    matricula VARCHAR(50),
    telefone VARCHAR(50),
    especialidade VARCHAR(255),
    carga_horaria_max INT NOT NULL DEFAULT 40,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_docentes_unidade ON academico.docentes(unidade_id);
CREATE INDEX IF NOT EXISTS idx_docentes_ativo ON academico.docentes(ativo);
CREATE INDEX IF NOT EXISTS idx_docentes_email ON academico.docentes(email);
COMMENT ON TABLE academico.docentes IS 'Corpo docente, instrutores técnicos e suas atribuições horárias';

-- 4. Turmas
CREATE TABLE IF NOT EXISTS academico.turmas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id UUID NOT NULL REFERENCES core.unidades(id) ON DELETE CASCADE,
    curso_id UUID NOT NULL REFERENCES academico.cursos(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    turno VARCHAR(50) NOT NULL DEFAULT 'Noturno',
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    vagas INT NOT NULL DEFAULT 30,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_turmas_unidade_codigo UNIQUE (unidade_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_turmas_unidade ON academico.turmas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_turmas_curso ON academico.turmas(curso_id);
CREATE INDEX IF NOT EXISTS idx_turmas_ativo ON academico.turmas(ativo);
COMMENT ON TABLE academico.turmas IS 'Turmas abertas vinculadas a cursos e turnos específicos';


-- ------------------------------------------------------------------------------
-- SCHEMA: PLANEJAMENTO
-- ------------------------------------------------------------------------------

-- 5. Feriados e Recessos
CREATE TABLE IF NOT EXISTS planejamento.feriados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id UUID REFERENCES core.unidades(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    data DATE NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'feriado',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feriados_data ON planejamento.feriados(data);
CREATE INDEX IF NOT EXISTS idx_feriados_unidade ON planejamento.feriados(unidade_id);
COMMENT ON TABLE planejamento.feriados IS 'Calendário de feriados nacionais, municipais e recessos escolares';

-- 6. Agendamentos de Aulas e Alocações
CREATE TABLE IF NOT EXISTS planejamento.agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id UUID NOT NULL REFERENCES core.unidades(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL REFERENCES academico.turmas(id) ON DELETE CASCADE,
    ambiente_id UUID NOT NULL REFERENCES academico.ambientes(id) ON DELETE CASCADE,
    docente_id UUID NOT NULL REFERENCES academico.docentes(id) ON DELETE CASCADE,
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'agendado',
    observacao TEXT,
    criado_por UUID REFERENCES core.usuarios(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_unidade_intervalo ON planejamento.agendamentos(unidade_id, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_agendamentos_ambiente ON planejamento.agendamentos(ambiente_id, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_agendamentos_docente ON planejamento.agendamentos(docente_id, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_agendamentos_turma ON planejamento.agendamentos(turma_id);
COMMENT ON TABLE planejamento.agendamentos IS 'Alocações de aulas e reservas de ambientes físicos por turma e docente';

-- 7. Substituições e Trocas de Turnos
CREATE TABLE IF NOT EXISTS planejamento.substituicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id UUID NOT NULL REFERENCES core.unidades(id) ON DELETE CASCADE,
    agendamento_id UUID NOT NULL REFERENCES planejamento.agendamentos(id) ON DELETE CASCADE,
    docente_original_id UUID NOT NULL REFERENCES academico.docentes(id),
    docente_substituto_id UUID NOT NULL REFERENCES academico.docentes(id),
    motivo TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pendente',
    solicitado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    avaliado_em TIMESTAMPTZ,
    avaliado_por UUID REFERENCES core.usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_substituicoes_unidade ON planejamento.substituicoes(unidade_id);
CREATE INDEX IF NOT EXISTS idx_substituicoes_agendamento ON planejamento.substituicoes(agendamento_id);
COMMENT ON TABLE planejamento.substituicoes IS 'Fluxo de solicitação e aprovação de substituição de docentes';
