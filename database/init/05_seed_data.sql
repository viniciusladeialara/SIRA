-- ==============================================================================
-- SIRA - Sistema Integrado de Recursos Acadêmicos
-- 05_seed_data.sql: Carga inicial de dados de referência (Seed Data)
-- ==============================================================================

-- 1. Inserção das Unidades Operacionais Padrão
INSERT INTO core.unidades (id, codigo, nome, sigla, cidade, estado, ativo) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'SENAI-CBA', 'SENAI Cuiabá', 'CBA', 'Cuiabá', 'MT', TRUE),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'SENAI-CAC', 'SENAI Cáceres', 'CAC', 'Cáceres', 'MT', TRUE),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'SENAI-ROO', 'SENAI Rondonópolis', 'ROO', 'Rondonópolis', 'MT', TRUE),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'SENAI-SNP', 'SENAI Sinop', 'SNP', 'Sinop', 'MT', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Inserção dos Perfis de Acesso Padrão (Roles)
INSERT INTO core.perfis (id, slug, nome, descricao, ativo) VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'administrador', 'Administrador', 'Acesso irrestrito a todos os recursos e unidades', TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'gestor', 'Gestor', 'Gestão administrativa da unidade de atuação', TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'coordenador', 'Coordenador', 'Gestão pedagógica, turmas e matrizes curriculares', TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'professor', 'Professor', 'Lançamento de notas, frequência e diário de classe', TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05', 'secretaria', 'Secretaria', 'Operações cadastrais de matrículas e alunos', TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b06', 'consulta', 'Consulta', 'Visualização de relatórios sem privilégio de edição', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 3. Inserção das Permissões Granulares
INSERT INTO core.permissoes (modulo, acao, chave, descricao) VALUES
    ('usuarios', 'ler', 'usuarios.ler', 'Visualizar listagem e detalhes de usuários'),
    ('usuarios', 'criar', 'usuarios.criar', 'Cadastrar novos usuários no sistema'),
    ('usuarios', 'editar', 'usuarios.editar', 'Alterar dados e permissões de usuários'),
    ('usuarios', 'excluir', 'usuarios.excluir', 'Inativar ou excluir usuários'),
    ('unidades', 'ler', 'unidades.ler', 'Visualizar unidades operacionais'),
    ('unidades', 'criar', 'unidades.criar', 'Cadastrar novas unidades operacionais'),
    ('unidades', 'editar', 'unidades.editar', 'Editar parâmetros de unidades operacionais'),
    ('unidades', 'excluir', 'unidades.excluir', 'Inativar unidades operacionais'),
    ('turmas', 'ler', 'turmas.ler', 'Visualizar turmas e alocações de horários'),
    ('turmas', 'criar', 'turmas.criar', 'Cadastrar novas turmas e cursos'),
    ('turmas', 'editar', 'turmas.editar', 'Alterar dados de turmas e horários'),
    ('turmas', 'excluir', 'turmas.excluir', 'Excluir ou inativar turmas'),
    ('relatorios', 'gerar', 'relatorios.gerar', 'Emitir e exportar relatórios consolidados'),
    ('auditoria', 'ler', 'auditoria.ler', 'Consultar trilhas e logs de auditoria do sistema')
ON CONFLICT (chave) DO NOTHING;

-- 4. Associação de Permissões ao Perfil Administrador (Todas as permissões existentes)
INSERT INTO core.perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, perm.id
FROM core.perfis p
CROSS JOIN core.permissoes perm
WHERE p.slug = 'administrador'
ON CONFLICT DO NOTHING;

-- 5. Usuário Inicial Padrão (Administrador do Sistema)
-- Senha inicial: Admin@2026 (gerada com bcrypt via pgcrypto)
INSERT INTO core.usuarios (id, unidade_id, nome, email, senha_hash, ativo) VALUES
    (
        'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- SENAI Cuiabá
        'Administrador SIRA',
        'admin@sira.local',
        crypt('Admin@2026', gen_salt('bf', 10)),
        TRUE
    )
ON CONFLICT (email) DO NOTHING;

-- 6. Associação do Usuário Administrador ao Perfil Administrador
INSERT INTO core.usuario_perfis (usuario_id, perfil_id) VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01')
ON CONFLICT DO NOTHING;

-- 7. Configurações Globais Iniciais
INSERT INTO core.configuracoes_globais (chave, valor, descricao) VALUES
    (
        'sistema.informacoes',
        '{"nome": "SIRA", "versao": "1.0.0", "ambiente": "development", "instituicao": "SENAI"}'::jsonb,
        'Metadados e parâmetros operacionais da versão'
    ),
    (
        'sistema.seguranca',
        '{"jwt_expiracao_segundos": 3600, "refresh_token_expiracao_dias": 7, "tentativas_bloqueio_login": 5}'::jsonb,
        'Políticas de expiração de token e controle de brute-force'
    )
ON CONFLICT (chave) DO NOTHING;
