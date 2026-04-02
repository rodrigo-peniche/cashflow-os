import { Badge } from '@/components/ui/badge'
import { FLOW_COLORS } from '@/lib/constants'

type FlowType = 'ingreso_real' | 'ingreso_estimado' | 'egreso_real' | 'egreso_estimado'

const labels: Record<FlowType, string> = {
  ingreso_real: 'Ingreso',
  ingreso_estimado: 'Ingreso est.',
  egreso_real: 'Egreso',
  egreso_estimado: 'Egreso est.',
}

export function FlowBadge({ type }: { type: FlowType }) {
  const color = FLOW_COLORS[type]
  const isEstimated = type.includes('estimado')

  return (
    <Badge
      variant="outline"
      className="text-xs font-medium"
      style={{
        backgroundColor: color + '20',
        borderColor: color,
        borderStyle: isEstimated ? 'dashed' : 'solid',
        color: color,
      }}
    >
      {labels[type]}
    </Badge>
  )
}
