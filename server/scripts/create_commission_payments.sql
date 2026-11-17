-- ===========================================================
-- Pagamentos de comissão (relatório de funcionários)
-- ===========================================================
--
-- Onde rodar: Supabase > SQL Editor > New query > cola tudo > Run.
-- Pode rodar quantas vezes quiser: tudo é IF NOT EXISTS / idempotente.
--
-- Por quê: o botão "Marcar como pago" do relatório de comissões grava nesta
-- tabela, mas ela nunca foi criada em produção — o Supabase responde 404 e o
-- botão falha. O relatório também não consegue mostrar o que já foi pago.
--
-- Não mexe em nenhuma tabela existente nem em dado nenhum: só cria esta.
-- Para desfazer: DROP TABLE commission_payments;


-- -----------------------------------------------------------
-- PARTE 1 — tabela (campos exatamente os que employees.routes.js usa)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS commission_payments (
    id BIGSERIAL PRIMARY KEY,
    "establishmentId" BIGINT NOT NULL,
    "employeeId" BIGINT NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    amount DOUBLE PRECISION DEFAULT 0,
    "paymentMethod" TEXT DEFAULT '',
    note TEXT DEFAULT '',
    "paidAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- -----------------------------------------------------------
-- PARTE 2 — extras, à prova de erro (se falharem, a tabela fica de pé)
-- -----------------------------------------------------------

-- Um pagamento por funcionário por mês. O código já procura antes de gravar;
-- isto só impede duplicata se dois cliques chegarem juntos.
DO $$
BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS commission_payments_unico_mes_idx
        ON commission_payments ("establishmentId", "employeeId", year, month);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Índice não criado (segue o jogo): %', SQLERRM;
END $$;

-- RLS no mesmo padrão das outras tabelas. O backend usa a service role, que
-- ignora RLS; isto só fecha o acesso anônimo direto (valor pago é privado).
DO $$
BEGIN
    ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RLS não alterada (provavelmente já está ligada): %', SQLERRM;
END $$;
