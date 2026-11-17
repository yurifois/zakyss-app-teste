import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import * as api from '../../services/api'

// Duas situações na mesma tela:
//  - ?token=...  -> a pessoa clicou no link do e-mail: confirma e já entra.
//  - ?email=...  -> acabou de se cadastrar: avisa para conferir a caixa de
//                   entrada e oferece reenviar o link.
// Conta nova só entra depois de confirmar: é o que impede alguém de criar
// conta usando o e-mail de outra pessoa.
export default function VerifyEmail() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')
    const email = searchParams.get('email') || ''
    const parceiro = searchParams.get('tipo') === 'parceiro'

    const navigate = useNavigate()
    const { completeEmailVerification } = useAuth()
    const { success, error } = useToast()

    const [status, setStatus] = useState(token ? 'verificando' : 'aguardando')
    const [mensagemErro, setMensagemErro] = useState('')
    const [reenviando, setReenviando] = useState(false)
    const jaTentou = useRef(false)

    useEffect(() => {
        if (!token || jaTentou.current) return
        jaTentou.current = true
        completeEmailVerification(token)
            .then((result) => {
                success('E-mail confirmado! Você já está conectado.')
                if (result.kind === 'admin') {
                    navigate('/admin')
                    return
                }
                const redirectUrl = sessionStorage.getItem('redirect_after_login')
                sessionStorage.removeItem('redirect_after_login')
                navigate(redirectUrl || '/')
            })
            .catch((err) => {
                setMensagemErro(err.message || 'Não foi possível confirmar o e-mail.')
                setStatus('erro')
            })
    }, [token])

    const reenviar = async () => {
        if (!email) return
        setReenviando(true)
        try {
            await api.resendVerification(email)
            success('Se houver uma conta aguardando confirmação, enviamos um novo link.')
        } catch (err) {
            error(err.message || 'Não foi possível reenviar agora.')
        } finally {
            setReenviando(false)
        }
    }

    return (
        <div className="py-16">
            <div className="container" style={{ maxWidth: '450px' }}>
                <div className="card text-center" style={{ padding: '2rem' }}>
                    {status === 'verificando' && (
                        <>
                            <h1 className="text-2xl font-bold mb-2">Confirmando seu e-mail…</h1>
                            <p className="text-secondary">Só um instante.</p>
                        </>
                    )}

                    {status === 'aguardando' && (
                        <>
                            <div style={{ fontSize: '2.5rem' }} aria-hidden="true">📬</div>
                            <h1 className="text-2xl font-bold mb-2">Confirme seu e-mail</h1>
                            <p className="text-secondary mb-4">
                                Enviamos um link para {email ? <strong>{email}</strong> : 'o seu e-mail'}.
                                Abra a mensagem e toque em <strong>Confirmar meu e-mail</strong> para
                                {parceiro ? ' acessar o painel do seu estabelecimento.' : ' entrar na sua conta.'}
                            </p>
                            <p className="text-muted text-sm mb-6">
                                Não chegou? Confira a caixa de spam ou promoções. O link vale por 7 dias.
                            </p>
                            {email && (
                                <button className="btn btn-outline w-full mb-3" onClick={reenviar} disabled={reenviando}>
                                    {reenviando ? 'Reenviando…' : 'Reenviar o link'}
                                </button>
                            )}
                            <Link to={parceiro ? '/admin/login' : '/entrar'} className="text-sm" style={{ color: 'var(--accent-400)' }}>
                                Já confirmei — ir para o login
                            </Link>
                        </>
                    )}

                    {status === 'erro' && (
                        <>
                            <h1 className="text-2xl font-bold mb-2">Link inválido ou expirado</h1>
                            <p className="text-secondary mb-6">{mensagemErro}</p>
                            <Link to="/entrar" className="btn btn-primary w-full mb-3">Ir para o login</Link>
                            <p className="text-muted text-sm">
                                Na tela de login, ao tentar entrar, aparece a opção de receber um novo link.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
