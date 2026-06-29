import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SearchHit } from "../../shared/types.ts";

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setHits([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setHits(data.hits ?? []);
          setOpen(true);
        }
      } catch {
        // ignore fetch errors
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleBlur() {
    // Delay close so click on hit fires first
    setTimeout(() => setOpen(false), 150);
  }

  function handleHitClick(hit: SearchHit) {
    navigate(`/doc/${hit.path}`);
    setOpen(false);
    setQuery("");
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="Search docs..."
        aria-label="Search"
        style={{
          padding: "8px 12px",
          borderRadius: 6,
          border: "1px solid var(--mantine-color-default-border)",
          background: "var(--mantine-color-body)",
          color: "var(--mantine-color-text)",
          fontSize: 14,
          width: "min(440px, 42vw)",
        }}
      />
      {open && query.trim() && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            width: "min(640px, 92vw)",
            background: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: 8,
            boxShadow: "var(--mantine-shadow-md)",
            zIndex: 1000,
            maxHeight: "min(70vh, 540px)",
            overflowY: "auto",
          }}
        >
          {loading && (
            <div style={{ padding: "12px 16px", color: "var(--mantine-color-dimmed)" }}>
              Searching…
            </div>
          )}
          {!loading && hits.length === 0 && (
            <div style={{ padding: "12px 16px", color: "var(--mantine-color-dimmed)" }}>
              No matches for &ldquo;{query}&rdquo;
            </div>
          )}
          {!loading &&
            hits.map((hit) => (
              <button
                key={hit.path}
                type="button"
                data-hit="true"
                onClick={() => handleHitClick(hit)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  color: "var(--mantine-color-text)",
                  padding: "10px 16px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--mantine-color-default-border)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 15 }}>{hit.title}</div>
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--mantine-color-dimmed)",
                    marginTop: 4,
                  }}
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: snippet contains safe <mark> tags from FTS5
                  dangerouslySetInnerHTML={{ __html: hit.snippet }}
                />
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
