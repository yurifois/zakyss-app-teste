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

// Helper function to generate time slots
export function generateTimeSlots(openTime, closeTime, intervalMinutes = 30) {
    const slots = []
    const [openHour, openMin] = openTime.split(':').map(Number)
    const [closeHour, closeMin] = closeTime.split(':').map(Number)

    let currentHour = openHour
    let currentMin = openMin

    while (
        currentHour < closeHour ||
        (currentHour === closeHour && currentMin < closeMin)
    ) {
        const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`
        slots.push(timeStr)

        currentMin += intervalMinutes
        if (currentMin >= 60) {
            currentHour += Math.floor(currentMin / 60)
            currentMin = currentMin % 60
        }
    }

    return slots
}
