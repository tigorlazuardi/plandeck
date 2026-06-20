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
          padding: "4px 8px",
          borderRadius: 4,
          border: "1px solid #ccc",
          width: 200,
        }}
      />
      {open && query.trim() && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid #ccc",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {loading && <div style={{ padding: "8px 12px", color: "#888" }}>Searching…</div>}
          {!loading && hits.length === 0 && (
            <div style={{ padding: "8px 12px", color: "#888" }}>
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
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{hit.title}</div>
                <div
                  style={{ fontSize: 12, color: "#555", marginTop: 2 }}
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
