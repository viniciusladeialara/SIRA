-- ==============================================================================
-- SIRA - Sistema Integrado de Recursos Acadêmicos
-- 01_seed_producao.sql: Carga Inicial Mínima e Essencial para Ambiente de Produção
-- ==============================================================================

-- 1. Perfis Oficiais de Acesso (RBAC)
INSERT INTO core.perfis (id, slug, nome, descricao, ativo) VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'administrador', 'Administrador', 'Acesso irrestrito a todos os recursos, configurações e unidades', TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'gestor', 'Gestor', 'Gestão administrativa da unidade de atuação', TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'coordenador', 'Coordenador', 'Gestão pedagógica, planejamento de turmas e grade horária', TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'professor', 'Professor', 'Acesso à grade de aulas, apontamento de frequência e notas', TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05', 'secretaria', 'Secretaria', 'Operações cadastrais de matrículas, turmas e alunos', TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b06', 'consulta', 'Consulta', 'Visualização de relatórios gerenciais sem privilégio de edição', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 2. Permissões Granulares por Módulo
INSERT INTO core.permissoes (modulo, acao, chave, descricao) VALUES
    ('usuarios', 'ler', 'usuarios.ler', 'Visualizar listagem e detalhes de usuários'),
    ('usuarios', 'criar', 'usuarios.criar', 'Cadastrar novos usuários no sistema'),
    ('usuarios', 'editar', 'usuarios.editar', 'Alterar dados e permissões de usuários'),
    ('usuarios', 'excluir', 'usuarios.excluir', 'Inativar ou excluir usuários'),
    ('unidades', 'ler', 'unidades.ler', 'Visualizar unidades operacionais'),
    ('unidades', 'criar', 'unidades.criar', 'Cadastrar novas unidades operacionais'),
    ('unidades', 'editar', 'unidades.editar', 'Editar parâmetros de unidades operacionais'),
    ('unidades', 'excluir', 'unidades.excluir', 'Inativar unidades operacionais'),
    ('cursos', 'ler', 'cursos.ler', 'Visualizar catálogo de cursos'),
    ('cursos', 'criar', 'cursos.criar', 'Cadastrar novos cursos'),
    ('cursos', 'editar', 'cursos.editar', 'Editar parâmetros de cursos'),
    ('cursos', 'excluir', 'cursos.excluir', 'Inativar cursos'),
    ('ambientes', 'ler', 'ambientes.ler', 'Visualizar salas e laboratórios'),
    ('ambientes', 'criar', 'ambientes.criar', 'Cadastrar novos ambientes de ensino'),
    ('ambientes', 'editar', 'ambientes.editar', 'Editar infraestrutura de ambientes'),
    ('ambientes', 'excluir', 'ambientes.excluir', 'Inativar ambientes'),
    ('docentes', 'ler', 'docentes.ler', 'Visualizar corpo docente'),
    ('docentes', 'criar', 'docentes.criar', 'Cadastrar novos docentes'),
    ('docentes', 'editar', 'docentes.editar', 'Editar dados de docentes'),
    ('docentes', 'excluir', 'docentes.excluir', 'Inativar docentes'),
    ('turmas', 'ler', 'turmas.ler', 'Visualizar turmas e alocações de horários'),
    ('turmas', 'criar', 'turmas.criar', 'Cadastrar novas turmas e cursos'),
    ('turmas', 'editar', 'turmas.editar', 'Alterar dados de turmas e horários'),
    ('turmas', 'excluir', 'turmas.excluir', 'Excluir ou inativar turmas'),
    ('agendamentos', 'ler', 'agendamentos.ler', 'Consultar grade de horários'),
    ('agendamentos', 'criar', 'agendamentos.criar', 'Agendar aulas e reservar ambientes'),
    ('agendamentos', 'editar', 'agendamentos.editar', 'Alterar reservas e horários'),
    ('agendamentos', 'excluir', 'agendamentos.excluir', 'Cancelar reservas de horários'),
    ('relatorios', 'gerar', 'relatorios.gerar', 'Emitir e exportar relatórios consolidados'),
    ('auditoria', 'ler', 'auditoria.ler', 'Consultar trilhas e logs de auditoria do sistema')
ON CONFLICT (chave) DO NOTHING;

-- 3. Associação de Permissões ao Perfil Administrador
INSERT INTO core.perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, perm.id
FROM core.perfis p
CROSS JOIN core.permissoes perm
WHERE p.slug = 'administrador'
ON CONFLICT DO NOTHING;

-- 4. Associação de Permissões ao Perfil Coordenador
INSERT INTO core.perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, perm.id
FROM core.perfis p
JOIN core.permissoes perm ON perm.chave IN (
    'cursos.ler', 'ambientes.ler', 'docentes.ler', 'turmas.ler', 'turmas.criar', 'turmas.editar',
    'agendamentos.ler', 'agendamentos.criar', 'agendamentos.editar', 'relatorios.gerar'
)
WHERE p.slug = 'coordenador'
ON CONFLICT DO NOTHING;

-- 5. Parâmetros Globais do Sistema
INSERT INTO core.configuracoes_globais (chave, valor, descricao) VALUES
    ('sistema.informacoes', '{"nome": "SIRA", "versao": "1.0.0", "ambiente": "production", "instituicao": "SENAI"}'::jsonb, 'Metadados e parâmetros operacionais da versão'),
    ('seguranca.jwt', '{"access_token_ttl": 3600, "refresh_token_ttl": 604800, "max_login_attempts": 5}'::jsonb, 'Políticas de segurança e expiração de sessões'),
    ('auditoria.retencao', '{"dias_retencao": 1825, "imutavel": true}'::jsonb, 'Política de conformidade e retenção de logs de auditoria (5 anos)')
ON CONFLICT (chave) DO NOTHING;
