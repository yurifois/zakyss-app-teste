import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Componente que faz scroll para o topo da página
 * em cada navegação entre rotas.
 */
export default function ScrollToTop() {
    const { pathname } = useLocation()

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [pathname])

    return null
}
