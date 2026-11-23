import { Link } from 'react-router-dom'

// Aviso fixo na tela de login quando o problema é algo que a pessoa resolve
// sozinha (e-mail sem conta, senha errada, login do tipo errado). Fica até a
// próxima tentativa, em vez de sumir como o aviso rápido, e já traz o botão
// do próximo passo. O conteúdo vem de loginProblem() em services/authErrors.
export default function LoginProblemNotice({ problem }) {
    if (!problem) return null

    return (
        <div
            className="mb-4 text-sm"
            role="alert"
            style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--warning-500, #f59e0b)',
                background: 'rgba(245, 158, 11, 0.08)'
            }}
        >
            <p className="mb-2">⚠️ {problem.message}</p>
            <div className="flex flex-wrap gap-2">
                {problem.actions.map(a => (
                    <Link key={a.to} to={a.to} className="btn btn-outline btn-sm">
                        {a.label}
                    </Link>
                ))}
            </div>
        </div>
    )
}
