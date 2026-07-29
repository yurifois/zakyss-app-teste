# Instruções de projeto — Zakys

## ⚠️ Envio de email — NÃO trocar para SMTP direto em produção

O backend de produção roda no **Render**, que **bloqueia conexões SMTP de saída**.
Enviar email direto por `nodemailer.createTransport(...).sendMail(...)` a partir do
Render trava ou falha silenciosamente — não é bug de código, é bloqueio de rede do
provedor.

Por isso, todo envio de email do backend passa por **um único ponto**:
`server/utils/sendEmail.js`, função `sendEmail(to, subject, html)`. Ela já decide
sozinha o caminho certo:
- em produção (`NODE_ENV=production`), envia via gateway serverless da **Vercel**
  (`api/send-email.js`), que não tem esse bloqueio, com fallback pra SMTP direto
  se o gateway estiver fora do ar;
- em desenvolvimento local, envia direto por SMTP (funciona normalmente, o
  bloqueio é específico do Render).

**Nunca** crie um novo `nodemailer.createTransport` em outro arquivo do backend
nem troque uma chamada a `sendEmail(...)` por envio direto "pra simplificar".
Isso já quebrou os emails de confirmação, lembrete, novo agendamento e
reativação — recurso essencial do app — mais de uma vez pelo mesmo motivo.
Se precisar mexer no envio de email, edite `server/utils/sendEmail.js`.

## Efeitos colaterais do servidor local

`npm run dev` no diretório `server/` aponta pro Supabase de **produção** (as
credenciais no `.env` local são as mesmas de produção) e dispara o agendador de
notificações real ao subir — ou seja, pode enviar emails reais pra clientes
reais e gravar dados reais. Não é um sandbox seguro. Evite subir o servidor
local sem necessidade real de testar uma rota, e nunca pra testes triviais.
