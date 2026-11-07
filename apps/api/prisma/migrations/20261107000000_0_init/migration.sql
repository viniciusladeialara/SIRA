-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "academico";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auditoria";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "planejamento";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "producao";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "relatorios";

-- CreateTable
CREATE TABLE "auditoria"."logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "usuario_email" VARCHAR(255),
    "unidade_id" UUID,
    "schema_name" VARCHAR(100) NOT NULL DEFAULT 'public',
    "tabela" VARCHAR(100) NOT NULL DEFAULT 'unknown',
    "registro_id" VARCHAR(255),
    "acao" VARCHAR(50) NOT NULL,
    "data_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" VARCHAR(45),
    "user_agent" TEXT,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."configuracoes_globais" (
    "chave" VARCHAR(100) NOT NULL,
    "valor" JSONB NOT NULL,
    "descricao" TEXT,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracoes_globais_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "core"."perfil_permissoes" (
    "perfil_id" UUID NOT NULL,
    "permissao_id" UUID NOT NULL,
    "atribuido_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfil_permissoes_pkey" PRIMARY KEY ("perfil_id","permissao_id")
);

-- CreateTable
CREATE TABLE "core"."perfis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(50) NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."permissoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modulo" VARCHAR(50) NOT NULL,
    "acao" VARCHAR(50) NOT NULL,
    "chave" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."unidades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(50),
    "nome" VARCHAR(255) NOT NULL,
    "sigla" VARCHAR(50),
    "cidade" VARCHAR(100),
    "estado" VARCHAR(2) DEFAULT 'MT',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."usuario_perfis" (
    "usuario_id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "atribuido_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_perfis_pkey" PRIMARY KEY ("usuario_id","perfil_id")
);

-- CreateTable
CREATE TABLE "core"."usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "unidade_id" UUID,
    "nome" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academico"."ambientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "unidade_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "tipo" VARCHAR(50) NOT NULL DEFAULT 'Sala de Aula',
    "capacidade" INTEGER NOT NULL DEFAULT 30,
    "bloco" VARCHAR(50) DEFAULT 'Bloco A',
    "andar" VARCHAR(50) DEFAULT 'TÃ©rreo',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "recursos" JSONB DEFAULT '{}',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academico"."cursos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "unidade_id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "modalidade" VARCHAR(50) DEFAULT 'presencial',
    "nivel" VARCHAR(50) DEFAULT 'tecnico',
    "carga_horaria" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academico"."docentes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "unidade_id" UUID NOT NULL,
    "usuario_id" UUID,
    "nome" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "matricula" VARCHAR(50),
    "telefone" VARCHAR(50),
    "especialidade" VARCHAR(255),
    "carga_horaria_max" INTEGER NOT NULL DEFAULT 40,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "docentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academico"."turmas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "unidade_id" UUID NOT NULL,
    "curso_id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "turno" VARCHAR(50) NOT NULL DEFAULT 'Noturno',
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "vagas" INTEGER NOT NULL DEFAULT 30,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planejamento"."agendamentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "unidade_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "ambiente_id" UUID NOT NULL,
    "docente_id" UUID NOT NULL,
    "data_inicio" TIMESTAMPTZ(6) NOT NULL,
    "data_fim" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'agendado',
    "observacao" TEXT,
    "criado_por" UUID,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planejamento"."feriados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "unidade_id" UUID,
    "nome" VARCHAR(255) NOT NULL,
    "data" DATE NOT NULL,
    "tipo" VARCHAR(50) NOT NULL DEFAULT 'feriado',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feriados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planejamento"."substituicoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "unidade_id" UUID NOT NULL,
    "agendamento_id" UUID NOT NULL,
    "docente_original_id" UUID NOT NULL,
    "docente_substituto_id" UUID NOT NULL,
    "motivo" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pendente',
    "solicitado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avaliado_em" TIMESTAMPTZ(6),
    "avaliado_por" UUID,

    CONSTRAINT "substituicoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_auditoria_acao" ON "auditoria"."logs"("acao");

-- CreateIndex
CREATE INDEX "idx_auditoria_data_hora" ON "auditoria"."logs"("data_hora" DESC);

-- CreateIndex
CREATE INDEX "idx_auditoria_tabela" ON "auditoria"."logs"("tabela");

-- CreateIndex
CREATE INDEX "idx_auditoria_unidade_id" ON "auditoria"."logs"("unidade_id");

-- CreateIndex
CREATE INDEX "idx_auditoria_usuario_id" ON "auditoria"."logs"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "perfis_slug_key" ON "core"."perfis"("slug");

-- CreateIndex
CREATE INDEX "idx_perfis_slug" ON "core"."perfis"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "permissoes_chave_key" ON "core"."permissoes"("chave");

-- CreateIndex
CREATE INDEX "idx_permissoes_chave" ON "core"."permissoes"("chave");

-- CreateIndex
CREATE INDEX "idx_permissoes_modulo" ON "core"."permissoes"("modulo");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_codigo_key" ON "core"."unidades"("codigo");

-- CreateIndex
CREATE INDEX "idx_unidades_ativo" ON "core"."unidades"("ativo");

-- CreateIndex
CREATE INDEX "idx_unidades_cidade" ON "core"."unidades"("cidade");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "core"."usuarios"("email");

-- CreateIndex
CREATE INDEX "idx_usuarios_ativo" ON "core"."usuarios"("ativo");

-- CreateIndex
CREATE INDEX "idx_usuarios_email" ON "core"."usuarios"("email");

-- CreateIndex
CREATE INDEX "idx_usuarios_unidade" ON "core"."usuarios"("unidade_id");

-- CreateIndex
CREATE INDEX "idx_ambientes_ativo" ON "academico"."ambientes"("ativo");

-- CreateIndex
CREATE INDEX "idx_ambientes_bloco" ON "academico"."ambientes"("bloco");

-- CreateIndex
CREATE INDEX "idx_ambientes_unidade" ON "academico"."ambientes"("unidade_id");

-- CreateIndex
CREATE INDEX "idx_cursos_ativo" ON "academico"."cursos"("ativo");

-- CreateIndex
CREATE INDEX "idx_cursos_unidade" ON "academico"."cursos"("unidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cursos_unidade_codigo" ON "academico"."cursos"("unidade_id", "codigo");

-- CreateIndex
CREATE INDEX "idx_docentes_ativo" ON "academico"."docentes"("ativo");

-- CreateIndex
CREATE INDEX "idx_docentes_email" ON "academico"."docentes"("email");

-- CreateIndex
CREATE INDEX "idx_docentes_unidade" ON "academico"."docentes"("unidade_id");

-- CreateIndex
CREATE INDEX "idx_turmas_ativo" ON "academico"."turmas"("ativo");

-- CreateIndex
CREATE INDEX "idx_turmas_curso" ON "academico"."turmas"("curso_id");

-- CreateIndex
CREATE INDEX "idx_turmas_unidade" ON "academico"."turmas"("unidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_turmas_unidade_codigo" ON "academico"."turmas"("unidade_id", "codigo");

-- CreateIndex
CREATE INDEX "idx_agendamentos_ambiente" ON "planejamento"."agendamentos"("ambiente_id", "data_inicio", "data_fim");

-- CreateIndex
CREATE INDEX "idx_agendamentos_docente" ON "planejamento"."agendamentos"("docente_id", "data_inicio", "data_fim");

-- CreateIndex
CREATE INDEX "idx_agendamentos_turma" ON "planejamento"."agendamentos"("turma_id");

-- CreateIndex
CREATE INDEX "idx_agendamentos_unidade_intervalo" ON "planejamento"."agendamentos"("unidade_id", "data_inicio", "data_fim");

-- CreateIndex
CREATE INDEX "idx_feriados_data" ON "planejamento"."feriados"("data");

-- CreateIndex
CREATE INDEX "idx_feriados_unidade" ON "planejamento"."feriados"("unidade_id");

-- CreateIndex
CREATE INDEX "idx_substituicoes_agendamento" ON "planejamento"."substituicoes"("agendamento_id");

-- CreateIndex
CREATE INDEX "idx_substituicoes_unidade" ON "planejamento"."substituicoes"("unidade_id");

-- AddForeignKey
ALTER TABLE "core"."perfil_permissoes" ADD CONSTRAINT "perfil_permissoes_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "core"."perfis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."perfil_permissoes" ADD CONSTRAINT "perfil_permissoes_permissao_id_fkey" FOREIGN KEY ("permissao_id") REFERENCES "core"."permissoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."usuario_perfis" ADD CONSTRAINT "usuario_perfis_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "core"."perfis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."usuario_perfis" ADD CONSTRAINT "usuario_perfis_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "core"."usuarios" ADD CONSTRAINT "usuarios_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "core"."unidades"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "academico"."ambientes" ADD CONSTRAINT "ambientes_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "core"."unidades"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "academico"."cursos" ADD CONSTRAINT "cursos_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "core"."unidades"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "academico"."docentes" ADD CONSTRAINT "docentes_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "core"."unidades"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "academico"."docentes" ADD CONSTRAINT "docentes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "core"."usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "academico"."turmas" ADD CONSTRAINT "turmas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "academico"."cursos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "academico"."turmas" ADD CONSTRAINT "turmas_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "core"."unidades"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planejamento"."agendamentos" ADD CONSTRAINT "agendamentos_ambiente_id_fkey" FOREIGN KEY ("ambiente_id") REFERENCES "academico"."ambientes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planejamento"."agendamentos" ADD CONSTRAINT "agendamentos_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "core"."usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planejamento"."agendamentos" ADD CONSTRAINT "agendamentos_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "academico"."docentes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planejamento"."agendamentos" ADD CONSTRAINT "agendamentos_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "academico"."turmas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planejamento"."agendamentos" ADD CONSTRAINT "agendamentos_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "core"."unidades"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planejamento"."feriados" ADD CONSTRAINT "feriados_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "core"."unidades"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planejamento"."substituicoes" ADD CONSTRAINT "substituicoes_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "planejamento"."agendamentos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planejamento"."substituicoes" ADD CONSTRAINT "substituicoes_avaliado_por_fkey" FOREIGN KEY ("avaliado_por") REFERENCES "core"."usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planejamento"."substituicoes" ADD CONSTRAINT "substituicoes_docente_original_id_fkey" FOREIGN KEY ("docente_original_id") REFERENCES "academico"."docentes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planejamento"."substituicoes" ADD CONSTRAINT "substituicoes_docente_substituto_id_fkey" FOREIGN KEY ("docente_substituto_id") REFERENCES "academico"."docentes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planejamento"."substituicoes" ADD CONSTRAINT "substituicoes_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "core"."unidades"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
