-- ==============================================================================
-- SIRA - Sistema Integrado de Recursos Acadêmicos
-- 02_seed_teste_carga.sql: Carga Completa de Teste de Carga para 3 Unidades SENAI
-- Unidades: 1. SENAI Cuiabá | 2. SENAI Cáceres | 3. SENAI Rondonópolis
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ASSEGURA AS 3 UNIDADES OPERACIONAIS
-- ------------------------------------------------------------------------------
INSERT INTO core.unidades (id, codigo, nome, sigla, cidade, estado, ativo) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'SENAI-CBA', 'SENAI Cuiabá', 'CBA', 'Cuiabá', 'MT', TRUE),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'SENAI-CAC', 'SENAI Cáceres', 'CAC', 'Cáceres', 'MT', TRUE),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'SENAI-ROO', 'SENAI Rondonópolis', 'ROO', 'Rondonópolis', 'MT', TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, sigla = EXCLUDED.sigla, cidade = EXCLUDED.cidade, ativo = TRUE;

-- ------------------------------------------------------------------------------
-- 2. USUÁRIOS E COORDENADORES POR UNIDADE
-- ------------------------------------------------------------------------------
INSERT INTO core.usuarios (id, unidade_id, nome, email, senha_hash, ativo) VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c10', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Coord. Cuiabá - Marcos Silva', 'coord.cba@sira.local', crypt('Admin@2026', gen_salt('bf', 10)), TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Coord. Cáceres - Luciana Prado', 'coord.cac@sira.local', crypt('Admin@2026', gen_salt('bf', 10)), TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Coord. Rondonópolis - Renato Dias', 'coord.roo@sira.local', crypt('Admin@2026', gen_salt('bf', 10)), TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, email = EXCLUDED.email, ativo = TRUE;

INSERT INTO core.usuario_perfis (usuario_id, perfil_id) VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c10', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. CATÁLOGO DE CURSOS (10 Cursos distribuídos nas 3 unidades)
-- ------------------------------------------------------------------------------
-- Cuiabá
INSERT INTO academico.cursos (id, unidade_id, codigo, nome, modalidade, nivel, carga_horaria, ativo) VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'TDS-2026', 'Técnico em Desenvolvimento de Sistemas', 'presencial', 'tecnico', 1200, TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ELETRO-2026', 'Técnico em Eletrotécnica', 'presencial', 'tecnico', 1200, TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'MEC-2026', 'Técnico em Mecatrônica Industrial', 'presencial', 'tecnico', 1400, TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'REDES-2026', 'Técnico em Redes de Computadores', 'presencial', 'tecnico', 1000, TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, carga_horaria = EXCLUDED.carga_horaria, ativo = TRUE;

-- Cáceres
INSERT INTO academico.cursos (id, unidade_id, codigo, nome, modalidade, nivel, carga_horaria, ativo) VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'INFO-CAC-2026', 'Técnico em Informática para Internet', 'presencial', 'tecnico', 1000, TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'ADM-CAC-2026', 'Técnico em Administração', 'presencial', 'tecnico', 1000, TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'MSI-CAC-2026', 'Técnico em Manutenção e Suporte em Informática', 'presencial', 'tecnico', 1000, TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, carga_horaria = EXCLUDED.carga_horaria, ativo = TRUE;

-- Rondonópolis
INSERT INTO academico.cursos (id, unidade_id, codigo, nome, modalidade, nivel, carga_horaria, ativo) VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b08', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'ELETROMEC-2026', 'Técnico em Eletromecânica', 'presencial', 'tecnico', 1400, TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b09', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'LOG-2026', 'Técnico em Logística Portuária e Ferroviária', 'presencial', 'tecnico', 1000, TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b10', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'SEGTRAB-2026', 'Técnico em Segurança do Trabalho', 'presencial', 'tecnico', 1200, TRUE),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'AUTOMA-2026', 'Técnico em Automação Industrial', 'presencial', 'tecnico', 1200, TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, carga_horaria = EXCLUDED.carga_horaria, ativo = TRUE;

-- ------------------------------------------------------------------------------
-- 4. AMBIENTES DE APRENDIZAGEM (15 Ambientes nas 3 unidades)
-- ------------------------------------------------------------------------------
-- Cuiabá (6 Ambientes)
INSERT INTO academico.ambientes (id, unidade_id, nome, tipo, capacidade, bloco, andar, recursos, ativo) VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Laboratório de Informática 01', 'Laboratório', 35, 'Bloco A', '1º Andar', '{"computadores": 35, "projetor": true, "ar_condicionado": true}', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Laboratório de Informática 02', 'Laboratório', 30, 'Bloco A', '1º Andar', '{"computadores": 30, "projetor": true, "ar_condicionado": true}', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Oficina de Robótica e Automação', 'Oficina', 25, 'Bloco B', 'Térreo', '{"bancadas": 12, "kits_robotica": true, "ar_condicionado": true}', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Sala de Aula Teórica 101', 'Sala de Aula', 40, 'Bloco C', '1º Andar', '{"carteiras": 40, "projetor": true, "quadro_digital": true}', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Auditório Principal Cuiabá', 'Auditório', 150, 'Bloco Central', 'Térreo', '{"sistema_som": true, "palco": true, "ar_condicionado": true}', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Laboratório de Redes e Cloud', 'Laboratório', 28, 'Bloco A', '2º Andar', '{"racks": 4, "switches_cisco": true, "servidores": 2}', TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, capacidade = EXCLUDED.capacidade, ativo = TRUE;

-- Cáceres (4 Ambientes)
INSERT INTO academico.ambientes (id, unidade_id, nome, tipo, capacidade, bloco, andar, recursos, ativo) VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Lab Informática Cáceres 01', 'Laboratório', 30, 'Bloco Único', 'Térreo', '{"computadores": 30, "projetor": true}', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Sala Multiuso Pantanal', 'Sala de Aula', 35, 'Bloco Único', 'Térreo', '{"projetor": true, "ar_condicionado": true}', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Laboratório de Manutenção Hardware', 'Oficina', 20, 'Bloco Único', 'Térreo', '{"bancadas_antiestaticas": 10, "ferramental": true}', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c15', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Sala de Gestão e Negócios', 'Sala de Aula', 30, 'Bloco Único', '1º Andar', '{"projetor": true, "mesas_redondas": true}', TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, capacidade = EXCLUDED.capacidade, ativo = TRUE;

-- Rondonópolis (5 Ambientes)
INSERT INTO academico.ambientes (id, unidade_id, nome, tipo, capacidade, bloco, andar, recursos, ativo) VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c08', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Oficina de Metalmecânica e Solda', 'Oficina', 25, 'Galpão Industrial', 'Térreo', '{"tornos_cnc": 4, "maquinas_solda": 6}', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c09', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Laboratório de Automação e CLP', 'Laboratório', 24, 'Bloco A', '1º Andar', '{"bancadas_festo": true, "clp_siemens": true}', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c16', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Laboratório de Logística e Supply', 'Laboratório', 30, 'Bloco B', '1º Andar', '{"computadores": 30, "simulador_sap": true}', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c17', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Sala Teórica Rondon 201', 'Sala de Aula', 40, 'Bloco A', '2º Andar', '{"projetor": true, "ar_condicionado": true}', TRUE),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c18', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Auditório Rondonópolis', 'Auditório', 120, 'Bloco Central', 'Térreo', '{"sistema_som": true, "palco": true}', TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, capacidade = EXCLUDED.capacidade, ativo = TRUE;

-- ------------------------------------------------------------------------------
-- 5. QUADRO DE DOCENTES (15 Professores nas 3 unidades)
-- ------------------------------------------------------------------------------
-- Cuiabá (5 Professores)
INSERT INTO academico.docentes (id, unidade_id, nome, email, matricula, especialidade, carga_horaria_max, ativo) VALUES
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Prof. Roberto Santos', 'roberto.santos@sira.local', 'DOC-CBA-001', 'Engenharia de Software e Banco de Dados', 40, TRUE),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Profa. Ana Paula Lima', 'ana.lima@sira.local', 'DOC-CBA-002', 'Redes de Computadores e DevOps', 40, TRUE),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Prof. Carlos Eduardo', 'carlos.eduardo@sira.local', 'DOC-CBA-003', 'Eletroeletrônica e Robótica', 40, TRUE),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Profa. Juliana Mendes', 'juliana.mendes@sira.local', 'DOC-CBA-004', 'Inteligência Artificial e Python', 40, TRUE),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Prof. Thiago Albuquerque', 'thiago.albuquerque@sira.local', 'DOC-CBA-005', 'Sistemas Embarcados e IoT', 40, TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, especialidade = EXCLUDED.especialidade, ativo = TRUE;

-- Cáceres (4 Professores)
INSERT INTO academico.docentes (id, unidade_id, nome, email, matricula, especialidade, carga_horaria_max, ativo) VALUES
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Prof. Marcos Vinicius', 'marcos.vinicius@sira.local', 'DOC-CAC-001', 'Desenvolvimento Web Frontend e Backend', 40, TRUE),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Profa. Beatriz Ramos', 'beatriz.ramos@sira.local', 'DOC-CAC-002', 'Administração, Finanças e Custos', 40, TRUE),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d08', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Prof. Diego Oliveira', 'diego.oliveira@sira.local', 'DOC-CAC-003', 'Hardware e Suporte de TI', 40, TRUE),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d09', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Profa. Camila Ferreira', 'camila.ferreira@sira.local', 'DOC-CAC-004', 'Metodologias Ágeis e Projetos', 40, TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, especialidade = EXCLUDED.especialidade, ativo = TRUE;

-- Rondonópolis (6 Professores)
INSERT INTO academico.docentes (id, unidade_id, nome, email, matricula, especialidade, carga_horaria_max, ativo) VALUES
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d10', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Prof. Rodrigo Carvalho', 'rodrigo.carvalho@sira.local', 'DOC-ROO-001', 'Eletromecânica e Comandos Elétricos', 40, TRUE),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Profa. Patricia Souza', 'patricia.souza@sira.local', 'DOC-ROO-002', 'Cadeia de Suprimentos e Logística', 40, TRUE),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Prof. Lucas Martins', 'lucas.martins@sira.local', 'DOC-ROO-003', 'Segurança do Trabalho e Normas NR', 40, TRUE),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Profa. Vanessa Gomes', 'vanessa.gomes@sira.local', 'DOC-ROO-004', 'Automação Industrial e Redes Modbus', 40, TRUE),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Prof. André Ribeiro', 'andre.ribeiro@sira.local', 'DOC-ROO-005', 'Usinagem Convencional e CNC', 40, TRUE),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d15', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Prof. Gabriel Nogueira', 'gabriel.nogueira@sira.local', 'DOC-ROO-006', 'Soldagem MIG/MAG e TIG', 40, TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, especialidade = EXCLUDED.especialidade, ativo = TRUE;

-- ------------------------------------------------------------------------------
-- 6. TURMAS ATIVAS (11 Turmas nas 3 unidades)
-- ------------------------------------------------------------------------------
-- Cuiabá (4 Turmas)
INSERT INTO academico.turmas (id, unidade_id, curso_id, codigo, nome, turno, data_inicio, data_fim, vagas, ativo) VALUES
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'TDS-2026-N1', 'TDS - Módulo 1 (Noturno)', 'Noturno', '2026-02-02', '2026-12-18', 35, TRUE),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'ELETRO-2026-V1', 'Eletrotécnica - Módulo 1 (Vespertino)', 'Vespertino', '2026-02-02', '2026-12-18', 30, TRUE),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'MEC-2026-M1', 'Mecatrônica - Módulo 1 (Matutino)', 'Matutino', '2026-02-02', '2026-12-18', 25, TRUE),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b06', 'REDES-2026-N1', 'Redes de Computadores (Noturno)', 'Noturno', '2026-02-02', '2026-12-18', 28, TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, turno = EXCLUDED.turno, vagas = EXCLUDED.vagas, ativo = TRUE;

-- Cáceres (3 Turmas)
INSERT INTO academico.turmas (id, unidade_id, curso_id, codigo, nome, turno, data_inicio, data_fim, vagas, ativo) VALUES
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'INFO-CAC-2026-N1', 'Informática Internet - Módulo 1', 'Noturno', '2026-02-02', '2026-12-18', 30, TRUE),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05', 'ADM-CAC-2026-V1', 'Administração - Módulo 1', 'Vespertino', '2026-02-02', '2026-12-18', 30, TRUE),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b07', 'MSI-CAC-2026-M1', 'Manutenção Hardware - Módulo 1', 'Matutino', '2026-02-02', '2026-12-18', 20, TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, turno = EXCLUDED.turno, vagas = EXCLUDED.vagas, ativo = TRUE;

-- Rondonópolis (4 Turmas)
INSERT INTO academico.turmas (id, unidade_id, curso_id, codigo, nome, turno, data_inicio, data_fim, vagas, ativo) VALUES
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e08', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b08', 'ELETROMEC-2026-N1', 'Eletromecânica - Módulo 1 (Noturno)', 'Noturno', '2026-02-02', '2026-12-18', 25, TRUE),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e09', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b09', 'LOG-2026-N1', 'Logística - Módulo 1 (Noturno)', 'Noturno', '2026-02-02', '2026-12-18', 30, TRUE),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e10', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b10', 'SEGTRAB-2026-V1', 'Segurança do Trabalho (Vespertino)', 'Vespertino', '2026-02-02', '2026-12-18', 35, TRUE),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'AUTOMA-2026-M1', 'Automação Industrial (Matutino)', 'Matutino', '2026-02-02', '2026-12-18', 25, TRUE)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome, turno = EXCLUDED.turno, vagas = EXCLUDED.vagas, ativo = TRUE;

-- ------------------------------------------------------------------------------
-- 7. CALENDÁRIO DE FERIADOS REGIONAIS DAS 3 UNIDADES
-- ------------------------------------------------------------------------------
INSERT INTO planejamento.feriados (id, unidade_id, nome, data, tipo) VALUES
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f20', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Aniversário de Cuiabá', '2026-04-08', 'feriado_municipal'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f21', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dia do Padroeiro Senhor Bom Jesus de Cuiabá', '2026-12-08', 'feriado_municipal'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Aniversário de Cáceres', '2026-10-06', 'feriado_municipal'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f23', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Dia de São Luiz de Cáceres', '2026-08-25', 'feriado_municipal'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f24', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Aniversário de Rondonópolis', '2026-12-10', 'feriado_municipal')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. AGENDAMENTOS E ALOCAÇÕES DE AULAS (Aulas nas 3 unidades)
-- ------------------------------------------------------------------------------
-- Cuiabá
INSERT INTO planejamento.agendamentos (id, unidade_id, turma_id, ambiente_id, docente_id, data_inicio, data_fim, status, observacao) VALUES
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380101', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', '2026-11-09 19:00:00-04', '2026-11-09 22:30:00-04', 'agendado', 'Banco de Dados PostgreSQL e ORMs'),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380102', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', '2026-11-10 19:00:00-04', '2026-11-10 22:30:00-04', 'agendado', 'Desenvolvimento de APIs RESTful com NestJS'),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380103', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e02', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c04', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d03', '2026-11-09 13:30:00-04', '2026-11-09 17:30:00-04', 'agendado', 'Instalações Elétricas Industriais'),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380104', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e03', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d06', '2026-11-10 07:30:00-04', '2026-11-10 11:30:00-04', 'agendado', 'Sistemas Robotizados com Sensores')
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status, observacao = EXCLUDED.observacao;

-- Cáceres
INSERT INTO planejamento.agendamentos (id, unidade_id, turma_id, ambiente_id, docente_id, data_inicio, data_fim, status, observacao) VALUES
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380105', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e05', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c06', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d04', '2026-11-09 19:00:00-04', '2026-11-09 22:30:00-04', 'agendado', 'Desenvolvimento Web Fullstack'),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380106', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e06', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c15', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d07', '2026-11-10 13:30:00-04', '2026-11-10 17:30:00-04', 'agendado', 'Contabilidade de Custos e Orçamentos')
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status, observacao = EXCLUDED.observacao;

-- Rondonópolis
INSERT INTO planejamento.agendamentos (id, unidade_id, turma_id, ambiente_id, docente_id, data_inicio, data_fim, status, observacao) VALUES
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380107', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e08', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c08', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d10', '2026-11-09 19:00:00-04', '2026-11-09 22:30:00-04', 'agendado', 'Usinagem em Torno Convencional'),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380108', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e09', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c16', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', '2026-11-09 19:00:00-04', '2026-11-09 22:30:00-04', 'agendado', 'Gestão de Estoques e Simulação Portuária'),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380109', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c09', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d13', '2026-11-10 07:30:00-04', '2026-11-10 11:30:00-04', 'agendado', 'Programação de Controladores Lógicos Programáveis (CLP)')
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status, observacao = EXCLUDED.observacao;

-- ------------------------------------------------------------------------------
-- 9. SUBSTITUIÇÃO DE EXEMPLO (SENAI Cuiabá)
-- ------------------------------------------------------------------------------
INSERT INTO planejamento.substituicoes (id, unidade_id, agendamento_id, docente_original_id, docente_substituto_id, motivo, status) VALUES
    ('20eebc99-9c0b-4ef8-bb6d-6bb9bd380201', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '10eebc99-9c0b-4ef8-bb6d-6bb9bd380102', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d05', 'Participação no Congresso Nacional de TI', 'pendente')
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status, motivo = EXCLUDED.motivo;
