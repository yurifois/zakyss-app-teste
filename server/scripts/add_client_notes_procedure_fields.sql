-- ===========================================================
-- Anotações de procedimento na ficha do cliente
-- ===========================================================
--
-- Onde rodar: Supabase > SQL Editor > New query > cola tudo > Run.
-- Pode rodar quantas vezes quiser: tudo é IF NOT EXISTS / idempotente.
--
-- O que faz:
--   PARTE 1 - cria a tabela client_notes se ela não existir (banco novo).
--   PARTE 2 - adiciona as 3 colunas do procedimento (banco que já tem a tabela).
--   PARTE 3 - índice, RLS e sequência de id. Tudo opcional e à prova de erro.
--
-- Sem a PARTE 2 o sistema NÃO quebra: a anotação continua salvando, só perde
-- o vínculo com o atendimento que a originou.


-- -----------------------------------------------------------
-- PARTE 1 — tabela (só tem efeito em banco novo)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_notes (
    id BIGSERIAL PRIMARY KEY,
    "establishmentId" BIGINT,
    "clientKey" TEXT,
    "clientName" TEXT,
    flags JSONB DEFAULT '[]',
    note TEXT DEFAULT '',
    "createdByName" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- -----------------------------------------------------------
-- PARTE 2 — as 3 colunas do procedimento (esta é a que importa)
-- -----------------------------------------------------------
ALTER TABLE client_notes ADD COLUMN IF NOT EXISTS "appointmentId"   BIGINT;
ALTER TABLE client_notes ADD COLUMN IF NOT EXISTS "serviceName"     TEXT DEFAULT '';
ALTER TABLE client_notes ADD COLUMN IF NOT EXISTS "appointmentDate" TEXT DEFAULT '';


-- -----------------------------------------------------------
-- PARTE 3 — extras. Envolvidos em bloco à prova de erro pra que,
-- se algo aqui falhar, as colunas da PARTE 2 não sejam desfeitas.
-- -----------------------------------------------------------

-- Busca por cliente é a consulta quente da tela
DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS client_notes_lookup_idx
        ON client_notes ("establishmentId", "clientKey");
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Índice não criado (segue o jogo): %', SQLERRM;
END $$;

-- RLS no mesmo padrão das outras tabelas. O backend acessa com a service
-- role, que ignora RLS — isso aqui só fecha a porta pro acesso anônimo
-- direto, que é o desejado: anotação é privada do estabelecimento.
DO $$
BEGIN
    ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RLS não alterada (provavelmente já está ligada): %', SQLERRM;
END $$;

-- Sequência de id: só necessária em banco novo ou com sequência
-- dessincronizada. Se a coluna id for IDENTITY, este passo falharia —
-- por isso o EXCEPTION, pra não derrubar o resto do script.
DO $$
DECLARE
  max_id BIGINT;
BEGIN
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM client_notes;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS client_notes_id_seq START WITH %s', max_id + 1);
  EXECUTE 'ALTER TABLE client_notes ALTER COLUMN id SET DEFAULT nextval(''client_notes_id_seq'')';
  PERFORM setval('client_notes_id_seq', GREATEST(max_id, 1));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Sequência não ajustada (a tabela já gera id sozinha): %', SQLERRM;
END $$;


-- -----------------------------------------------------------
-- CONFERÊNCIA — deve listar as 3 colunas novas
-- -----------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'client_notes'
  AND column_name IN ('appointmentId', 'serviceName', 'appointmentDate')
ORDER BY column_name;
