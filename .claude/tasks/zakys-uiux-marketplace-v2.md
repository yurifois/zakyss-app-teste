# Zakys — tarefa de UI/UX para Claude Code

## Escopo

Revisar e melhorar o marketplace público e o painel administrativo do Zakys, preservando a identidade mística/galáctica, mas priorizando clareza, acessibilidade, responsividade e conversão para agendamento.

## Regras

1. Trabalhar somente em branch separada.
2. Não fazer deploy nem alterar produção.
3. Inspecionar componentes, rotas, APIs, modelos e testes antes de editar.
4. Não remover funcionalidades existentes.
5. Não inventar preço, avaliação, distância ou disponibilidade.
6. Implementar em commits pequenos e testáveis.
7. Parar e pedir aprovação se houver risco para dados, agenda, autenticação ou financeiro.

## Fase 0 — segurança e confiabilidade

- Corrigir a configuração do Google Maps por ambiente e restringir a chave aos domínios autorizados.
- Quando a geolocalização falhar ou for negada, não presumir uma cidade silenciosamente; explicar o estado e oferecer cidade/CEP.
- Remover da interface qualquer credencial, conta ou instrução de teste.
- Remover contatos fictícios da interface pública.
- Mover a exclusão permanente da conta para Configurações > Segurança.
- Exigir reautenticação, confirmação textual e confirmação final antes de excluir.
- Revisar autorização e mascaramento de dados pessoais conforme o perfil de acesso.

## Fase 1 — marketplace público

### Busca

- Estruturar a jornada como serviço/profissional, localização, data/horário e resultados.
- Permitir busca por serviço, categoria, profissional e estabelecimento.
- Adicionar autocomplete com debounce, teclado e leitores de tela.
- Manter cidade/CEP como alternativa ao GPS.
- Implementar estados de carregamento, vazio, erro, localização negada e sem conexão.

### Cards de resultado

- Criar componente reutilizável para início e busca.
- Padronizar proporção e enquadramento das imagens; usar logo apenas como fallback.
- Exibir nome, avaliação real ou `Novo · sem avaliações`, até duas categorias e `+N`, localização/distância, preço inicial real e próxima disponibilidade real.
- Incluir `Ver perfil` e `Agendar`, deixando `Agendar` como ação primária.
- Reduzir o peso visual do favorito e fornecer rótulo acessível.
- Nunca exibir nota máxima quando não houver avaliações.

### Filtros

- Manter serviço, distância, domiciliar, acessível, estacionamento, avaliação e preço.
- Adicionar ordenação por proximidade, avaliação, preço e disponibilidade.
- Exibir filtros ativos como chips removíveis e oferecer `Limpar filtros`.
- Usar painel lateral no desktop e drawer/modal no mobile.

### Perfil e agendamento

- Priorizar fotos, nome, avaliação, localização, serviços, preços e disponibilidade.
- Avaliar permitir escolher o serviço antes da data ou mostrar o próximo horário por serviço.
- Manter indicador de etapas com texto/ícone, sem depender apenas de cor.
- Exibir duração, profissional e política de cancelamento antes da confirmação.
- Preservar dados preenchidos quando ocorrer erro.
- Testar concorrência e impedir duplo agendamento.

## Fase 2 — painel administrativo

### Arquitetura da informação

Agrupar o menu em:

- Agenda: Dashboard, Agendamentos, Calendário e Horários.
- Clientes e atendimento: Clientes, Anamnese e Pacotes.
- Catálogo: Serviços, Produtos, Imagens e Links.
- Equipe: Funcionários, Comissões e Relatório.
- Financeiro: Fluxo de Caixa, Analytics e Relatório Financeiro.
- Configurações: Dados do estabelecimento e Segurança.

### Melhorias operacionais

- Substituir carregamentos genéricos por skeleton e estados recuperáveis.
- Separar pendências e atalhos operacionais no dashboard.
- Adicionar busca, filtros ativos, limpar filtros e paginação em agendamentos e clientes.
- Criar legenda clara no calendário para fechado, bloqueado, lotado, disponível e com agendamentos.
- Mascarar dados pessoais nas listagens conforme as permissões.
- Adaptar tabelas para cards no mobile.
- Substituir ícones sem texto por botões com tooltip e `aria-label`.
- Exigir confirmação antes de remoções e informar dependências históricas.
- Se o custo de produto estiver ausente, mostrar `Custo não informado`, sem calcular margem enganosa.
- Separar formulários longos em modal, drawer ou seções expansíveis.
- Padronizar moeda no formato brasileiro.
- Reconciliar as definições de faturamento entre Dashboard, Fluxo de Caixa, Relatório e Analytics.

### Funcionários e permissões

- Implementar perfis: Proprietário, Administrador, Recepção, Profissional e Financeiro.
- Aplicar menor privilégio por rota e endpoint.
- Registrar autor, data, ação e antes/depois no histórico de alterações.
- Vincular serviços, agenda, comissão e notificações por funcionário.

## Design system e acessibilidade

- Criar tokens de cor, tipografia, espaçamento, raio, sombra e movimento.
- Usar a estética galáctica em áreas de marca; usar superfícies mais calmas em busca, resultados, formulários e painel.
- Reservar dourado para avaliação ou indicador premium.
- Garantir contraste WCAG AA, foco visível, teclado, alvos de toque de 44×44 px, zoom de 200%, largura de 320 px e `prefers-reduced-motion`.
- Não usar emoji como único ícone funcional.
- Evitar links que envolvam botões internos, como o favorito.

## Testes obrigatórios

- Unitários para formatação, regras de card, filtros e permissões.
- Integração para busca, disponibilidade, agendamento e financeiro.
- E2E para busca, agendamento, conflito, cancelamento, bloqueio de agenda, autenticação e perfis de acesso.
- Responsividade em 320, 375, 768, 1024 e 1440 px.
- Acessibilidade com teclado, leitor de tela, foco, contraste e zoom.
- Build e lint sem erros antes do pull request.

## Sequência sugerida

1. Segurança e exposições de produção.
2. Maps e fallback de localização.
3. Tokens e base de acessibilidade.
4. Busca e cards de resultado.
5. Perfil e agendamento.
6. Navegação e dashboard administrativo.
7. Formulários e ações destrutivas.
8. Perfis de acesso.
9. Consistência financeira e moeda brasileira.
10. Testes E2E e regressão.

## Instrução de execução

Leia esta tarefa inteira e inspecione o repositório antes de editar. Primeiro apresente um relatório relacionando cada item às rotas, componentes, APIs, modelos e testes existentes, classificando-o como existente, parcial ou ausente. Depois implemente apenas a Fase 0 e a fundação da Fase 1, em commits pequenos. Não faça deploy. Ao final, informe arquivos alterados, migrações, variáveis de ambiente, testes executados, resultados e pendências de homologação. Se houver risco para dados, agenda, autenticação ou financeiro, pare e peça aprovação.
