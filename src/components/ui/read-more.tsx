"use client";

import { useState } from "react";

export function ReadMore({ text, lines = 3 }: { text: string; lines?: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p
        className="text-sm leading-relaxed whitespace-pre-wrap"
        style={expanded ? undefined : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-1 text-xs font-semibold"
        style={{ color: "var(--trust)" }}
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </div>
  );
}
