/**
 * Aviso sobre e-mails caindo no spam. Domínio de envio novo ainda não tem
 * reputação estabelecida, então confirmação/lembrete às vezes vai pra lixo
 * eletrônico — pedir "não é spam" ensina o filtro e resolve pros próximos.
 *
 * ponytail: componente só pra não duplicar o texto em duas telas; some
 * quando a reputação do domínio estabilizar.
 */
export default function SpamNotice({ className = '' }) {
    return (
        <div
            className={`text-sm ${className}`}
            style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.75rem',
                background: 'rgba(236, 72, 153, 0.08)',
                border: '1px solid var(--primary-500)'
            }}
        >
            <strong>📬 Não recebeu nosso e-mail?</strong>
            <p className="mt-1">
                Confira a caixa de <strong>spam</strong> ou <strong>lixo eletrônico</strong>. Se encontrar
                a confirmação lá, clique em <strong>"Não é spam"</strong> — assim os próximos e-mails
                chegam direto na sua caixa de entrada.
            </p>
        </div>
    )
}
