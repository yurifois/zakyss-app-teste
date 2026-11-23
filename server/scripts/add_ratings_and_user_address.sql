-- ===========================================================
-- Avaliações dos clientes + endereço do perfil do cliente
-- ===========================================================
--
-- Onde rodar: Supabase > SQL Editor > New query > cola tudo > Run.
-- Pode rodar quantas vezes quiser: só cria o que falta, não apaga nada.
--
-- Por quê: o backend grava appointments.rating/comment/ratedAt (tela
-- "Avaliar" do cliente) e users.address (endereço no perfil), mas essas
-- colunas nunca existiram em produção. O repositório do Supabase descartava
-- os campos em silêncio e respondia 200, então as notas e os endereços se
-- perdiam e todo salão ficava com nota 5 e 0 avaliações.

-- 1. Colunas novas (todas opcionais, sem valor para os registros antigos)
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS rating   smallint,
    ADD COLUMN IF NOT EXISTS comment  text,
    ADD COLUMN IF NOT EXISTS "ratedAt" timestamptz;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS address jsonb;

-- 2. Nota sempre entre 1 e 5 (a rota já valida; isto é a rede de segurança)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'appointments_rating_range' AND conrelid = 'public.appointments'::regclass
    ) THEN
        ALTER TABLE public.appointments
            ADD CONSTRAINT appointments_rating_range CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);
    END IF;
END $$;

-- 3. Nota do salão a partir das avaliações reais (mesma regra de
--    server/utils/ratings.js: média com 1 casa; sem avaliação = 5 e 0).
--    Hoje não há nenhuma avaliação gravada, então isto só confirma 5 / 0.
UPDATE public.establishments e
SET rating        = COALESCE(r.media, 5),
    "reviewCount" = COALESCE(r.total, 0)
FROM (
    SELECT es.id,
           ROUND(AVG(a.rating)::numeric, 1)::double precision AS media,
           COUNT(a.rating)::int                              AS total
    FROM public.establishments es
    LEFT JOIN public.appointments a
           ON a."establishmentId" = es.id AND a.rating BETWEEN 1 AND 5
    GROUP BY es.id
) r
WHERE r.id = e.id
  AND (e.rating IS DISTINCT FROM COALESCE(r.media, 5)
       OR e."reviewCount" IS DISTINCT FROM COALESCE(r.total, 0));

-- 4. Faz a API do Supabase enxergar as colunas novas na hora
NOTIFY pgrst, 'reload schema';

-- 5. Conferência: deve listar as 4 colunas
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'appointments' AND column_name IN ('rating', 'comment', 'ratedAt'))
    OR (table_name = 'users' AND column_name = 'address'))
ORDER BY table_name, column_name;
