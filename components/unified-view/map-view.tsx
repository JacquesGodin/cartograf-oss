"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ExternalLink,
  FilePenLine,
  Info,
  Maximize2,
  SlidersHorizontal,
  UserRoundCog,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  debugLogThrottled,
  measureDuration,
} from "@/lib/debug-logger";
import { useRenderDiagnostics } from "@/hooks/use-debug-diagnostics";
import { type TechCategory, techCategories } from "@/lib/types";
import { getDashboardUrl } from "@/lib/service-urls";
import { useAppStore } from "@/lib/store";
import {
  categoryDesign, TechGlyph, AccountBadge, CatDot, TechDetail,
  type DisplayTech,
  type TechDetailFocus,
} from "./tech-primitives";
import { ProjectAnnotations } from "./project-annotations";

const SIZE = 660;
const CENTER = SIZE / 2;
const HUB_R = 68;
const RING_R = 252;
const ARC_R = RING_R + 34;
const LABEL_R = ARC_R + 13;
const RADIAL_SVG_PAD = 8;
const RADIAL_SVG_SIZE = SIZE + RADIAL_SVG_PAD * 2;
const RADIAL_SVG_VIEWBOX = `${-RADIAL_SVG_PAD} ${-RADIAL_SVG_PAD} ${RADIAL_SVG_SIZE} ${RADIAL_SVG_SIZE}`;
const PADDING_ANGLE = 0.05;
const NODE_W = 130;
const NODE_H = 46;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const WHEEL_ZOOM_SENSITIVITY = 0.0012;
const WHEEL_ZOOM_MIN_FACTOR = 0.94;
const WHEEL_ZOOM_MAX_FACTOR = 1.06;
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };
const MAP_TILE_SCALE = 0.68;
const MAP_TILE_SIZE = SIZE * MAP_TILE_SCALE;
const MAP_TILE_GAP_X = 96;
const MAP_TILE_GAP_Y = 104;
const FIT_PADDING = 72;
const FOCUSED_PROJECT_ZOOM = 1 / MAP_TILE_SCALE;
const RADIAL_DETAIL_ZOOM = 1.05;
const PROJECT_SUMMARY_SIZE = 260;
const ACTION_MENU_ZONE_R = 156;
const ACTION_MENU_R = 98;
const ACTION_MENU_LABEL_R = 154;
const ACTION_BUTTON_SIZE = 34;
const ACTION_PREVIEW_W = 144;
const FOCUSED_CANVAS_PADDING = ACTION_MENU_ZONE_R + ACTION_BUTTON_SIZE;

interface MapViewport {
  x: number;
  y: number;
  zoom: number;
}

interface MapPosition {
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

interface ProjectDragState extends DragState {
  projectId: string;
  moved: boolean;
}

export interface ProjectMapData {
  id: string;
  name: string;
  githubOwner: string;
  icon?: string;
  techs: DisplayTech[];
}

interface ProjectMapLayout extends ProjectMapData {
  x: number;
  y: number;
  placed: PlacedTech[];
  layout: ArcSegment[];
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const x0 = cx + Math.cos(a0) * r;
  const y0 = cy + Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function clampWheelZoomFactor(factor: number) {
  return Math.min(WHEEL_ZOOM_MAX_FACTOR, Math.max(WHEEL_ZOOM_MIN_FACTOR, factor));
}

function zoomViewport(
  viewport: MapViewport,
  nextZoom: number,
  anchorX: number,
  anchorY: number
) {
  const zoom = clampZoom(nextZoom);
  const worldX = (anchorX - viewport.x) / viewport.zoom;
  const worldY = (anchorY - viewport.y) / viewport.zoom;

  return {
    x: anchorX - worldX * zoom,
    y: anchorY - worldY * zoom,
    zoom,
  };
}

interface PlacedTech {
  tech: DisplayTech;
  cat: TechCategory;
  angle: number;
  x: number;
  y: number;
}

interface ArcSegment {
  cat: TechCategory;
  items: DisplayTech[];
  start: number;
  end: number;
}

type RadialMenuState = {
  techId: string;
  pinned: boolean;
};

type RadialAction = {
  id: string;
  label: string;
  detail: string;
  angle: number;
  icon: React.ReactNode;
  disabled?: boolean;
  onSelect: () => void;
};

type TechDetailFocusState = {
  techId: string;
  target: TechDetailFocus;
  key: number;
};

function computeLayout(techs: DisplayTech[]): { placed: PlacedTech[]; layout: ArcSegment[] } {
  const buckets = new Map<TechCategory, DisplayTech[]>();
  techs.forEach((t) => {
    const arr = buckets.get(t.cat) ?? [];
    arr.push(t);
    buckets.set(t.cat, arr);
  });

  const grouped = techCategories
    .filter((cat) => buckets.has(cat))
    .map((cat) => ({ cat, items: buckets.get(cat)! }));

  const total = techs.length;
  let cursor = -Math.PI / 2 - Math.PI / 12;

  const layout: ArcSegment[] = grouped.map(({ cat, items }) => {
    const span = (Math.PI * 2 - PADDING_ANGLE * grouped.length) * (items.length / total);
    const start = cursor;
    const end = cursor + span;
    cursor = end + PADDING_ANGLE;
    return { cat, items, start, end };
  });

  const placed: PlacedTech[] = layout.flatMap(({ cat, items, start, end }) =>
    items.map((tech, i) => {
      const t = (i + 0.5) / items.length;
      const angle = start + (end - start) * t;
      return {
        tech, cat, angle,
        x: CENTER + Math.cos(angle) * RING_R,
        y: CENTER + Math.sin(angle) * RING_R,
      };
    })
  );

  return { placed, layout };
}

function getProjectColumnCount(projectCount: number) {
  return Math.max(1, Math.ceil(Math.sqrt(projectCount)));
}

function getProjectPosition(index: number, columnCount: number) {
  const column = index % columnCount;
  const row = Math.floor(index / columnCount);

  return {
    x: column * (MAP_TILE_SIZE + MAP_TILE_GAP_X),
    y: row * (MAP_TILE_SIZE + MAP_TILE_GAP_Y),
  };
}

function getWorldBounds(projects: ProjectMapLayout[]) {
  if (projects.length === 0) {
    return { minX: 0, minY: 0, maxX: SIZE, maxY: SIZE };
  }

  return projects.reduce(
    (bounds, project) => ({
      minX: Math.min(bounds.minX, project.x),
      minY: Math.min(bounds.minY, project.y),
      maxX: Math.max(bounds.maxX, project.x + MAP_TILE_SIZE),
      maxY: Math.max(bounds.maxY, project.y + MAP_TILE_SIZE),
    }),
    {
      minX: projects[0].x,
      minY: projects[0].y,
      maxX: projects[0].x + MAP_TILE_SIZE,
      maxY: projects[0].y + MAP_TILE_SIZE,
    }
  );
}

function getWorldSize(projects: ProjectMapLayout[]) {
  const bounds = getWorldBounds(projects);
  return {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

function getViewportSize(element: HTMLElement | null) {
  const rect = element?.getBoundingClientRect();
  return {
    width: rect?.width || SIZE,
    height: rect?.height || SIZE,
  };
}

function getAdaptiveProjectZoom(viewportSize: { width: number; height: number }) {
  return clampZoom(Math.min(
    FOCUSED_PROJECT_ZOOM,
    (viewportSize.width - FIT_PADDING) / MAP_TILE_SIZE,
    (viewportSize.height - FIT_PADDING) / MAP_TILE_SIZE,
  ));
}

function getFitAllViewport(
  projects: ProjectMapLayout[],
  viewportSize: { width: number; height: number }
) {
  if (projects.length === 0) return DEFAULT_VIEWPORT;
  if (projects.length === 1) {
    return getFocusedViewport(projects[0], viewportSize, getAdaptiveProjectZoom(viewportSize));
  }

  const bounds = getWorldBounds(projects);
  const world = {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
  const zoom = clampZoom(Math.min(
    1,
    (viewportSize.width - FIT_PADDING) / world.width,
    (viewportSize.height - FIT_PADDING) / world.height
  ));

  return {
    x: (viewportSize.width - world.width * zoom) / 2 - bounds.minX * zoom,
    y: (viewportSize.height - world.height * zoom) / 2 - bounds.minY * zoom,
    zoom,
  };
}

function getFocusedViewport(
  project: ProjectMapLayout,
  viewportSize: { width: number; height: number },
  zoom: number
) {
  const nextZoom = clampZoom(zoom);
  return {
    x: viewportSize.width / 2 - (project.x + MAP_TILE_SIZE / 2) * nextZoom,
    y: viewportSize.height / 2 - (project.y + MAP_TILE_SIZE / 2) * nextZoom,
    zoom: nextZoom,
  };
}

// ── Side panel ───────────────────────────────────────────────────────────────

function SidePanel({
  openId,
  setOpenId,
  techs,
  projectId,
  focusTarget,
  focusKey,
}: {
  openId: string | null;
  setOpenId: (id: string | null) => void;
  techs: DisplayTech[];
  projectId?: string;
  focusTarget?: TechDetailFocus;
  focusKey?: number;
}) {
  const tech = openId ? techs.find((t) => t.id === openId) : null;
  const missing = techs.filter((t) => t.kind === "service" && t.account === "missing");

  if (!tech) {
    const byCat = techs.reduce<Record<string, number>>((acc, t) => {
      acc[t.cat] = (acc[t.cat] ?? 0) + 1;
      return acc;
    }, {});

    return (
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--line)",
        borderRadius: 2, padding: 18, minWidth: 220,
      }}>
        {projectId && <ProjectAnnotations projectId={projectId} />}

        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Stack overview</div>
        <div style={{ fontSize: 12, color: "var(--ink-mid)", marginBottom: 18 }}>
          Click any node on the map for details, or switch to List view.
        </div>

        {missing.length > 0 && (
          <div style={{
            padding: 12, borderRadius: 2,
            background: "color-mix(in oklab, var(--warn) 8%, var(--bg-2))", border: "1px solid color-mix(in oklab, var(--warn) 40%, var(--line))",
            marginBottom: 18,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warn)", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "color-mix(in oklab, var(--warn) 70%, var(--ink))" }}>
                {missing.length} {missing.length === 1 ? "account" : "accounts"} to set up
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {missing.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 8px", background: "var(--bg-2)",
                    border: "1px solid var(--line)",
                    borderRadius: 2, cursor: "pointer", textAlign: "left",
                    fontSize: 12, fontFamily: "inherit",
                  }}
                >
                  <TechGlyph tech={t} size={20} />
                  <span style={{ flex: 1, fontWeight: 500 }}>{t.name}</span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace", color: "var(--ink-mid)" }}>
                    {categoryDesign[t.cat].label.toLowerCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{
          fontSize: 10, fontFamily: "var(--font-mono), monospace", color: "var(--ink-soft)",
          letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8,
        }}>By category</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {Object.entries(byCat).map(([catId, count]) => (
            <div key={catId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <CatDot cat={catId as TechCategory} />
              <span style={{ flex: 1 }}>{categoryDesign[catId as TechCategory].label}</span>
              <span style={{ fontFamily: "var(--font-mono), monospace", color: "var(--ink-soft)" }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cat = categoryDesign[tech.cat];
  return (
    <div style={{
      background: "var(--bg-2)",
      border: `1px solid ${cat.accent}`,
      borderRadius: 2,
      overflow: "hidden",
      boxShadow: `0 8px 24px -10px ${cat.accent}50`,
      minWidth: 220,
    }}>
      <div style={{ padding: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <TechGlyph tech={tech} size={42} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{tech.name}</div>
          <div style={{ fontSize: 11, color: cat.ink, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <CatDot cat={tech.cat} size={6} /> {cat.label}
          </div>
          <div style={{ marginTop: 10 }}>
            <AccountBadge tech={tech} size="md" />
          </div>
        </div>
        <button
          onClick={() => setOpenId(null)}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 18, color: "var(--ink-soft)", lineHeight: 1, padding: 4,
          }}
        >×</button>
      </div>
      <TechDetail tech={tech} focusTarget={focusTarget} focusKey={focusKey} />
    </div>
  );
}

// ── Focused radial (static, no pan/zoom) ─────────────────────────────────────

function FocusedRadial({
  project,
  openId,
  onTechSelect,
  onDeselect,
}: {
  project: ProjectMapLayout;
  openId: string | null;
  onTechSelect: (
    project: ProjectMapLayout,
    techId: string | null,
    focusTarget?: TechDetailFocus
  ) => void;
  onDeselect: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Small default so a first paint before measurement is never over-sized
  // (an over-sized default would momentarily overflow the container).
  const [scale, setScale] = useState(0.5);
  // User zoom multiplier on top of the fit scale — driven by the +/- controls
  // and two-finger pinch, so a dense radial is inspectable on phones.
  const [userZoom, setUserZoom] = useState(1);
  const [radialMenu, setRadialMenu] = useState<RadialMenuState | null>(null);
  const [previewActionId, setPreviewActionId] = useState<string | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const accounts = useAppStore((state) => state.accounts);

  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );

  const activeTechId = radialMenu?.techId ?? openId;
  const activePlacement = activeTechId
    ? project.placed.find((placement) => placement.tech.id === activeTechId) ?? null
    : null;

  const closeRadialMenu = useCallback(() => {
    setRadialMenu(null);
    setPreviewActionId(null);
  }, []);

  const openHoverMenu = useCallback((techId: string) => {
    setRadialMenu((current) => (
      current?.pinned ? current : { techId, pinned: false }
    ));
  }, []);

  const pinMenu = useCallback((techId: string) => {
    setRadialMenu({ techId, pinned: true });
    setPreviewActionId(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !radialMenu) return;
      event.preventDefault();
      closeRadialMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeRadialMenu, radialMenu]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const { width, height } = el.getBoundingClientRect();
      // Full radial diameter includes compass ring (RING_R + 82) + node cards
      // (NODE_W/2) + a comfortable margin so the wheel never crowds its edges.
      const needed = (RING_R + 82 + NODE_W / 2 + 50) * 2;
      const fit = Math.min(width, height) / needed;
      // On phones, don't shrink below a legible minimum — let the diagram
      // overflow into a scrollable area rather than becoming unreadable.
      const floor = window.innerWidth < 640 ? 0.62 : 0;
      setScale(Math.max(floor, fit));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clampZoom = (z: number) => Math.min(3, Math.max(0.5, z));
  const nudgeZoom = (factor: number) => setUserZoom((z) => clampZoom(z * factor));
  const fitMap = () => {
    setUserZoom(1);
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      container.scrollTo({
        left: Math.max((container.scrollWidth - container.clientWidth) / 2, 0),
        top: Math.max((container.scrollHeight - container.clientHeight) / 2, 0),
      });
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: userZoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setUserZoom(clampZoom(pinchRef.current.zoom * (dist / pinchRef.current.dist)));
      e.preventDefault();
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
  };

  const effScale = scale * userZoom;
  const canvasPadding = FOCUSED_CANVAS_PADDING * effScale;
  const canvasSize = (SIZE + FOCUSED_CANVAS_PADDING * 2) * effScale;

  const handleCanvasClick = () => {
    if (radialMenu) {
      closeRadialMenu();
      return;
    }
    onDeselect();
  };

  return (
    <div
      className="mv-focused-radial"
      style={{
        flex: "1 1 300px",
        minWidth: 0,
        position: "relative",
        height: "calc(100vh - 200px)",
        minHeight: 300,
        border: "1px solid var(--line)",
        borderRadius: 2,
        background: "var(--bg-2)",
      }}
    >
      {/* Pinned overlays (do not scroll with the diagram) */}
      <button
        type="button"
        onClick={onDeselect}
        style={{
          position: "absolute", top: 10, left: 10, zIndex: 3,
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 2,
          border: "1px solid var(--line)", background: "rgba(255,255,255,0.88)",
          fontSize: 11, color: "var(--ink-mid)",
          fontFamily: "var(--font-mono), monospace",
          cursor: "pointer",
        }}
      >
        ← all projects
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: 10, right: 10, zIndex: 3,
          display: "flex", flexDirection: "column", gap: 6,
        }}
      >
        <button type="button" title="Zoom in" onClick={() => nudgeZoom(1.25)} style={controlButtonStyle}>
          <ZoomIn size={15} />
        </button>
        <button type="button" title="Zoom out" onClick={() => nudgeZoom(0.8)} style={controlButtonStyle}>
          <ZoomOut size={15} />
        </button>
        <button type="button" title="Fit map" onClick={fitMap} style={controlButtonStyle}>
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Scroll/pan area (one-finger native pan, two-finger pinch to zoom) */}
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "absolute", inset: 0,
          display: "flex", overflow: "auto",
          cursor: "pointer",
          touchAction: "pan-x pan-y",
        }}
      >
      {/* Sizer takes the SCALED dimensions so overflow scrolls correctly;
          margin:auto centers it when there's room. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: canvasSize,
          height: canvasSize,
          flexShrink: 0,
          margin: "auto",
        }}
      >
      <div
        style={{
          position: "absolute",
          top: canvasPadding,
          left: canvasPadding,
          width: SIZE,
          height: SIZE,
          transform: `scale(${effScale})`,
          transformOrigin: "top left",
        }}
      >
        <svg
          width={RADIAL_SVG_SIZE}
          height={RADIAL_SVG_SIZE}
          viewBox={RADIAL_SVG_VIEWBOX}
          style={{
            position: "absolute",
            left: -RADIAL_SVG_PAD,
            top: -RADIAL_SVG_PAD,
            overflow: "visible",
          }}
          aria-hidden
        >
          <defs>
            {project.layout.map(({ cat, start, end }) => (
              <path
                key={`foc-arc-def-${cat}`}
                id={`foc-arc-${project.id}-${cat}`}
                d={arcPath(CENTER, CENTER, LABEL_R, start, end)}
              />
            ))}
          </defs>

          {/* Compass ring */}
          <circle cx={CENTER} cy={CENTER} r={RING_R + 82} stroke="var(--line-2)" strokeWidth={1} fill="none" opacity={0.7} />
          <circle cx={CENTER} cy={CENTER} r={RING_R + 76} stroke="var(--line)" strokeWidth={1} fill="none" opacity={0.7} />
          {Array.from({ length: 72 }, (_, i) => i * 5).map((deg) => {
            const rad = (deg - 90) * (Math.PI / 180);
            const isMajor = deg % 30 === 0;
            const r1 = RING_R + 76;
            const r2 = r1 - (isMajor ? 10 : 4);
            return (
              <line
                key={`foc-tick-${deg}`}
                x1={CENTER + Math.cos(rad) * r1} y1={CENTER + Math.sin(rad) * r1}
                x2={CENTER + Math.cos(rad) * r2} y2={CENTER + Math.sin(rad) * r2}
                stroke={isMajor ? "var(--ink-mid)" : "var(--line-2)"}
                strokeWidth={isMajor ? 1.2 : 0.8}
                opacity={0.8}
              />
            );
          })}

          {/* Category arcs + labels */}
          {project.layout.map(({ cat, start, end }) => {
            const c = categoryDesign[cat];
            return (
              <g key={`foc-arc-${cat}`}>
                <path d={arcPath(CENTER, CENTER, ARC_R, start, end)} stroke={c.accent} strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.75} />
                <text fill={c.ink} fontSize={10.5} fontFamily="var(--font-mono), monospace" letterSpacing={1.1}>
                  <textPath href={`#foc-arc-${project.id}-${cat}`} startOffset="50%" textAnchor="middle">
                    {c.label.toUpperCase()}
                  </textPath>
                </text>
              </g>
            );
          })}

          {/* Spokes */}
          {project.placed.map((p) => {
            const c = categoryDesign[p.cat];
            return (
              <line
                key={`foc-spoke-${p.tech.id}`}
                x1={CENTER + Math.cos(p.angle) * HUB_R} y1={CENTER + Math.sin(p.angle) * HUB_R}
                x2={p.x} y2={p.y}
                stroke={c.accent} strokeWidth={1}
                opacity={
                  activeTechId
                    ? activeTechId === p.tech.id ? 0.9 : 0.16
                    : 0.48
                }
              />
            );
          })}
        </svg>

        {/* Hub */}
        <div style={{
          position: "absolute",
          left: CENTER - HUB_R, top: CENTER - HUB_R,
          width: HUB_R * 2, height: HUB_R * 2,
          borderRadius: "50%",
          background: "var(--bg-2)",
          border: "1.5px solid var(--accent)",
          boxShadow: "0 0 32px -8px var(--accent), inset 0 0 24px -10px color-mix(in oklab, var(--accent) 12%, transparent)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          zIndex: 2,
        }}>
          <div style={{ marginBottom: 6 }}>
            <ProjectAvatar githubOwner={project.githubOwner} icon={project.icon} name={project.name} size={36} radius={8} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, textAlign: "center", padding: "0 6px", lineHeight: 1.2 }}>
            {project.name}
          </div>
          <div style={{ fontSize: 9, fontFamily: "var(--font-mono), monospace", color: "var(--accent)", marginTop: 2 }}>
            {project.techs.length} signals
          </div>
        </div>

        {/* Tech nodes */}
        {project.placed.map((p) => (
          <FocusedTechNode
            key={`foc-node-${p.tech.id}`}
            placement={p}
            project={project}
            open={openId === p.tech.id}
            dimmed={!!activePlacement && activePlacement.tech.id !== p.tech.id}
            menuOpen={radialMenu?.techId === p.tech.id}
            pinned={radialMenu?.techId === p.tech.id && radialMenu.pinned}
            accountName={p.tech.accountId ? accountNames.get(p.tech.accountId) : undefined}
            previewActionId={previewActionId}
            onHoverMenu={openHoverMenu}
            onPinMenu={pinMenu}
            onCloseMenu={closeRadialMenu}
            onPreviewAction={setPreviewActionId}
            onTechSelect={onTechSelect}
          />
        ))}
      </div>
      </div>
      </div>
    </div>
  );
}

function FocusedTechNode({
  placement,
  project,
  open,
  dimmed,
  menuOpen,
  pinned,
  accountName,
  previewActionId,
  onHoverMenu,
  onPinMenu,
  onCloseMenu,
  onPreviewAction,
  onTechSelect,
}: {
  placement: PlacedTech;
  project: ProjectMapLayout;
  open: boolean;
  dimmed: boolean;
  menuOpen: boolean;
  pinned: boolean;
  accountName?: string;
  previewActionId: string | null;
  onHoverMenu: (techId: string) => void;
  onPinMenu: (techId: string) => void;
  onCloseMenu: () => void;
  onPreviewAction: (actionId: string | null) => void;
  onTechSelect: (
    project: ProjectMapLayout,
    techId: string | null,
    focusTarget?: TechDetailFocus
  ) => void;
}) {
  const { tech } = placement;
  const c = categoryDesign[placement.cat];
  const isService = tech.kind === "service";
  const dashboardUrl = isService ? getDashboardUrl(tech.name, accountName) : null;
  const wrapperSize = menuOpen ? ACTION_MENU_ZONE_R * 2 : NODE_W;
  const wrapperHeight = menuOpen ? ACTION_MENU_ZONE_R * 2 : NODE_H;
  const wrapperLeft = menuOpen ? placement.x - ACTION_MENU_ZONE_R : placement.x - NODE_W / 2;
  const wrapperTop = menuOpen ? placement.y - ACTION_MENU_ZONE_R : placement.y - NODE_H / 2;
  const nodeLeft = menuOpen ? ACTION_MENU_ZONE_R - NODE_W / 2 : 0;
  const nodeTop = menuOpen ? ACTION_MENU_ZONE_R - NODE_H / 2 : 0;
  const baseAction = (focusTarget: TechDetailFocus = "details") => {
    onPinMenu(tech.id);
    onTechSelect(project, tech.id, focusTarget);
  };

  const actions: RadialAction[] = [
    {
      id: "details",
      label: "Details",
      detail: "Open the stack card",
      angle: placement.angle,
      icon: <Info size={15} />,
      onSelect: () => baseAction("details"),
    },
    ...(isService
      ? [
          {
            id: "account",
            label: "Account",
            detail: tech.account === "connected" ? "Change linked account" : "Assign linked account",
            angle: placement.angle,
            icon: <UserRoundCog size={15} />,
            onSelect: () => baseAction("account"),
          },
          {
            id: "environment",
            label: "Environment",
            detail: `Set ${tech.environment ?? "unknown"} context`,
            angle: placement.angle,
            icon: <SlidersHorizontal size={15} />,
            onSelect: () => baseAction("environment"),
          },
        ]
      : []),
    {
      id: "note",
      label: "Note",
      detail: tech.desc ? "Edit note" : "Add note",
      angle: placement.angle,
      icon: <FilePenLine size={15} />,
      onSelect: () => baseAction("note"),
    },
    ...(dashboardUrl
      ? [
          {
            id: "dashboard",
            label: "Dashboard",
            detail: `Open ${tech.name}`,
            angle: placement.angle,
            icon: <ExternalLink size={15} />,
            onSelect: () => {
              onPinMenu(tech.id);
              onTechSelect(project, tech.id, "details");
              window.open(dashboardUrl, "_blank", "noopener,noreferrer");
            },
          },
        ]
      : []),
  ].map((action, index, all) => ({
    ...action,
    angle: placement.angle + getActionFanOffset(index, all.length),
  }));

  const previewAction = actions.find((action) => action.id === previewActionId) ?? null;

  const closeMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onCloseMenu();
  };

  return (
    <div
      data-map-node
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") onHoverMenu(tech.id);
      }}
      onPointerLeave={() => {
        if (!pinned) onCloseMenu();
      }}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (
          pinned ||
          (nextTarget instanceof Node && event.currentTarget.contains(nextTarget))
        ) {
          return;
        }
        onCloseMenu();
      }}
      style={{
        position: "absolute",
        left: wrapperLeft,
        top: wrapperTop,
        width: wrapperSize,
        height: wrapperHeight,
        overflow: "visible",
        zIndex: menuOpen || open ? 8 : 4,
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        aria-label={`${tech.name} actions`}
        onFocus={() => onHoverMenu(tech.id)}
        onClick={(event) => {
          event.stopPropagation();
          onPinMenu(tech.id);
          onTechSelect(project, tech.id);
        }}
        style={{
          position: "absolute",
          left: nodeLeft,
          top: nodeTop,
          zIndex: 2,
          width: NODE_W,
          background: "var(--bg-2)",
          border: `1px solid ${open || menuOpen ? c.accent : "var(--line)"}`,
          borderRadius: 2,
          padding: "6px 9px",
          cursor: "pointer",
          boxShadow: open || menuOpen
            ? `0 6px 18px -8px ${c.accent}88`
            : "0 1px 3px rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 7,
          opacity: dimmed ? 0.32 : 1,
          transform: menuOpen ? "translateY(-1px)" : "none",
          transition: "border-color 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease, transform 0.18s ease",
          fontFamily: "inherit",
          textAlign: "left",
          color: "var(--ink)",
        }}
      >
        <TechGlyph tech={tech} size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {tech.name}
          </div>
          <NodeStateMicro tech={tech} accent={c.accent} ink={c.ink} />
        </div>
      </button>

      {menuOpen && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: ACTION_MENU_ZONE_R - 46,
              top: ACTION_MENU_ZONE_R - 46,
              width: 92,
              height: 92,
              borderRadius: "50%",
              border: `1px solid ${c.accent}35`,
              background: `radial-gradient(circle, ${c.soft} 0%, rgba(255,255,255,0) 68%)`,
              opacity: pinned ? 0.95 : 0.72,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          {actions.map((action) => (
            <RadialActionButton
              key={action.id}
              action={action}
              accent={c.accent}
              ink={c.ink}
              active={previewActionId === action.id}
              onPreviewAction={onPreviewAction}
            />
          ))}
          {pinned && (
            <button
              type="button"
              title="Close actions"
              aria-label="Close actions"
              onClick={closeMenu}
              style={{
                position: "absolute",
                left: ACTION_MENU_ZONE_R + Math.cos(placement.angle + Math.PI) * 76 - ACTION_BUTTON_SIZE / 2,
                top: ACTION_MENU_ZONE_R + Math.sin(placement.angle + Math.PI) * 76 - ACTION_BUTTON_SIZE / 2,
                width: ACTION_BUTTON_SIZE,
                height: ACTION_BUTTON_SIZE,
                borderRadius: "50%",
                border: "1px solid var(--line)",
                background: "rgba(255,255,255,0.94)",
                color: "var(--ink-mid)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 6px 18px -12px rgba(15,23,42,0.42)",
              }}
            >
              <X size={14} />
            </button>
          )}
          {previewAction && (
            <div
              style={{
                position: "absolute",
                left: ACTION_MENU_ZONE_R + Math.cos(previewAction.angle) * ACTION_MENU_LABEL_R - ACTION_PREVIEW_W / 2,
                top: ACTION_MENU_ZONE_R + Math.sin(previewAction.angle) * ACTION_MENU_LABEL_R - 23,
                width: ACTION_PREVIEW_W,
                minHeight: 42,
                padding: "6px 8px",
                border: `1px solid ${c.accent}55`,
                borderRadius: 2,
                background: "rgba(255,255,255,0.96)",
                boxShadow: "0 10px 22px -16px rgba(15,23,42,0.55)",
                pointerEvents: "none",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)", lineHeight: 1.15 }}>
                {previewAction.label}
              </div>
              <div style={{ marginTop: 2, fontSize: 10.5, color: "var(--ink-mid)", lineHeight: 1.2 }}>
                {previewAction.detail}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getActionFanOffset(index: number, total: number) {
  if (total <= 1) return 0;
  const span = Math.min(1.56, 0.39 * (total - 1));
  return -span / 2 + (span / (total - 1)) * index;
}

function RadialActionButton({
  action,
  accent,
  ink,
  active,
  onPreviewAction,
}: {
  action: RadialAction;
  accent: string;
  ink: string;
  active: boolean;
  onPreviewAction: (actionId: string | null) => void;
}) {
  return (
    <button
      type="button"
      title={`${action.label}: ${action.detail}`}
      aria-label={action.label}
      disabled={action.disabled}
      onPointerEnter={() => onPreviewAction(action.id)}
      onPointerLeave={() => onPreviewAction(null)}
      onFocus={() => onPreviewAction(action.id)}
      onBlur={() => onPreviewAction(null)}
      onClick={(event) => {
        event.stopPropagation();
        action.onSelect();
      }}
      style={{
        position: "absolute",
        left: ACTION_MENU_ZONE_R + Math.cos(action.angle) * ACTION_MENU_R - ACTION_BUTTON_SIZE / 2,
        top: ACTION_MENU_ZONE_R + Math.sin(action.angle) * ACTION_MENU_R - ACTION_BUTTON_SIZE / 2,
        zIndex: 1,
        width: ACTION_BUTTON_SIZE,
        height: ACTION_BUTTON_SIZE,
        borderRadius: "50%",
        border: `1px solid ${active ? accent : "var(--line)"}`,
        background: active ? `color-mix(in oklab, ${accent} 12%, white)` : "rgba(255,255,255,0.94)",
        color: active ? ink : "var(--ink-mid)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: action.disabled ? "not-allowed" : "pointer",
        opacity: action.disabled ? 0.45 : 1,
        boxShadow: active
          ? `0 8px 22px -12px ${accent}`
          : "0 6px 18px -12px rgba(15,23,42,0.42)",
        transition: "border-color 0.14s ease, background 0.14s ease, color 0.14s ease, transform 0.14s ease",
        transform: active ? "scale(1.08)" : "scale(1)",
      }}
    >
      {action.icon}
    </button>
  );
}

// ── Map view ─────────────────────────────────────────────────────────────────

export function MapView({
  projects,
  activeProjectId,
  onProjectSelect,
  openId,
  setOpenId,
}: {
  projects: ProjectMapData[];
  activeProjectId: string | null;
  onProjectSelect: (id: string | null) => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const [viewport, setViewport] = useState<MapViewport>(DEFAULT_VIEWPORT);
  const [isPanning, setIsPanning] = useState(false);
  const [projectPositions, setProjectPositions] = useState<Record<string, MapPosition>>({});
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [detailFocus, setDetailFocus] = useState<TechDetailFocusState | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const projectDragRef = useRef<ProjectDragState | null>(null);
  const suppressProjectClickRef = useRef<string | null>(null);
  const previousActiveIdRef = useRef(activeProjectId);
  const previousProjectCountRef = useRef(0);

  useRenderDiagnostics("MapView", () => ({
    projectCount: projects.length,
    selectedProjectId: activeProjectId,
    techCount: projects.reduce((total, project) => total + project.techs.length, 0),
    openId,
  }));

  const baseProjectLayouts = useMemo(() => {
    const columnCount = getProjectColumnCount(projects.length);
    return projects.map<ProjectMapLayout>((project, index) => {
      const { placed, layout } = computeLayout(project.techs);
      const basePosition = getProjectPosition(index, columnCount);
      return {
        ...project,
        x: basePosition.x,
        y: basePosition.y,
        placed,
        layout,
      };
    });
  }, [projects]);

  useEffect(() => {
    const startedAt = performance.now();
    debugLogThrottled(
      "MapView:layout",
      "MapView",
      "layout computed",
      {
        durationMs: measureDuration(startedAt),
        projectCount: projects.length,
        selectedProjectId: activeProjectId,
        techCount: projects.reduce((total, project) => total + project.techs.length, 0),
      }
    );
  }, [activeProjectId, projects, baseProjectLayouts]);

  const projectLayouts = useMemo(
    () => baseProjectLayouts.map((project) => {
      const override = projectPositions[project.id];
      if (!override) return project;
      return {
        ...project,
        x: override.x,
        y: override.y,
      };
    }),
    [baseProjectLayouts, projectPositions]
  );

  const selectedProject = activeProjectId
    ? projectLayouts.find((project) => project.id === activeProjectId) ?? null
    : null;

  useEffect(() => {
    if (previousProjectCountRef.current === projectLayouts.length) return;
    previousProjectCountRef.current = projectLayouts.length;
    setViewport(getFitAllViewport(projectLayouts, getViewportSize(viewportRef.current)));
    previousActiveIdRef.current = activeProjectId;
  }, [activeProjectId, projectLayouts]);

  useEffect(() => {
    if (previousActiveIdRef.current === activeProjectId) return;
    previousActiveIdRef.current = activeProjectId;
    const nextProject = activeProjectId
      ? projectLayouts.find((project) => project.id === activeProjectId)
      : null;
    if (!nextProject) {
      setViewport(getFitAllViewport(projectLayouts, getViewportSize(viewportRef.current)));
      return;
    }
    const vSize = getViewportSize(viewportRef.current);
    setViewport(getFocusedViewport(nextProject, vSize, getAdaptiveProjectZoom(vSize)));
  }, [activeProjectId, projectLayouts]);

  const handlePanePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (
        target.closest("[data-map-node]") ||
        target.closest("[data-map-action]") ||
        target.closest("[data-map-project]")
      ) {
        return;
      }

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: viewport.x,
        originY: viewport.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsPanning(true);
    },
    [viewport.x, viewport.y]
  );

  const handlePanePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    setViewport((current) => ({
      ...current,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    }));
  }, []);

  const stopPanning = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (event.currentTarget.hasPointerCapture(drag.pointerId)) {
      event.currentTarget.releasePointerCapture(drag.pointerId);
    }
    dragRef.current = null;
    setIsPanning(false);
  }, []);

  const handleProjectPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, project: ProjectMapLayout) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest("[data-map-node]")) return;

      event.stopPropagation();
      suppressProjectClickRef.current = null;
      projectDragRef.current = {
        pointerId: event.pointerId,
        projectId: project.id,
        startX: event.clientX,
        startY: event.clientY,
        originX: project.x,
        originY: project.y,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDraggingProjectId(project.id);
    },
    []
  );

  const handleProjectPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = projectDragRef.current;
      if (!drag) return;

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        drag.moved = true;
      }

      setProjectPositions((current) => ({
        ...current,
        [drag.projectId]: {
          x: drag.originX + deltaX / viewport.zoom,
          y: drag.originY + deltaY / viewport.zoom,
        },
      }));
    },
    [viewport.zoom]
  );

  const handleProjectPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = projectDragRef.current;
    if (!drag) return;

    if (event.currentTarget.hasPointerCapture(drag.pointerId)) {
      event.currentTarget.releasePointerCapture(drag.pointerId);
    }

    if (drag.moved) {
      suppressProjectClickRef.current = drag.projectId;
    }

    projectDragRef.current = null;
    setDraggingProjectId(null);
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;
    const factor = clampWheelZoomFactor(
      Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY)
    );

    setViewport((current) =>
      zoomViewport(current, current.zoom * factor, anchorX, anchorY)
    );
  }, []);

  const zoomFromCenter = useCallback((factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const anchorX = rect ? rect.width / 2 : SIZE / 2;
    const anchorY = rect ? rect.height / 2 : SIZE / 2;

    setViewport((current) =>
      zoomViewport(current, current.zoom * factor, anchorX, anchorY)
    );
  }, []);

  const fitAllProjects = useCallback(() => {
    onProjectSelect(null);
    setOpenId(null);
    setDetailFocus(null);
    setViewport(getFitAllViewport(projectLayouts, getViewportSize(viewportRef.current)));
  }, [onProjectSelect, projectLayouts, setOpenId]);

  const focusProject = useCallback((project: ProjectMapLayout) => {
    const vSize = getViewportSize(viewportRef.current);
    setViewport(getFocusedViewport(project, vSize, getAdaptiveProjectZoom(vSize)));
  }, []);

  const setOpenTechFromPanel = useCallback(
    (techId: string | null) => {
      setOpenId(techId);
      setDetailFocus(null);
    },
    [setOpenId]
  );

  const selectProject = useCallback(
    (project: ProjectMapLayout) => {
      if (suppressProjectClickRef.current === project.id) {
        suppressProjectClickRef.current = null;
        return;
      }

      onProjectSelect(project.id);
      setOpenId(null);
      setDetailFocus(null);
      focusProject(project);
    },
    [focusProject, onProjectSelect, setOpenId]
  );

  const selectTech = useCallback(
    (
      project: ProjectMapLayout,
      techId: string | null,
      focusTarget: TechDetailFocus = "details"
    ) => {
      onProjectSelect(project.id);
      setOpenId(techId);
      setDetailFocus((current) => (
        techId
          ? {
              techId,
              target: focusTarget,
              key: (current?.key ?? 0) + 1,
            }
          : null
      ));
      focusProject(project);
    },
    [focusProject, onProjectSelect, setOpenId]
  );

  if (projectLayouts.length === 0) {
    return null;
  }

  return (
    <div className="mv-focused-layout" style={{ display: "flex", gap: 24, alignItems: "flex-start", width: "100%" }}>
      {selectedProject ? (
        /* ── Focused: static radial, no pan/zoom ── */
        <FocusedRadial
          key={selectedProject.id}
          project={selectedProject}
          openId={openId}
          onTechSelect={selectTech}
          onDeselect={() => { onProjectSelect(null); setOpenId(null); setDetailFocus(null); }}
        />
      ) : (
        /* ── Canvas: pan/zoom across all projects ── */
        <div
          ref={viewportRef}
          onPointerDown={handlePanePointerDown}
          onPointerMove={handlePanePointerMove}
          onPointerUp={stopPanning}
          onPointerCancel={stopPanning}
          onWheel={handleWheel}
          style={{
            position: "relative",
            width: "100%",
            height: "calc(100vh - 200px)",
            minHeight: 420,
            overflow: "hidden",
            border: "1px solid var(--line)",
            borderRadius: 2,
            background: "var(--bg-2)",
            touchAction: "none",
            cursor: isPanning ? "grabbing" : "grab",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: getWorldSize(projectLayouts).width,
              height: getWorldSize(projectLayouts).height,
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
              transformOrigin: "0 0",
            }}
          >
            {projectLayouts.map((project) => (
              <ProjectRadialMap
                key={project.id}
                project={project}
                active={false}
                dragging={project.id === draggingProjectId}
                showRadial={viewport.zoom >= RADIAL_DETAIL_ZOOM}
                openId={null}
                onProjectSelect={selectProject}
                onTechSelect={selectTech}
                onProjectPointerDown={handleProjectPointerDown}
                onProjectPointerMove={handleProjectPointerMove}
                onProjectPointerUp={handleProjectPointerUp}
              />
            ))}
          </div>

          <div
            data-map-action
            style={{ position: "absolute", right: 12, top: 12, display: "flex", flexDirection: "column", gap: 6 }}
          >
            <button type="button" title="Zoom in" onClick={() => zoomFromCenter(1 + ZOOM_STEP)} style={controlButtonStyle}>
              <ZoomIn size={15} />
            </button>
            <button type="button" title="Zoom out" onClick={() => zoomFromCenter(1 - ZOOM_STEP)} style={controlButtonStyle}>
              <ZoomOut size={15} />
            </button>
            <button type="button" title="Fit all projects" onClick={fitAllProjects} style={controlButtonStyle}>
              <Maximize2 size={15} />
            </button>
          </div>

          <div
            data-map-action
            style={{
              position: "absolute", left: 12, bottom: 12,
              padding: "4px 7px", border: "1px solid var(--line)", borderRadius: 2,
              background: "rgba(255,255,255,0.88)", color: "var(--ink-mid)",
              fontSize: 10, fontFamily: "var(--font-mono), monospace",
            }}
          >
            {Math.round(viewport.zoom * 100)}%
          </div>
        </div>
      )}

      {/* Side panel */}
      {selectedProject && (
        <div className="mv-side-panel" style={{ flex: "1.1 1 300px", minWidth: 0, paddingTop: 8 }}>
          <SidePanel
            openId={openId}
            setOpenId={setOpenTechFromPanel}
            techs={selectedProject.techs}
            projectId={selectedProject.id}
            focusTarget={detailFocus?.techId === openId ? detailFocus.target : undefined}
            focusKey={detailFocus?.techId === openId ? detailFocus.key : undefined}
          />
        </div>
      )}
    </div>
  );
}

function ProjectRadialMap({
  project,
  active,
  dragging,
  showRadial,
  openId,
  onProjectSelect,
  onTechSelect,
  onProjectPointerDown,
  onProjectPointerMove,
  onProjectPointerUp,
}: {
  project: ProjectMapLayout;
  active: boolean;
  dragging: boolean;
  showRadial: boolean;
  openId: string | null;
  onProjectSelect: (project: ProjectMapLayout) => void;
  onTechSelect: (project: ProjectMapLayout, techId: string | null) => void;
  onProjectPointerDown: (
    event: React.PointerEvent<HTMLDivElement>,
    project: ProjectMapLayout
  ) => void;
  onProjectPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onProjectPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      data-map-project
      onClick={() => onProjectSelect(project)}
      onPointerDown={(event) => onProjectPointerDown(event, project)}
      onPointerMove={onProjectPointerMove}
      onPointerUp={onProjectPointerUp}
      onPointerCancel={onProjectPointerUp}
      style={{
        position: "absolute",
        left: project.x,
        top: project.y,
        width: MAP_TILE_SIZE,
        height: MAP_TILE_SIZE,
        borderRadius: 2,
        background: active ? "rgba(248,250,252,0.88)" : "transparent",
        outline: active || dragging ? "2px solid var(--ink)" : "1px solid transparent",
        outlineOffset: 8,
        cursor: dragging ? "grabbing" : "grab",
      }}
    >
      {!showRadial && (
        <ProjectSummaryCircle
          projectName={project.name}
          githubOwner={project.githubOwner}
          icon={project.icon}
          techCount={project.techs.length}
          missingCount={project.techs.filter((t) => t.kind === "service" && t.account === "missing").length}
          active={active}
          dragging={dragging}
        />
      )}

      {showRadial && (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: SIZE,
          height: SIZE,
          transform: `scale(${MAP_TILE_SCALE})`,
          transformOrigin: "0 0",
        }}
      >
        <svg
          width={RADIAL_SVG_SIZE}
          height={RADIAL_SVG_SIZE}
          viewBox={RADIAL_SVG_VIEWBOX}
          style={{
            position: "absolute",
            left: -RADIAL_SVG_PAD,
            top: -RADIAL_SVG_PAD,
            overflow: "visible",
          }}
        >
          <defs>
            {project.layout.map(({ cat, start, end }) => (
              <path
                key={`arc-def-${project.id}-${cat}`}
                id={`arc-label-${project.id}-${cat}`}
                d={arcPath(CENTER, CENTER, LABEL_R, start, end)}
              />
            ))}
          </defs>

          {/* Compass ring */}
          <circle cx={CENTER} cy={CENTER} r={RING_R + 82} stroke="var(--line-2)" strokeWidth={1} fill="none" opacity={active ? 0.7 : 0.45} />
          <circle cx={CENTER} cy={CENTER} r={RING_R + 76} stroke="var(--line)" strokeWidth={1} fill="none" opacity={active ? 0.7 : 0.45} />
          {Array.from({ length: 72 }, (_, i) => i * 5).map((deg) => {
            const rad = (deg - 90) * (Math.PI / 180);
            const isMajor = deg % 30 === 0;
            const r1 = RING_R + 76;
            const r2 = r1 - (isMajor ? 10 : 4);
            return (
              <line
                key={`tick-${deg}`}
                x1={CENTER + Math.cos(rad) * r1} y1={CENTER + Math.sin(rad) * r1}
                x2={CENTER + Math.cos(rad) * r2} y2={CENTER + Math.sin(rad) * r2}
                stroke={isMajor ? "var(--ink-mid)" : "var(--line-2)"}
                strokeWidth={isMajor ? 1.2 : 0.8}
                opacity={active ? 0.8 : 0.4}
              />
            );
          })}

          {project.layout.map(({ cat, start, end }) => {
            const c = categoryDesign[cat];
            return (
              <g key={`arc-${cat}`}>
                <path
                  d={arcPath(CENTER, CENTER, ARC_R, start, end)}
                  stroke={c.accent} strokeWidth={2.5}
                  strokeLinecap="round"
                  fill="none" opacity={active ? 0.75 : 0.52}
                />
                <text
                  fill={c.ink} fontSize={10.5}
                  fontFamily="var(--font-mono), monospace" letterSpacing={1.1}
                  opacity={active ? 1 : 0.85}
                >
                  <textPath href={`#arc-label-${project.id}-${cat}`} startOffset="50%" textAnchor="middle">
                    {c.label.toUpperCase()}
                  </textPath>
                </text>
              </g>
            );
          })}

          {project.placed.map((p) => {
            const c = categoryDesign[p.cat];
            return (
              <line
                key={`spoke-${p.tech.id}`}
                x1={CENTER + Math.cos(p.angle) * HUB_R}
                y1={CENTER + Math.sin(p.angle) * HUB_R}
                x2={p.x} y2={p.y}
                stroke={c.accent} strokeWidth={1}
                opacity={openId === p.tech.id ? 0.9 : active ? 0.48 : 0.30}
              />
            );
          })}
        </svg>

        <div
          onClick={(event) => {
            event.stopPropagation();
            onProjectSelect(project);
          }}
          style={{
            position: "absolute",
            left: CENTER - HUB_R,
            top: CENTER - HUB_R,
            width: HUB_R * 2,
            height: HUB_R * 2,
            borderRadius: "50%",
            background: "var(--bg-2)",
            border: `1.5px solid ${active ? "var(--accent)" : "color-mix(in oklab, var(--accent) 35%, var(--line))"}`,
            boxShadow: active
              ? "0 0 32px -8px var(--accent), inset 0 0 24px -10px color-mix(in oklab, var(--accent) 12%, transparent)"
              : "0 0 14px -6px color-mix(in oklab, var(--accent) 30%, transparent)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: dragging ? "grabbing" : "grab",
          }}
        >
          <div style={{ marginBottom: 6 }}>
            <ProjectAvatar githubOwner={project.githubOwner} icon={project.icon} name={project.name} size={36} radius={8} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, textAlign: "center", padding: "0 6px", lineHeight: 1.2 }}>
            {project.name}
          </div>
          <div style={{ fontSize: 9, fontFamily: "var(--font-mono), monospace", color: "var(--ink-soft)", marginTop: 2 }}>
            {project.techs.length} techs
          </div>
        </div>

        {project.placed.map((p) => {
          const c = categoryDesign[p.cat];
          const open = openId === p.tech.id;
          return (
            <div
              key={p.tech.id}
              data-map-node
              onClick={(event) => {
                event.stopPropagation();
                onTechSelect(project, open ? null : p.tech.id);
              }}
              style={{
                position: "absolute",
                left: p.x - NODE_W / 2,
                top: p.y - NODE_H / 2,
                width: NODE_W,
                background: "var(--bg-2)",
                border: `1px solid ${open ? c.accent : "var(--line)"}`,
                borderRadius: 2,
                padding: "6px 9px",
                cursor: "pointer",
                boxShadow: open
                  ? `0 4px 14px -4px ${c.accent}55`
                  : "0 1px 3px rgba(0,0,0,0.06)",
                display: "flex", alignItems: "center", gap: 7,
                opacity: active || open ? 1 : 0.78,
                transition: "border-color 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease",
              }}
            >
              <TechGlyph tech={p.tech} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, lineHeight: 1.1,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {p.tech.name}
                </div>
                <NodeStateMicro tech={p.tech} accent={c.accent} ink={c.ink} />
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

export function ProjectAvatar({
  githubOwner,
  icon,
  name,
  size,
  radius = 8,
}: {
  githubOwner: string;
  icon?: string;
  name: string;
  size: number;
  radius?: number;
}) {
  const [failed, setFailed] = useState(false);
  const isLocal = githubOwner === "local" || !githubOwner;

  // Local project with a found icon file
  if (isLocal && icon) {
    return (
      <Image
        src={icon}
        alt={name}
        width={size}
        height={size}
        unoptimized
        style={{ borderRadius: radius, display: "block", flexShrink: 0, objectFit: "contain" }}
      />
    );
  }

  // GitHub project — fetch avatar
  if (!isLocal && !failed) {
    return (
      <Image
        src={`https://github.com/${githubOwner}.png?size=${size * 2}`}
        alt={name}
        width={size}
        height={size}
        unoptimized
        style={{ borderRadius: radius, display: "block", flexShrink: 0 }}
        onError={() => setFailed(true)}
      />
    );
  }

  // Fallback: initials
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: "var(--ink)", color: "var(--bg-3)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-mono), monospace", fontWeight: 600,
      fontSize: Math.round(size * 0.38),
      flexShrink: 0,
    }}>
      {name.slice(0, 2).toLowerCase()}
    </div>
  );
}

function ProjectSummaryCircle({
  projectName,
  githubOwner,
  icon,
  techCount,
  missingCount,
  active,
  dragging,
}: {
  projectName: string;
  githubOwner: string;
  icon?: string;
  techCount: number;
  missingCount: number;
  active: boolean;
  dragging: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: (MAP_TILE_SIZE - PROJECT_SUMMARY_SIZE) / 2,
        top: (MAP_TILE_SIZE - PROJECT_SUMMARY_SIZE) / 2,
        width: PROJECT_SUMMARY_SIZE,
        height: PROJECT_SUMMARY_SIZE,
        borderRadius: "50%",
        background: "var(--bg-2)",
        border: `2px solid ${active || dragging ? "var(--ink)" : "var(--line)"}`,
        boxShadow: active || dragging
          ? "0 14px 34px -18px rgba(15,23,42,0.45)"
          : "0 10px 28px -20px rgba(15,23,42,0.28)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 26,
        textAlign: "center",
        color: "var(--ink)",
        pointerEvents: "none",
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <ProjectAvatar githubOwner={githubOwner} icon={icon} name={projectName} size={52} radius={12} />
      </div>
      <div
        style={{
          maxWidth: 190,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.2,
        }}
      >
        {projectName}
      </div>
      <div
        style={{
          marginTop: 6,
          color: "var(--ink-mid)",
          fontFamily: "var(--font-mono), monospace",
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        {techCount} techs
      </div>
      {missingCount > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: "3px 10px",
            borderRadius: 999,
            background: "color-mix(in oklab, var(--warn) 12%, var(--bg-2))",
            border: "1px solid color-mix(in oklab, var(--warn) 45%, var(--line))",
            color: "color-mix(in oklab, var(--warn) 75%, var(--ink))",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {missingCount} to set up
        </div>
      )}
    </div>
  );
}

const controlButtonStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  border: "1px solid var(--line)",
  borderRadius: 2,
  background: "rgba(255,255,255,0.92)",
  color: "var(--ink-mid)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 1px 4px rgba(15,23,42,0.08)",
};

function NodeStateMicro({ tech, accent, ink }: { tech: DisplayTech; accent: string; ink: string }) {
  if (tech.kind === "library") {
    return (
      <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono), monospace", color: "var(--ink-soft)" }}>
        lib{tech.version ? ` · ${tech.version}` : ""}
      </span>
    );
  }
  const connected = tech.account === "connected";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontFamily: "var(--font-mono), monospace" }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: connected ? accent : "transparent",
        border: connected ? "none" : "1.2px dashed var(--line-2)",
        position: "relative", flexShrink: 0,
      }}>
        {!connected && (
          <span style={{
            position: "absolute", top: -1, right: -1,
            width: 4, height: 4, borderRadius: "50%",
            background: "var(--warn)",
          }} />
        )}
      </span>
      <span style={{ color: connected ? ink : "var(--ink-soft)" }}>
        {connected ? "Account set" : "No account"}
      </span>
    </span>
  );
}
