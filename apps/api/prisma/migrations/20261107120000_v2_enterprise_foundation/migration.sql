-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "workflow";

-- AlterTable
ALTER TABLE "academico"."ambientes" ADD COLUMN IF NOT EXISTS "excluido_em" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "excluido_por" UUID;

-- AlterTable
ALTER TABLE "academico"."cursos" ADD COLUMN IF NOT EXISTS "excluido_em" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "excluido_por" UUID;

-- AlterTable
ALTER TABLE "academico"."docentes" ADD COLUMN IF NOT EXISTS "excluido_em" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "excluido_por" UUID;

-- AlterTable
ALTER TABLE "academico"."turmas" ADD COLUMN IF NOT EXISTS "excluido_em" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "excluido_por" UUID;

-- AlterTable
ALTER TABLE "core"."usuarios" ADD COLUMN IF NOT EXISTS "excluido_em" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "excluido_por" UUID;

-- CreateTable
CREATE TABLE IF NOT EXISTS "core"."seed_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "versao" VARCHAR(50) NOT NULL,
    "descricao" VARCHAR(255) NOT NULL,
    "executado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executado_por" VARCHAR(100) NOT NULL DEFAULT 'sistema',

    CONSTRAINT "seed_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "core"."feature_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(100) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "ambiente" VARCHAR(50) NOT NULL DEFAULT 'all',
    "descricao" TEXT,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workflow"."fluxos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(50) NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fluxos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workflow"."etapas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fluxo_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "perfil_aprovador" VARCHAR(50) NOT NULL,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workflow"."solicitacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fluxo_id" UUID NOT NULL,
    "unidade_id" UUID,
    "solicitante_id" UUID NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pendente',
    "dados_jsonb" JSONB NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workflow"."aprovacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitacao_id" UUID NOT NULL,
    "etapa_id" UUID NOT NULL,
    "aprovador_id" UUID NOT NULL,
    "decisao" VARCHAR(50) NOT NULL,
    "parecer" TEXT,
    "decidido_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aprovacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workflow"."assinaturas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitacao_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "hash_assinatura" VARCHAR(255) NOT NULL,
    "assinado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workflow"."historicos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitacao_id" UUID NOT NULL,
    "de_status" VARCHAR(50) NOT NULL,
    "para_status" VARCHAR(50) NOT NULL,
    "usuario_id" UUID,
    "motivo" TEXT,
    "registrado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workflow"."eventos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" VARCHAR(100) NOT NULL,
    "entidade" VARCHAR(100) NOT NULL,
    "entidade_id" VARCHAR(255) NOT NULL,
    "payload_jsonb" JSONB NOT NULL,
    "usuario_id" UUID,
    "unidade_id" UUID,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "seed_history_versao_key" ON "core"."seed_history"("versao");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_seed_history_versao" ON "core"."seed_history"("versao");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "feature_flags_nome_key" ON "core"."feature_flags"("nome");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_feature_flags_nome" ON "core"."feature_flags"("nome");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "fluxos_codigo_key" ON "workflow"."fluxos"("codigo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_solicitacoes_status" ON "workflow"."solicitacoes"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_solicitacoes_solicitante" ON "workflow"."solicitacoes"("solicitante_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_eventos_entidade" ON "workflow"."eventos"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_eventos_tipo" ON "workflow"."eventos"("tipo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_eventos_criado_em" ON "workflow"."eventos"("criado_em" DESC);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "workflow"."etapas" ADD CONSTRAINT "etapas_fluxo_id_fkey" FOREIGN KEY ("fluxo_id") REFERENCES "workflow"."fluxos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "workflow"."solicitacoes" ADD CONSTRAINT "solicitacoes_fluxo_id_fkey" FOREIGN KEY ("fluxo_id") REFERENCES "workflow"."fluxos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "workflow"."aprovacoes" ADD CONSTRAINT "aprovacoes_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "workflow"."solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "workflow"."aprovacoes" ADD CONSTRAINT "aprovacoes_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "workflow"."etapas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "workflow"."assinaturas" ADD CONSTRAINT "assinaturas_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "workflow"."solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "workflow"."historicos" ADD CONSTRAINT "historicos_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "workflow"."solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
