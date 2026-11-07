-- ==============================================================================
-- SIRA - Sistema Integrado de Recursos Acadêmicos
-- 07_seed_academico.sql: Carga Inicial de Dados de Cursos, Ambientes e Docentes
-- ==============================================================================

-- 1. Cursos para SENAI Cuiabá
INSERT INTO academico.cursos (id, unidade_id, codigo, nome, modalidade, nivel, carga_horaria)
VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'TDS-2026', 'Técnico em Desenvolvimento de Sistemas', 'presencial', 'tecnico', 1200),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ELETRO-2026', 'Técnico em Eletrotécnica', 'presencial', 'tecnico', 1200),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'MEC-2026', 'Técnico em Mecatrônica', 'presencial', 'tecnico', 1400)
ON CONFLICT (unidade_id, codigo) DO NOTHING;

-- Cursos para SENAI Cáceres
INSERT INTO academico.cursos (id, unidade_id, codigo, nome, modalidade, nivel, carga_horaria)
VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'INFO-CAC-2026', 'Técnico em Informática para Internet', 'presencial', 'tecnico', 1000),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'ADM-CAC-2026', 'Técnico em Administração', 'presencial', 'tecnico', 1000)
ON CONFLICT (unidade_id, codigo) DO NOTHING;

-- 2. Ambientes de Aprendizagem (SENAI Cuiabá)
INSERT INTO academico.ambientes (id, unidade_id, nome, tipo, capacidade, bloco, andar, recursos)
VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Laboratório de Informática 01', 'Laboratório', 35, 'Bloco A', '1º Andar', '{"computadores": 35, "projetor": true, "ar_condicionado": true}'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Laboratório de Informática 02', 'Laboratório', 30, 'Bloco A', '1º Andar', '{"computadores": 30, "projetor": true, "ar_condicionado": true}'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Oficina de Robótica e Automação', 'Oficina', 25, 'Bloco B', 'Térreo', '{"bancadas": 12, "kits_robotica": true, "ar_condicionado": true}'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Sala de Aula Teórica 101', 'Sala de Aula', 40, 'Bloco C', '1º Andar', '{"carteiras": 40, "projetor": true, "quadro_digital": true}'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Auditório Principal', 'Auditório', 150, 'Bloco Central', 'Térreo', '{"sistema_som": true, "palco": true, "ar_condicionado": true}')
ON CONFLICT (id) DO NOTHING;

-- Ambientes para SENAI Cáceres
INSERT INTO academico.ambientes (id, unidade_id, nome, tipo, capacidade, bloco, andar, recursos)
VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Lab Info Cáceres 01', 'Laboratório', 30, 'Bloco Único', 'Térreo', '{"computadores": 30, "projetor": true}'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Sala Multiuso 01', 'Sala de Aula', 35, 'Bloco Único', 'Térreo', '{"projetor": true}')
ON CONFLICT (id) DO NOTHING;

-- 3. Docentes (SENAI Cuiabá)
INSERT INTO academico.docentes (id, unidade_id, nome, email, matricula, especialidade, carga_horaria_max)
VALUES
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Prof. Roberto Santos', 'roberto.santos@sira.local', 'DOC-001', 'Engenharia de Software e Banco de Dados', 40),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Profa. Ana Paula Lima', 'ana.lima@sira.local', 'DOC-002', 'Redes e Infraestrutura Cloud', 40),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Prof. Carlos Eduardo', 'carlos.eduardo@sira.local', 'DOC-003', 'Eletroeletrônica e Robótica', 40)
ON CONFLICT (id) DO NOTHING;

-- Docentes (SENAI Cáceres)
INSERT INTO academico.docentes (id, unidade_id, nome, email, matricula, especialidade, carga_horaria_max)
VALUES
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Prof. Marcos Vinicius', 'marcos.vinicius@sira.local', 'DOC-004', 'Desenvolvimento Web e Mobile', 40)
ON CONFLICT (id) DO NOTHING;

-- 4. Turmas
INSERT INTO academico.turmas (id, unidade_id, curso_id, codigo, nome, turno, data_inicio, data_fim, vagas)
VALUES
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'TDS-2026-N1', 'TDS - Módulo 1 (Noturno)', 'Noturno', '2026-02-02', '2026-12-18', 35),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'ELETRO-2026-V1', 'Eletrotécnica - Módulo 1 (Vespertino)', 'Vespertino', '2026-02-02', '2026-12-18', 30)
ON CONFLICT (unidade_id, codigo) DO NOTHING;

-- 5. Feriados Nacionais e Regionais
INSERT INTO planejamento.feriados (id, unidade_id, nome, data, tipo)
VALUES
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f01', NULL, 'Ano Novo', '2026-01-01', 'feriado_nacional'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f02', NULL, 'Carnaval', '2026-02-17', 'ponto_facultativo'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f03', NULL, 'Sexta-feira Santa', '2026-04-03', 'feriado_nacional'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f04', NULL, 'Tiradentes', '2026-04-21', 'feriado_nacional'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f05', NULL, 'Dia do Trabalho', '2026-05-01', 'feriado_nacional'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Aniversário de Cuiabá', '2026-04-08', 'feriado_municipal'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f07', NULL, 'Independência do Brasil', '2026-09-07', 'feriado_nacional'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f08', NULL, 'Nossa Senhora Aparecida', '2026-10-12', 'feriado_nacional'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f09', NULL, 'Finados', '2026-11-02', 'feriado_nacional'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f10', NULL, 'Proclamação da República', '2026-11-15', 'feriado_nacional'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', NULL, 'Natal', '2026-12-25', 'feriado_nacional')
ON CONFLICT (id) DO NOTHING;

-- 6. Agendamento Exemplo
INSERT INTO planejamento.agendamentos (id, unidade_id, turma_id, ambiente_id, docente_id, data_inicio, data_fim, status, observacao)
VALUES
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380101', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', '2026-11-09 19:00:00-04', '2026-11-09 22:30:00-04', 'agendado', 'Aula Inaugural de Algoritmos')
ON CONFLICT (id) DO NOTHING;
