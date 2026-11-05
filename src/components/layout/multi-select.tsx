"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

interface Option {
  value: string;
  label: string;
  count: number;
}

interface MultiSelectProps {
  label: string;
  /** /api/filters/options 의 kind */
  kind: "customer" | "productType" | "packUnit";
  selected: string[];
  onApply: (values: string[]) => void;
  searchable?: boolean;
}

const MAX_VISIBLE = 150;

/** 검색 가능한 다중 선택. 선택지는 처음 열 때 API에서 불러온다 */
export function MultiSelect({ label, kind, selected, onApply, searchable = true }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [draft, setDraft] = useState<string[]>(selected);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function loadOptions() {
    if (options) return;
    try {
      const res = await fetch(`/api/filters/options?kind=${kind}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setOptions(json.data as Option[]);
    } catch {
      setError("선택지를 불러오지 못했습니다.");
    }
  }

  function toggleOpen() {
    if (!open) {
      setDraft(selected);
      setKeyword("");
      void loadOptions();
    }
    setOpen(!open);
  }

  function toggle(value: string) {
    setDraft((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  const kw = keyword.trim().toLowerCase();
  const filtered = (options ?? []).filter((o) => !kw || o.label.toLowerCase().includes(kw));
  const visible = filtered.slice(0, MAX_VISIBLE);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 text-sm md:w-auto md:min-w-32 ${
          selected.length > 0 ? "border-brand-navy-mid font-medium text-brand-navy-dark" : "border-input text-foreground"
        }`}
      >
        <span className="truncate">
          {label}
          {selected.length > 0 && <span className="ml-1 text-brand-navy">({selected.length}개 선택)</span>}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute left-0 z-30 mt-1 w-full min-w-64 rounded-lg border border-border bg-white p-2 shadow-lg md:w-80"
        >
          {searchable && (
            <label className="mb-2 flex h-9 items-center gap-2 rounded-md border border-input px-2">
              <Search className="size-4 text-muted-foreground" aria-hidden />
              <span className="sr-only">{label} 검색</span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={`${label} 검색`}
                className="h-full w-full bg-transparent text-sm outline-none"
                autoFocus
              />
            </label>
          )}

          <ul role="listbox" aria-multiselectable="true" aria-label={label} className="max-h-60 overflow-y-auto">
            {error && <li className="px-2 py-3 text-sm text-status-danger">{error}</li>}
            {!error && !options && <li className="px-2 py-3 text-sm text-muted-foreground">불러오는 중…</li>}
            {options && visible.length === 0 && (
              <li className="px-2 py-3 text-sm text-muted-foreground">일치하는 항목이 없습니다.</li>
            )}
            {visible.map((o) => {
              const checked = draft.includes(o.value);
              return (
                <li key={o.value} role="option" aria-selected={checked}>
                  <button
                    type="button"
                    onClick={() => toggle(o.value)}
                    className="flex min-h-9 w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                        checked ? "border-brand-navy bg-brand-navy text-white" : "border-input bg-white"
                      }`}
                      aria-hidden
                    >
                      {checked && <Check className="size-3" />}
                    </span>
                    <span className="flex-1 truncate" title={o.label}>
                      {o.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{o.count.toLocaleString("ko-KR")}건</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {filtered.length > MAX_VISIBLE && (
            <p className="px-2 pt-1 text-xs text-muted-foreground">
              상위 {MAX_VISIBLE}개만 표시됩니다. 검색어로 좁혀 보세요.
            </p>
          )}

          <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
            <button
              type="button"
              onClick={() => setDraft([])}
              className="h-8 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted"
            >
              선택 해제
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
              className="h-8 rounded-md bg-brand-navy px-3 text-sm font-medium text-white hover:bg-brand-navy-dark"
            >
              적용{draft.length > 0 ? ` (${draft.length})` : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
