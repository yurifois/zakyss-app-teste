import { Clock, Check } from 'lucide-react'

export default function ServiceCard({ service, selected, onToggle, showPrice = true }) {
    return (
        <div
            className={`service-item ${selected ? 'selected' : ''}`}
            onClick={() => onToggle && onToggle(service)}
            style={{ cursor: onToggle ? 'pointer' : 'default' }}
        >
            <div className="service-info">
                <div className="service-name">{service.name}</div>
                <div className="service-duration flex items-center gap-1">
                    <Clock size={14} />
                    {service.duration} min
                </div>
            </div>
            {showPrice && (
                <div className="service-price">
                    R$ {service.price.toFixed(2)}
                </div>
            )}
            {onToggle && (
                <div style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '0.375rem',
                    border: selected ? 'none' : '2px solid var(--border-color)',
                    background: selected ? 'var(--gradient-primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.875rem',
                    marginLeft: '1rem',
                }}>
                    {selected && <Check size={16} />}
                </div>
            )}
        </div>
    )
}
