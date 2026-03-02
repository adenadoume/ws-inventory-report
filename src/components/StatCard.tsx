interface StatCardProps {
  value: string
  label: string
  color?: 'blue' | 'red' | 'green' | 'amber' | 'purple' | 'teal' | 'violet' | 'orange'
}

export default function StatCard({ value, label, color = 'blue' }: StatCardProps) {
  return (
    <div className={`card ${color}`}>
      <div className="val">{value}</div>
      <div className="lbl">{label}</div>
    </div>
  )
}
