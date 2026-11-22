export default function StatCard({ icon: Icon, label, value, subtitle, className = '' }) {
  return (
    <div className={`bg-white border border-navy-200 shadow-sm rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-navy-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-semibold text-navy-800 mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-navy-500 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg bg-navy-50">
            <Icon className="w-5 h-5 text-navy-500" />
          </div>
        )}
      </div>
    </div>
  );
}
