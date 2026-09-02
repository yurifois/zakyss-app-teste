# Instruções de projeto — Zakys

## ⚠️ Envio de email — Resend, NÃO SMTP/Gmail

Todo envio de email do backend passa por **um único ponto**:
`server/utils/sendEmail.js`, função `sendEmail(to, subject, html)` — que chama a
API HTTPS do **Resend** (`https://api.resend.com/emails`), usando `RESEND_API_KEY`
e `RESEND_FROM_EMAIL` (variáveis de ambiente no Render).

**Nunca** volte a usar `nodemailer`/SMTP/Gmail pra enviar email neste projeto, nem
crie um gateway serverless na Vercel pra contornar bloqueio de rede. Dois motivos,
os dois já causaram outage real em produção:
1. O Render bloqueia conexão SMTP de saída — enviar direto por SMTP a partir do
   Render trava ou falha silenciosamente.
2. Contas Gmail comuns têm teto de **500 envios/dia**. A Zakys estourou esse
   teto em produção assim que o uso cresceu, o que derrubou **todo** email do
   sistema (confirmação, lembrete, recuperação de senha) até o limite resetar
   no dia seguinte — não é hipotético, já aconteceu (ago/2026).

Resend fala HTTPS puro, não tem esse bloqueio nem esse teto (no plano free já são
3.000 emails/mês), e funciona igual em produção e em desenvolvimento — não tem
mais bifurcação de ambiente nem gateway pra manter.

Se precisar mexer no envio de email, edite só `server/utils/sendEmail.js`. Nunca
crie um `nodemailer.createTransport` novo em outro arquivo do backend.

## Efeitos colaterais do servidor local

`npm run dev` no diretório `server/` aponta pro Supabase de **produção** (as
credenciais no `.env` local são as mesmas de produção) e dispara o agendador de
notificações real ao subir — ou seja, pode enviar emails reais pra clientes
reais e gravar dados reais. Não é um sandbox seguro. Evite subir o servidor
local sem necessidade real de testar uma rota, e nunca pra testes triviais.
