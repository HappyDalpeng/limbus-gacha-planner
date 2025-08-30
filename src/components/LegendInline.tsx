type Props = {
  resourcesLabel: string;
  quantileLabel: string;
  resourceColor: string;
  quantileColor: string;
};

export default function LegendInline({
  resourcesLabel,
  quantileLabel,
  resourceColor,
  quantileColor,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs opacity-80 mb-2">
      <span className="flex items-center gap-2">
        <span
          className="inline-block w-4 border-t-2 border-dashed"
          style={{ borderColor: resourceColor }}
        />
        {resourcesLabel}
      </span>
      <span className="flex items-center gap-2">
        <span
          className="inline-block w-4 border-t-2 border-dashed"
          style={{ borderColor: quantileColor }}
        />
        {quantileLabel}
      </span>
    </div>
  );
}
