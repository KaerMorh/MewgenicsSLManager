import React, { useState, useRef, useEffect, useMemo } from "react";

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  borderColor?: string;
  showClear?: boolean;
  onClear?: () => void;
}

const SearchableSelect: React.FC<Props> = ({
  value,
  options,
  placeholder = "Search...",
  onChange,
  borderColor = "#e2e8f0",
  showClear,
  onClear,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.group || "").toLowerCase().includes(q)
    );
  }, [options, query]);

  // Group options for display
  const grouped = useMemo(() => {
    const map = new Map<string, SelectOption[]>();
    for (const o of filtered) {
      const g = o.group || "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    return map;
  }, [filtered]);

  const displayLabel = useMemo(() => {
    if (!value) return "";
    const found = options.find((o) => o.value === value);
    return found ? found.label : value;
  }, [value, options]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "100%",
          padding: "4px 6px",
          fontSize: 12,
          fontWeight: 800,
          border: `2px solid ${borderColor}`,
          borderRadius: 6,
          cursor: "pointer",
          background: "#fff",
          minHeight: 26,
          fontFamily: "inherit",
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: value ? "#1e293b" : "#94a3b8",
          }}
        >
          {displayLabel || placeholder}
        </span>
        {showClear && value && onClear && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            style={{ color: "#ef4444", cursor: "pointer", fontWeight: 900, fontSize: 14, lineHeight: 1 }}
          >
            ×
          </span>
        )}
        <span style={{ color: "#94a3b8", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 100,
            background: "#fff",
            border: "2px solid #1e293b",
            borderRadius: 8,
            boxShadow: "4px 4px 0 #1e293b",
            marginTop: 2,
            maxHeight: 240,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            style={{
              padding: "6px 8px",
              fontSize: 12,
              fontWeight: 800,
              border: "none",
              borderBottom: "2px solid #e2e8f0",
              outline: "none",
              fontFamily: "inherit",
              borderRadius: "6px 6px 0 0",
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 && (
              <div style={{ padding: "8px 10px", color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>
                No results
              </div>
            )}
            {Array.from(grouped.entries()).map(([group, items]) => (
              <div key={group}>
                {group && (
                  <div
                    style={{
                      padding: "4px 8px",
                      fontSize: 10,
                      fontWeight: 900,
                      color: "#94a3b8",
                      background: "#f8fafc",
                      borderBottom: "1px solid #f1f5f9",
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    {group}
                  </div>
                )}
                {items.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    style={{
                      padding: "5px 8px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                      background: opt.value === value ? "#dbeafe" : "transparent",
                      borderBottom: "1px solid #f8fafc",
                    }}
                    onMouseEnter={(e) => {
                      if (opt.value !== value) e.currentTarget.style.background = "#f1f5f9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = opt.value === value ? "#dbeafe" : "transparent";
                    }}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
