export default function TimeSlots({ slots, selectedTime, onSelectTime, bookedTimes = [] }) {
    return (
        <div className="time-slots">
            {slots.map(time => {
                const isBooked = bookedTimes.includes(time)
                const isSelected = selectedTime === time

                return (
                    <button
                        key={time}
                        type="button"
                        className={`time-slot ${isSelected ? 'selected' : ''} ${isBooked ? 'disabled' : ''}`}
                        onClick={() => !isBooked && onSelectTime(time)}
                        disabled={isBooked}
                    >
                        {time}
                    </button>
                )
            })}
        </div>
    )
}

// Helper function to generate time slots (horas redondas)
export function generateTimeSlots(openTime, closeTime, intervalMinutes = 60) {
    const slots = []
    const [openHour, openMin] = openTime.split(':').map(Number)
    const [closeHour, closeMin] = closeTime.split(':').map(Number)

    let currentHour = openMin > 0 ? openHour + 1 : openHour

    while (
        currentHour < closeHour ||
        (currentHour === closeHour && closeMin > 0)
    ) {
        const timeStr = `${String(currentHour).padStart(2, '0')}:00`
        slots.push(timeStr)
        currentHour += 1
    }

    return slots
}
