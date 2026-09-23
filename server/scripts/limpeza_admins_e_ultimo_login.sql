-- ===========================================================
-- Limpeza de contas órfãs + registro de último login
-- ===========================================================
--
-- Onde rodar: Supabase > SQL Editor > New query > cola tudo > Run.
--
-- PARTE 1 apaga contas de administrador cujo estabelecimento não existe mais.
-- PARTE 2 cria a coluna lastLoginAt, que o backend passa a preencher a cada
--         login bem-sucedido.
--
-- A PARTE 1 é DESTRUTIVA. Ela vem com uma conferência antes e outra depois,
-- e apaga por regra (estabelecimento inexistente), não por lista fixa, então
-- não há risco de errar um número digitado à mão.


-- -----------------------------------------------------------
-- PARTE 1a — CONFIRA ANTES. Rode só este bloco primeiro.
-- Deve listar 6 contas, nos estabelecimentos 1, 2, 17, 18, 19 e 20.
-- Se listar alguma dos estabelecimentos 5, 6, 7 ou 21, PARE: algo mudou.
-- -----------------------------------------------------------
SELECT a.id AS admin_id,
       a."establishmentId" AS estabelecimento_inexistente,
       a."createdAt"
FROM admins a
WHERE NOT EXISTS (
    SELECT 1 FROM establishments e WHERE e.id = a."establishmentId"
)
ORDER BY a.id;


-- -----------------------------------------------------------
-- PARTE 1b — A EXCLUSÃO.
-- Só rode depois de conferir a lista acima.
-- A cláusula é a mesma da conferência, então apaga exatamente aquilo.
-- -----------------------------------------------------------
DELETE FROM admins a
WHERE NOT EXISTS (
    SELECT 1 FROM establishments e WHERE e.id = a."establishmentId"
);


-- -----------------------------------------------------------
-- PARTE 1c — CONFIRA DEPOIS.
-- Deve sobrar 4 contas, uma para cada estabelecimento: 5, 6, 7 e 21.
-- -----------------------------------------------------------
SELECT a.id AS admin_id, a."establishmentId" AS estabelecimento
FROM admins a
ORDER BY a."establishmentId";


-- -----------------------------------------------------------
-- PARTE 2 — coluna de último login.
-- Fica nula até a pessoa entrar pela primeira vez depois do deploy.
-- Sem esta coluna o login continua funcionando: o backend só avisa no
-- console que não conseguiu gravar, e deixa a pessoa entrar.
-- -----------------------------------------------------------
ALTER TABLE admins ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE users  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP WITH TIME ZONE;

-- Consulta pronta para o controle de inatividade, quando você quiser usar:
--
--   SELECT a.id, a."establishmentId", a."lastLoginAt"
--   FROM admins a
--   WHERE a."lastLoginAt" IS NULL
--      OR a."lastLoginAt" < NOW() - INTERVAL '3 months'
--   ORDER BY a."lastLoginAt" NULLS FIRST;
