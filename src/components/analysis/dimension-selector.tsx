"use client";

interface DimOption {
  key: string;
  label: string;
}

interface DimensionSelectorProps {
  title: string;
  available: DimOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  max?: number;
}

export function DimensionSelector({
  title,
  available,
  selected,
  onChange,
  max,
}: DimensionSelectorProps) {
  function toggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter((s) => s !== key));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, key]);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {available.map((dim) => {
          const isSelected = selected.includes(dim.key);
          const isDisabled = !isSelected && max !== undefined && selected.length >= max;
          return (
            <button
              key={dim.key}
              onClick={() => toggle(dim.key)}
              disabled={isDisabled}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : isDisabled
                    ? "bg-muted text-muted-foreground/50 border-border cursor-not-allowed"
                    : "bg-background text-foreground border-border hover:bg-accent"
              }`}
            >
              {dim.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
