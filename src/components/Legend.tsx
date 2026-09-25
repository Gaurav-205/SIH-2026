export default function Legend({ title, items }: { title: string; items: { color: string; label: string }[] }) {
  return (
    <div className="text-xs text-muted">
      <p className="mb-2 font-medium text-fg">{title}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: it.color }} aria-hidden="true" />{it.label}</li>
        ))}
      </ul>
    </div>
  );
}
