# Termos de Uso, Privacidade e Segurança - Zakys App

Este documento estabelece as diretrizes para o uso do aplicativo Zakys, garantindo a transparência sobre como os dados são tratados e quais são os compromissos de segurança.

---

## 1. Termos de Uso

Ao utilizar o Zakys, o usuário concorda em:
- **Finalidade:** Utilizar o app exclusivamente para agendamento de serviços de beleza e bem-estar.
- **Veracidade:** Fornecer informações reais e atualizadas no cadastro (nome, telefone, email).
- **Conduta:** Não utilizar a plataforma para fins fraudulentos ou para assediar estabelecimentos parceiros.
- **Cancelamentos:** Respeitar as políticas de cancelamento individuais de cada estabelecimento.

---

## 2. Política de Privacidade (LGPD)

O Zakys está em conformidade com a Lei Geral de Proteção de Dados (LGPD).

### Dados Coletados:
- **Identificação:** Nome completo, email, telefone.
- **Uso:** Histórico de agendamentos, estabelecimentos favoritos.
- **Navegação:** Cookies e dados de sessão para manter o login ativo.

### Como usamos seus dados:
- Para processar e confirmar seus agendamentos.
- Para enviar notificações sobre seus horários (via email/push).
- **Não compartilhamos** seus dados pessoais com terceiros para fins de marketing sem consentimento explícito.

---

## 3. Segurança da Informação

A segurança do Zakys é construída sobre três pilares:

- **Criptografia:** Todas as senhas são armazenadas utilizando hashes `bcrypt`, impedindo que sejam lidas mesmo em caso de acesso indevido ao banco de dados.
- **Proteção de Sessão:** Utilizamos JSON Web Tokens (JWT) para autenticação, garantindo que apenas o dono da conta acesse seus próprios dados.
- **Integridade:** O acesso às áreas administrativas (donos de salão) é protegido por permissões de nível de conta (`Admin Access Control`).

### Recomendações ao Usuário:
- Utilize uma senha forte e única.
- Não compartilhe seu token de acesso.
- Encerre a sessão (Logout) ao utilizar dispositivos públicos.

---

## 4. Contato e Suporte

Para dúvidas sobre seus dados ou solicitações de exclusão de conta, entre em contato via:
- **Email:** suporte@zakys.com.br
- **Encarregado de Dados:** dpo@zakys.com.br
