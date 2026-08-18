export default function MockMark({ children = "演示数据" }: { children?: string }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-gold-line bg-surface px-2 py-0.5 text-[11px] tracking-wide text-yi">
      {children}
    </span>
  );
}
