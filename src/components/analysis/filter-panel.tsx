"use client";

import { useState } from "react";

interface FilterPanelProps {
  dataset: string;
  dimensions: string[];
  dimensionLabels: Record<string, string>;
  filters: Record<string, string[]>;
  onChange: (filters: Record<string, string[]>) => void;
}

export function FilterPanel({
  dataset,
  dimensions,
  dimensionLabels,
  filters,
  onChange,
}: FilterPanelProps) {
  const [valuesCache, setValuesCache] = useState<Record<string, { value: string; cnt: number }[]>>({});
  const [loadingDim, setLoadingDim] = useState<string | null>(null);
  const [openDim, setOpenDim] = useState<string | null>(null);

  async function loadValues(dim: string) {
    if (valuesCache[`${dataset}:${dim}`]) return;
    setLoadingDim(dim);
    try {
      const res = await fetch(`/api/analysis/values?dataset=${dataset}&dimension=${dim}`);
      const json = await res.json();
      setValuesCache((prev) => ({ ...prev, [`${dataset}:${dim}`]: json.data }));
    } finally {
      setLoadingDim(null);
    }
  }

  function toggleFilter(dim: string, value: string) {
    const current = filters[dim] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [dim]: next });
  }

  function clearFilter(dim: string) {
    const next = { ...filters };
    delete next[dim];
    onChange(next);
  }

  if (dimensions.length === 0) {
    return <p className="text-xs text-muted-foreground">차원을 선택하면 필터를 설정할 수 있습니다.</p>;
  }

  return (
    <div className="space-y-2">
      {dimensions.map((dim) => {
        const cacheKey = `${dataset}:${dim}`;
        const values = valuesCache[cacheKey];
        const isOpen = openDim === dim;
        const activeCount = (filters[dim] ?? []).length;

        return (
          <div key={dim} className="border rounded-md">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50"
              onClick={() => {
                if (!isOpen) loadValues(dim);
                setOpenDim(isOpen ? null : dim);
              }}
            >
              <span>
                {dimensionLabels[dim] ?? dim}
                {activeCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] bg-primary text-primary-foreground rounded-full">
                    {activeCount}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <div className="px-3 pb-2 max-h-48 overflow-y-auto">
                {loadingDim === dim ? (
                  <p className="text-xs text-muted-foreground">로딩 중...</p>
                ) : values ? (
                  <>
                    {activeCount > 0 && (
                      <button
                        onClick={() => clearFilter(dim)}
                        className="text-[10px] text-destructive hover:underline mb-1"
                      >
                        필터 초기화
                      </button>
                    )}
                    <div className="space-y-0.5">
                      {values.map((v) => {
                        const val = String(v.value);
                        const isChecked = (filters[dim] ?? []).includes(val);
                        return (
                          <label
                            key={val}
                            className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleFilter(dim, val)}
                              className="rounded"
                            />
                            <span className="flex-1 truncate">{val}</span>
                            <span className="text-muted-foreground">{v.cnt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
