import { useState } from 'react'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export default function Calendar({ selectedDate, onSelectDate, disabledDays = [], minDate = new Date() }) {
    const [currentMonth, setCurrentMonth] = useState(new Date())

    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const startingDayOfWeek = firstDayOfMonth.getDay()
    const totalDays = lastDayOfMonth.getDate()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const prevMonth = () => {
        setCurrentMonth(new Date(year, month - 1, 1))
    }

    const nextMonth = () => {
        setCurrentMonth(new Date(year, month + 1, 1))
    }

    const isDisabled = (day) => {
        const date = new Date(year, month, day)
        date.setHours(0, 0, 0, 0)

        // Check if before min date
        if (date < minDate) return true

        // Check if in disabled days (0 = Sunday, 6 = Saturday)
        const dayOfWeek = date.getDay()
        if (disabledDays.includes(dayOfWeek)) return true

        return false
    }

    const isSelected = (day) => {
        if (!selectedDate) return false
        const date = new Date(year, month, day)
        return (
            date.getDate() === selectedDate.getDate() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getFullYear() === selectedDate.getFullYear()
        )
    }

    const isToday = (day) => {
        const date = new Date(year, month, day)
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        )
    }

    const handleDayClick = (day) => {
        if (isDisabled(day)) return
        const date = new Date(year, month, day)
        onSelectDate(date)
    }

    const days = []

    // Empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(<div key={`empty-${i}`} className="calendar-day disabled"></div>)
    }

    // Days of the month
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day)
        date.setHours(0, 0, 0, 0)

        const isPast = date < minDate
        const dayOfWeek = date.getDay()
        const isClosed = disabledDays.includes(dayOfWeek)
        const disabled = isPast || isClosed
        const selected = isSelected(day)
        const todayClass = isToday(day)

        days.push(
            <div
                key={day}
                className={`calendar-day ${disabled ? 'disabled' : ''} ${selected ? 'selected' : ''} ${todayClass ? 'today' : ''} ${isClosed && !isPast ? 'closed' : ''}`}
                onClick={() => handleDayClick(day)}
                title={isClosed ? 'Estabelecimento fechado' : ''}
            >
                {day}
            </div>
        )
    }

    return (
        <div className="calendar">
            <div className="calendar-header">
                <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={prevMonth}
                    disabled={month <= today.getMonth() && year <= today.getFullYear()}
                >
                    ←
                </button>
                <h3 className="calendar-title">
                    {MONTHS[month]} {year}
                </h3>
                <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={nextMonth}
                >
                    →
                </button>
            </div>

            <div className="calendar-grid">
                {DAYS.map(day => (
                    <div key={day} className="calendar-day-header">{day}</div>
                ))}
                {days}
            </div>
        </div>
    )
}
