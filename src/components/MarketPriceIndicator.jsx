import { useState } from 'react'
import './MarketPriceIndicator.css'

/**
 * Componente que exibe comparativo de preço com o mercado
 * @param {Object} props
 * @param {Object} props.marketData - Dados de mercado para o serviço
 * @param {boolean} props.isPremium - Se o estabelecimento é premium
 * @param {Function} props.onUpgradeClick - Callback para clique em upgrade
 */
export default function MarketPriceIndicator({ marketData, isPremium, onUpgradeClick }) {
    const [showDetails, setShowDetails] = useState(false)

    // Se não é premium, mostra badge de upgrade
    if (!isPremium) {
        return (
            <button
                className="market-price-locked"
                onClick={onUpgradeClick}
                title="Recurso exclusivo do plano Premium"
            >
                🔒 Premium
            </button>
        )
    }

    // Se não tem dados de mercado (poucas amostras)
    if (!marketData) {
        return (
            <span className="market-price-unavailable" title="Dados insuficientes na região">
                --
            </span>
        )
    }

    // Determinar cor e ícone baseado na posição
    const getPositionStyle = (position) => {
        switch (position) {
            case 'below':
                return { icon: '🟢', className: 'market-position-below', label: 'Abaixo da média' }
            case 'above':
                return { icon: '🔴', className: 'market-position-above', label: 'Acima da média' }
            default:
                return { icon: '🟡', className: 'market-position-average', label: 'Na média' }
        }
    }

    const positionStyle = getPositionStyle(marketData.position)

    return (
        <div className="market-price-indicator">
            <button
                className={`market-price-badge ${positionStyle.className}`}
                onClick={() => setShowDetails(!showDetails)}
                title={positionStyle.label}
            >
                <span className="market-price-icon">{positionStyle.icon}</span>
                <span className="market-price-value">
                    R$ {marketData.averagePrice.toFixed(2)}
                </span>
            </button>

            {showDetails && (
                <div className="market-price-tooltip">
                    <div className="market-tooltip-header">
                        <strong>Análise de Mercado</strong>
                        <button onClick={() => setShowDetails(false)} className="market-tooltip-close">×</button>
                    </div>
                    <div className="market-tooltip-content">
                        <div className="market-tooltip-row">
                            <span>Seu preço:</span>
                            <strong>R$ {marketData.yourPrice.toFixed(2)}</strong>
                        </div>
                        <div className="market-tooltip-row">
                            <span>Média região:</span>
                            <strong>R$ {marketData.averagePrice.toFixed(2)}</strong>
                        </div>
                        <div className="market-tooltip-row">
                            <span>Menor preço:</span>
                            <span>R$ {marketData.minPrice.toFixed(2)}</span>
                        </div>
                        <div className="market-tooltip-row">
                            <span>Maior preço:</span>
                            <span>R$ {marketData.maxPrice.toFixed(2)}</span>
                        </div>
                        <div className="market-tooltip-footer">
                            <small>
                                Baseado em {marketData.sampleCount} estabelecimentos próximos
                            </small>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
