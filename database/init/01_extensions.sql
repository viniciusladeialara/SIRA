-- ==============================================================================
-- SIRA - Sistema Integrado de Recursos Acadêmicos
-- 01_extensions.sql: Habilitação de extensões essenciais do PostgreSQL
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";
