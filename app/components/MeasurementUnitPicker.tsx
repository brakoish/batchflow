'use client'

const WEIGHT_UNITS = ['g', 'kg', 'oz', 'lb'] as const

export default function MeasurementUnitPicker({
  value,
  onChange,
  label = 'Weight unit',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
}) {
  const isWeightUnit = WEIGHT_UNITS.includes(value as (typeof WEIGHT_UNITS)[number])
  const isCustom = !isWeightUnit

  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="grid grid-cols-5 gap-1 rounded-xl bg-muted p-1" role="group" aria-label={label}>
        {WEIGHT_UNITS.map((unit) => (
          <button
            key={unit}
            type="button"
            aria-pressed={value === unit}
            onClick={() => onChange(unit)}
            className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${value === unit ? 'border border-amber-500 bg-card text-amber-700 shadow-sm dark:text-amber-300' : 'text-muted-foreground'}`}
          >
            {unit}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={isCustom}
          onClick={() => { if (!isCustom) onChange('custom') }}
          className={`min-h-[44px] rounded-lg px-1 text-xs font-semibold transition-colors ${isCustom ? 'border border-amber-500 bg-card text-amber-700 shadow-sm dark:text-amber-300' : 'text-muted-foreground'}`}
        >
          Other
        </button>
      </div>
      {isCustom && (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value.slice(0, 30))}
          placeholder="Custom unit, e.g. °F"
          className="mt-2 min-h-[48px] w-full rounded-xl border border-input bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">Workers enter one decimal measurement in this unit.</p>
    </div>
  )
}
