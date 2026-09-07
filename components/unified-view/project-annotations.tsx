"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { TagSelector, TagBadges } from "@/components/tag-selector";

// Inline project tags + notes editing — so you can annotate straight from the
// Map or List view without opening the full details drawer.
export function ProjectAnnotations({ projectId }: { projectId: string }) {
  const project = useAppStore((s) => s.projects.find((p) => p.id === projectId));
  const updateProjectTags = useAppStore((s) => s.updateProjectTags);
  const updateProjectNotes = useAppStore((s) => s.updateProjectNotes);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!project) return null;

  function openEditor() {
    setDraft(project?.notes ?? "");
    setEditing(true);
  }
  function save() {
    updateProjectNotes(project!.id, draft.trim());
    setEditing(false);
  }

  return (
    <div style={wrapStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <TagBadges tagIds={project.tags} size="sm" />
        <TagSelector
          projectId={project.id}
          selectedTagIds={project.tags}
          onTagsChange={(ids) => updateProjectTags(project.id, ids)}
          compact
        />
      </div>

      {editing ? (
        <div>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add notes about this project…"
            style={textareaStyle}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <button type="button" onClick={() => setEditing(false)} style={ghostBtnStyle}>Cancel</button>
            <button type="button" onClick={save} style={primaryBtnStyle}>Save</button>
          </div>
        </div>
      ) : project.notes ? (
        <button type="button" onClick={openEditor} style={notePreviewStyle} title="Edit notes">
          {project.notes}
        </button>
      ) : (
        <button type="button" onClick={openEditor} style={addNoteStyle}>+ Add notes</button>
      )}
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 10,
  marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--line)",
};
const textareaStyle: React.CSSProperties = {
  width: "100%", minHeight: 72, resize: "vertical",
  border: "1px solid var(--line-2)", borderRadius: 2, background: "var(--bg)",
  padding: "8px 10px", fontSize: 13, lineHeight: 1.5, color: "var(--ink)",
  fontFamily: "inherit", outline: "none",
};
const notePreviewStyle: React.CSSProperties = {
  textAlign: "left", width: "100%", cursor: "pointer",
  border: "1px solid var(--line)", borderRadius: 2, background: "var(--bg-2)",
  padding: "8px 10px", fontSize: 13, lineHeight: 1.5, color: "var(--ink-mid)",
  fontFamily: "inherit", whiteSpace: "pre-wrap",
};
const addNoteStyle: React.CSSProperties = {
  alignSelf: "flex-start", cursor: "pointer",
  border: "1px dashed var(--line-2)", borderRadius: 2, background: "transparent",
  padding: "5px 10px", fontSize: 12, color: "var(--ink-soft)", fontFamily: "inherit",
};
const ghostBtnStyle: React.CSSProperties = {
  cursor: "pointer", border: "1px solid var(--line)", borderRadius: 2,
  background: "var(--bg-2)", padding: "5px 12px", fontSize: 12, color: "var(--ink-mid)", fontFamily: "inherit",
};
const primaryBtnStyle: React.CSSProperties = {
  cursor: "pointer", border: "1px solid var(--accent)", borderRadius: 2,
  background: "var(--accent)", padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--bg)", fontFamily: "inherit",
};
