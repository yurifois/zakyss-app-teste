// Termos de Uso e Política de Privacidade.
//
// Mudou o texto de verdade? Atualize CURRENT_TERMS_VERSION em
// server/utils/terms.js — quem aceitou a versão antiga é convidado a aceitar
// de novo no próximo acesso.
//
// PENDENTE: a identificação completa do controlador (nome/razão social e
// documento do titular do Zakys) ainda não foi definida pelo dono do projeto.
// Quando houver, inclua na seção 1 da Política (LGPD, art. 9º, III).

const CONTATO = 'contato@zakys.com.br'

const Item = ({ titulo, children }) => (
    <div>
        <h3 className="font-semibold text-primary mb-1">{titulo}</h3>
        <div className="flex flex-col gap-2">{children}</div>
    </div>
)

export default function Terms() {
    return (
        <div className="container py-12" style={{ maxWidth: '760px' }}>
            <h1 className="text-3xl font-bold mb-2">Termos de Uso e Política de Privacidade</h1>
            <p className="text-secondary mb-8">Última atualização: novembro de 2026</p>

            <section id="termos-de-uso" className="mb-10">
                <h2 className="text-2xl font-bold mb-4">Termos de Uso</h2>
                <div className="flex flex-col gap-4 text-secondary">
                    <p>
                        Ao criar uma conta no Zakys, como cliente ou como estabelecimento/profissional,
                        você concorda com estes Termos de Uso. Se não concordar, não utilize a plataforma.
                    </p>
                    <Item titulo="1. O que é o Zakys">
                        <p>
                            O Zakys é uma plataforma de agendamento online que conecta clientes a estabelecimentos
                            e profissionais de beleza e estética. Não prestamos os serviços agendados: a relação de
                            prestação de serviço é entre o cliente e o estabelecimento.
                        </p>
                    </Item>
                    <Item titulo="2. Cadastro">
                        <p>
                            Você é responsável por manter seus dados corretos e atualizados e pelo sigilo da sua senha.
                            Para usar o Zakys é preciso ter 18 anos ou mais; menores só podem usar com um responsável legal.
                        </p>
                    </Item>
                    <Item titulo="3. Agendamentos">
                        <p>
                            Ao agendar, você se compromete a comparecer no horário ou a cancelar com antecedência razoável.
                            Faltas podem gerar restrição temporária de novos agendamentos pela plataforma.
                        </p>
                    </Item>
                    <Item titulo="4. Estabelecimentos">
                        <p>
                            O estabelecimento é responsável pelos serviços, preços, horários e pelas informações que
                            registra sobre seus clientes (anotações, fichas de anamnese, pacotes). Deve usá-las apenas
                            para o atendimento e respeitar a Lei Geral de Proteção de Dados (LGPD).
                        </p>
                        <p>
                            Se conectar o WhatsApp do salão ao Zakys (por QR code), o estabelecimento autoriza a
                            plataforma a enviar, pelo número dele, os avisos de agendamento. Essa conexão não é um
                            serviço oficial do WhatsApp; o estabelecimento a usa por sua conta e deve respeitar as regras
                            do WhatsApp, sem mensagens em massa.
                        </p>
                    </Item>
                    <Item titulo="5. Conduta">
                        <p>
                            É proibido usar a plataforma para fins ilícitos, publicar conteúdo ofensivo em avaliações
                            ou tentar acessar dados de outras pessoas sem autorização.
                        </p>
                    </Item>
                    <Item titulo="6. Alterações">
                        <p>
                            Podemos atualizar estes termos. Mudanças relevantes pedem um novo aceite no seu próximo acesso.
                        </p>
                    </Item>
                </div>
            </section>

            <section id="politica-de-privacidade">
                <h2 className="text-2xl font-bold mb-4">Política de Privacidade</h2>
                <div className="flex flex-col gap-4 text-secondary">
                    <p>
                        Esta política explica quais dados pessoais o Zakys trata, para quê, com quem compartilha e
                        como você exerce seus direitos, conforme a Lei nº 13.709/2018 (LGPD).
                    </p>

                    <Item titulo="1. Quem é o responsável e como falar conosco">
                        <p>
                            O Zakys é o controlador dos dados tratados para o funcionamento da plataforma. Para qualquer
                            assunto de privacidade, inclusive pedidos sobre seus dados, o canal é{' '}
                            <a href={`mailto:${CONTATO}`} className="text-primary">{CONTATO}</a>.
                        </p>
                        <p>
                            Os estabelecimentos são responsáveis (controladores) pelas informações que registram sobre os
                            próprios clientes no painel — anotações, fichas de anamnese e pacotes. Nesses casos o Zakys
                            fornece a ferramenta e trata os dados em nome do estabelecimento.
                        </p>
                    </Item>

                    <Item titulo="2. Dados que tratamos">
                        <ul className="list-disc pl-5 flex flex-col gap-1">
                            <li><strong>Cadastro:</strong> nome, e-mail, telefone, senha (guardada criptografada) e, se você informar, endereço e foto.</li>
                            <li><strong>Agendamentos:</strong> estabelecimento, serviços, data, horário, valores, status, observações e avaliações que você fizer.</li>
                            <li><strong>Ficha de anamnese:</strong> respostas sobre saúde (ex.: alergias, gestação) quando o serviço exige. É um <strong>dado sensível</strong> e só é coletado com sua autorização específica, marcada no momento do agendamento.</li>
                            <li><strong>Localização:</strong> só se você permitir no aparelho, para mostrar estabelecimentos próximos. Usamos no momento da busca e não guardamos.</li>
                            <li><strong>Estabelecimentos:</strong> dados do negócio e do responsável pela conta (nome, documento, contato, endereço).</li>
                            <li><strong>Registros técnicos:</strong> registros de acesso ao servidor (como endereço IP e data/hora), por segurança.</li>
                            <li><strong>No seu aparelho:</strong> guardamos no navegador apenas o necessário para funcionar (sessão de login, último e-mail usado, preferências). Não usamos cookies de publicidade.</li>
                        </ul>
                    </Item>

                    <Item titulo="3. Para que usamos e com qual base legal">
                        <ul className="list-disc pl-5 flex flex-col gap-1">
                            <li>Criar sua conta, agendar e enviar avisos do agendamento por e-mail e pelo WhatsApp do estabelecimento (confirmação, lembrete, cancelamento) — <em>execução de contrato</em> (art. 7º, V).</li>
                            <li>Ficha de anamnese — <em>consentimento específico e destacado</em> (art. 11, I).</li>
                            <li>Localização para "perto de você" — <em>consentimento</em>, dado pela permissão do aparelho (art. 7º, I).</li>
                            <li>Segurança, prevenção a fraude e registros de acesso — <em>legítimo interesse</em> (art. 7º, IX).</li>
                            <li>Defesa em processos, se necessário — <em>exercício regular de direitos</em> (art. 7º, VI).</li>
                        </ul>
                    </Item>

                    <Item titulo="4. Com quem compartilhamos">
                        <p>
                            <strong>Com o estabelecimento que você escolher:</strong> seus dados de contato, o agendamento e,
                            se você autorizar, a ficha de anamnese. Não vendemos dados pessoais.
                        </p>
                        <p>
                            <strong>Com fornecedores que operam a plataforma</strong>, só no necessário: Supabase (banco de dados),
                            Render (servidor), Vercel (site), Resend (envio de e-mails), Google (mapas) e WhatsApp/Meta, quando o
                            estabelecimento conecta o WhatsApp dele para mandar os avisos do agendamento (nesse caso a mensagem sai
                            do número do estabelecimento para o seu). O Zakys não lê nem guarda as conversas. Alguns guardam dados
                            fora do Brasil, principalmente nos Estados Unidos; essa transferência ocorre com as garantias
                            contratuais desses fornecedores (LGPD, art. 33).
                        </p>
                        <p>Também podemos compartilhar dados quando a lei ou uma autoridade exigir.</p>
                    </Item>

                    <Item titulo="5. Por quanto tempo guardamos">
                        <p>
                            Enquanto sua conta estiver ativa. Ao excluir a conta, apagamos seus dados de cadastro, as fichas de
                            anamnese e as anotações dos estabelecimentos sobre você; os atendimentos já realizados ficam no
                            histórico do estabelecimento <strong>sem seu nome e contato</strong>, porque fazem parte do
                            financeiro dele. Registros técnicos de acesso ficam por tempo limitado, só para segurança.
                        </p>
                    </Item>

                    <Item titulo="6. Seus direitos">
                        <p>Você pode, a qualquer momento:</p>
                        <ul className="list-disc pl-5 flex flex-col gap-1">
                            <li>confirmar se tratamos seus dados e acessá-los;</li>
                            <li>corrigir dados incompletos ou errados (pelo seu perfil);</li>
                            <li>pedir anonimização, bloqueio ou eliminação de dados desnecessários;</li>
                            <li>pedir a portabilidade dos seus dados;</li>
                            <li><strong>excluir sua conta</strong> pelo app, em Perfil › Segurança;</li>
                            <li>saber com quem compartilhamos seus dados;</li>
                            <li>revogar um consentimento (por exemplo, o da ficha de anamnese);</li>
                            <li>reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
                        </ul>
                        <p>
                            Para os pedidos que não são feitos direto no app, escreva para{' '}
                            <a href={`mailto:${CONTATO}`} className="text-primary">{CONTATO}</a>. Respondemos em até 15 dias.
                        </p>
                    </Item>

                    <Item titulo="7. Segurança">
                        <p>
                            Senhas criptografadas, conexão segura (HTTPS), confirmação de e-mail no cadastro, limite de
                            tentativas de login e acesso restrito: cada estabelecimento vê apenas os próprios clientes.
                            Se ocorrer um incidente de segurança que possa trazer risco a você, avisaremos você e a ANPD.
                        </p>
                    </Item>

                    <Item titulo="8. Mudanças nesta política">
                        <p>
                            Se esta política mudar de forma relevante, você será avisado e precisará aceitar a nova versão no
                            próximo acesso.
                        </p>
                    </Item>
                </div>
            </section>
        </div>
    )
}
