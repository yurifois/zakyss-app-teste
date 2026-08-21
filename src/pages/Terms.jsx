export default function Terms() {
    return (
        <div className="container py-12" style={{ maxWidth: '760px' }}>
            <h1 className="text-3xl font-bold mb-2">Termos de Uso e Política de Privacidade</h1>
            <p className="text-secondary mb-8">Última atualização: agosto de 2026</p>

            <section id="termos-de-uso" className="mb-10">
                <h2 className="text-2xl font-bold mb-4">Termos de Uso</h2>
                <div className="flex flex-col gap-4 text-secondary">
                    <p>
                        Ao criar uma conta na Zakys, seja como cliente ou como profissional/estabelecimento,
                        você concorda com estes Termos de Uso. Se não concordar, não utilize a plataforma.
                    </p>
                    <p>
                        <strong>1. O que é a Zakys.</strong> A Zakys é uma plataforma de agendamento online que
                        conecta clientes a estabelecimentos e profissionais de beleza e estética. Não somos
                        prestadores dos serviços agendados — a relação de prestação de serviço é entre cliente
                        e estabelecimento.
                    </p>
                    <p>
                        <strong>2. Cadastro.</strong> Você é responsável por manter seus dados de cadastro
                        corretos e atualizados, e pela confidencialidade da sua senha.
                    </p>
                    <p>
                        <strong>3. Agendamentos.</strong> Ao agendar um serviço, você se compromete a comparecer
                        no horário marcado ou a cancelar/remarcar com antecedência razoável. Faltas recorrentes
                        podem gerar restrições temporárias de novos agendamentos.
                    </p>
                    <p>
                        <strong>4. Conduta.</strong> É proibido usar a plataforma para fins ilícitos, enviar
                        conteúdo ofensivo em avaliações ou tentar acessar dados de outros usuários sem autorização.
                    </p>
                    <p>
                        <strong>5. Alterações.</strong> Podemos atualizar estes termos periodicamente. Mudanças
                        relevantes exigem novo aceite no próximo acesso.
                    </p>
                </div>
            </section>

            <section id="politica-de-privacidade">
                <h2 className="text-2xl font-bold mb-4">Política de Privacidade</h2>
                <div className="flex flex-col gap-4 text-secondary">
                    <p>
                        <strong>1. Dados coletados.</strong> Coletamos nome, e-mail, telefone e, quando aplicável,
                        endereço e dados do estabelecimento. Também registramos o histórico de agendamentos
                        para viabilizar o funcionamento da plataforma.
                    </p>
                    <p>
                        <strong>2. Finalidade.</strong> Usamos esses dados para permitir o agendamento, enviar
                        notificações sobre seus agendamentos (confirmação, lembrete, cancelamento) e melhorar
                        a plataforma.
                    </p>
                    <p>
                        <strong>3. Compartilhamento.</strong> Dados de contato do cliente são compartilhados
                        apenas com o estabelecimento escolhido, na medida necessária pra realizar o atendimento
                        agendado. Não vendemos dados pessoais a terceiros.
                    </p>
                    <p>
                        <strong>4. Retenção.</strong> Mantemos seus dados enquanto sua conta estiver ativa.
                        Você pode solicitar a exclusão da sua conta e dos dados associados a qualquer momento.
                    </p>
                    <p>
                        <strong>5. Seus direitos (LGPD).</strong> Você pode solicitar acesso, correção ou
                        exclusão dos seus dados pessoais entrando em contato pelo e-mail{' '}
                        <a href="mailto:contato@zakys.com.br">contato@zakys.com.br</a>.
                    </p>
                </div>
            </section>
        </div>
    )
}
