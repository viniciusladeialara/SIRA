-- ==============================================================================
-- SIRA - Sistema Integrado de Recursos Acadêmicos
-- 02_schemas.sql: Criação dos schemas modulares do banco de dados
-- ==============================================================================

-- Schema CORE: Gestão de identidades, autenticação, multiunidade e RBAC
CREATE SCHEMA IF NOT EXISTS core;

-- Schema ACADEMICO: Cursos, matrizes, turmas, alunos e matrículas
CREATE SCHEMA IF NOT EXISTS academico;

-- Schema PLANEJAMENTO: Alocação de recursos, matrizes de horários e restrições
CREATE SCHEMA IF NOT EXISTS planejamento;

-- Schema PRODUCAO: Apontamentos de aula, diários de classe e frequência
CREATE SCHEMA IF NOT EXISTS producao;

-- Schema RELATORIOS: Estruturas agregadas para BI e relatórios analíticos
CREATE SCHEMA IF NOT EXISTS relatorios;

-- Schema AUDITORIA: Trilha de auditoria e conformidade imutável
CREATE SCHEMA IF NOT EXISTS auditoria;

-- Comentários descritivos nos schemas
COMMENT ON SCHEMA core IS 'Domínio central: Usuários, unidades, perfis, permissões e parâmetros';
COMMENT ON SCHEMA academico IS 'Domínio acadêmico: Cursos, turmas, currículos, matrículas e docentes';
COMMENT ON SCHEMA planejamento IS 'Domínio de planejamento: Calendários, alocações e horários';
COMMENT ON SCHEMA producao IS 'Domínio de execução: Aulas, notas, frequências e diários';
COMMENT ON SCHEMA relatorios IS 'Domínio analítico: Visões consolidadas e relatórios gerenciais';
COMMENT ON SCHEMA auditoria IS 'Domínio de segurança: Logs de eventos e trilha de auditoria';
