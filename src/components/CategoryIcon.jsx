/**
 * Ícone de categoria por nome, sem carregar a biblioteca inteira.
 *
 * Antes as telas faziam `import * as LucideIcons from 'lucide-react'` e
 * liam `LucideIcons[iconName]`. Isso anula o tree-shaking: o bundle passa
 * a carregar os ~1500 ícones do pacote pra usar meia dúzia. Aqui só os
 * ícones que as categorias realmente usam entram no pacote.
 *
 * ponytail: mapa explícito. Se cadastrarem categoria com ícone novo, é
 * só adicionar aqui — sem ele, cai no Sparkles e nada quebra.
 */
import { Scissors, Sparkles, Palette, Flower2, User, Wind } from 'lucide-react'

const ICONS = { Scissors, Sparkles, Palette, Flower2, User, Wind }

export default function CategoryIcon({ iconName, ...props }) {
    const Icon = ICONS[iconName] || Sparkles
    return <Icon {...props} />
}
