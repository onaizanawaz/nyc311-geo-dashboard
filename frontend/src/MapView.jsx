import { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { BarChart3, ChevronLeft, ChevronRight, Compass, LayoutGrid, Settings2, SlidersHorizontal } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./App.css";

// ---- CONFIG: update these to match your actual GeoServer setup ----
const WORKSPACE = "nyc311";
const LAYER = "nyc_311_complaints";
const FULL_LAYER_NAME = `${WORKSPACE}:${LAYER}`;
const GEOSERVER_WFS_URL = "/geoserver/nyc311/wfs";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// Default map center (NYC)
const NYC_CENTER = [40.7128, -74.006];

const BASEMAPS = [
  {
    id: "osm",
    label: "Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
  },
  {
    id: "dark",
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  {
    id: "light",
    label: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  {
    id: "topo",
    label: "Topo",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
];

const DEFAULT_BASEMAP_ID = BASEMAPS[0].id;

// A small fixed palette. Any complaint type not in here falls back to a
// hash-based color so the legend stays readable instead of having 50+ colors.
const COLOR_PALETTE = [
  "#ff6b6b", "#4ed7ff", "#ffd36a", "#8fd67a", "#c792ea",
  "#ff9f6b", "#6ae0c9", "#f28fce", "#a0c4ff", "#ffadad",
];

// Tool categories removed - sidebar focuses on data controls

function colorForType(type, knownTypes) {
  const idx = knownTypes.indexOf(type);
  if (idx >= 0 && idx < COLOR_PALETTE.length) return COLOR_PALETTE[idx];
  // fallback: hash the string to pick a stable color for "long tail" types
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = type.charCodeAt(i) + ((hash << 5) - hash);
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

// ---- NEW UI COMPONENTS ----
const NAV_ITEMS = [
  { label: "Overview", icon: LayoutGrid },
  { label: "Filters", icon: SlidersHorizontal },
  { label: "Insights", icon: BarChart3 },
  { label: "Basemaps", icon: Compass },
];

function Sidebar({
  collapsed,
  onToggleCollapsed,
  complaintType,
  setComplaintType,
  complaintTypes,
  quickComplaintTypes,
  opacity,
  setOpacity,
  loading,
}) {
  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col border-r border-white/10 bg-slate-950/90 px-3 py-4 text-slate-100 shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur transition-all duration-300 ${
        collapsed ? "w-24" : "w-[320px]"
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-sm font-semibold text-slate-950">
            N
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">NYC 311 Pulse</div>
              <div className="truncate text-xs text-slate-400">Operational intelligence</div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="mt-4 flex flex-col gap-2" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className={`flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition ${
                collapsed ? "justify-center" : ""
              } bg-white/5 text-slate-300 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={16} className="shrink-0 text-cyan-300" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
          <div className="mb-3 flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-cyan-300" />
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Data filters</div>
              <div className="text-sm font-semibold text-slate-100">Complaint controls</div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              Complaint type
            </label>
            <select
              value={complaintType}
              onChange={(e) => setComplaintType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
            >
              <option value="">All types</option>
              {complaintTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  !complaintType ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200" : "border-white/10 bg-white/5 text-slate-300"
                }`}
                onClick={() => setComplaintType("")}
              >
                All
              </button>
              {quickComplaintTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    complaintType === type ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200" : "border-white/10 bg-white/5 text-slate-300"
                  }`}
                  onClick={() => setComplaintType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
          <div className="mb-3 flex items-center gap-2">
            <Settings2 size={14} className="text-cyan-300" />
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Display options</div>
              <div className="text-sm font-semibold text-slate-100">Map presentation</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
              <label className="">Opacity</label>
              <span className="text-slate-200">{opacity.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400"
            />
          </div>

          <div className="mt-3">
            <Legend types={complaintTypes} counts={{}} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
        <div className="text-xs text-slate-400">{loading ? "Loading…" : "Ready"}</div>
        <div className="flex items-center gap-2">
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300" aria-label="Settings" title="Settings">
            <Settings2 size={14} />
          </button>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300" aria-label="Power" title="Power">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function MapStatsBar({
  filteredFeatures,
  featureCount,
  complaintTypes,
  typeCounts,
  loading,
  complaintType,
  activeLabel,
}) {
  const topType = useMemo(() => {
    const entries = Object.entries(typeCounts);
    if (!entries.length) return null;
    return entries.sort((a, b) => b[1] - a[1])[0];
  }, [typeCounts]);

  const openCount = useMemo(() => {
    return filteredFeatures.filter((f) => {
      const status = (f.properties?.status || "Open").toLowerCase();
      return status === "open" || status === "in progress";
    }).length;
  }, [filteredFeatures]);

  return (
    <div className="map-stats-bar">
      <div className="map-stat-card">
        <span className="map-stat-label">Visible points</span>
        <strong className="map-stat-value">{loading ? "—" : filteredFeatures.length.toLocaleString()}</strong>
      </div>
      <div className="map-stat-card">
        <span className="map-stat-label">Loaded records</span>
        <strong className="map-stat-value">{loading ? "—" : (featureCount ?? 0).toLocaleString()}</strong>
      </div>
      <div className="map-stat-card">
        <span className="map-stat-label">Complaint types</span>
        <strong className="map-stat-value">{complaintTypes.length || "—"}</strong>
      </div>
      <div className="map-stat-card">
        <span className="map-stat-label">Open / in progress</span>
        <strong className="map-stat-value">{loading ? "—" : openCount.toLocaleString()}</strong>
      </div>
      <div className="map-stat-card map-stat-card-wide">
        <span className="map-stat-label">{complaintType ? "Active filter" : "Top complaint type"}</span>
        <strong className="map-stat-value map-stat-value-text">
          {complaintType ? activeLabel : (topType ? `${topType[0]} (${topType[1].toLocaleString()})` : "—")}
        </strong>
      </div>
    </div>
  );
}

function MapToolbar({ searchQuery, setSearchQuery, activeLabel, filteredFeatures }) {
  return (
    <div className="map-toolbar">
      <div className="search-shell">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search complaints by type, agency, borough or address"
          aria-label="Search complaints"
        />
        {searchQuery.trim() ? (
          <button type="button" className="search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">
            ×
          </button>
        ) : null}
      </div>

      <div className="toolbar-summary">
        <span>{activeLabel}</span>
        <strong>{filteredFeatures.length} matches</strong>
      </div>
    </div>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="layers-icon-svg">
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M2 17l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function BasemapLayer({ basemap }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    const nextLayer = L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: basemap.maxZoom,
    });
    const previousLayer = layerRef.current;

    nextLayer.addTo(map);
    layerRef.current = nextLayer;

    if (previousLayer) {
      map.removeLayer(previousLayer);
    }

    return () => {
      if (layerRef.current === nextLayer) {
        map.removeLayer(nextLayer);
        layerRef.current = null;
      }
    };
  }, [map, basemap.id, basemap.url, basemap.attribution, basemap.maxZoom]);

  return null;
}

function MapResizeHandler({ layoutKey }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize({ animate: true, pan: false });
    }, 320);

    return () => window.clearTimeout(timer);
  }, [map, layoutKey]);

  return null;
}

function BasemapLayersControl({ basemapId, setBasemapId }) {
  const [open, setOpen] = useState(false);
  const controlRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (controlRef.current && !controlRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="map-layers-control" ref={controlRef}>
      <button
        type="button"
        className={`map-layers-trigger ${open ? "active" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Change basemap"
      >
        <LayersIcon />
      </button>

      <div className={`map-layers-panel ${open ? "open" : ""}`} role="menu" aria-label="Basemap options">
        <div className="map-layers-panel-title">Basemap</div>
        <ul className="map-layers-list">
          {BASEMAPS.map((basemap) => {
            const isSelected = basemapId === basemap.id;
            return (
              <li key={basemap.id}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  className={`map-layers-option ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    setBasemapId(basemap.id);
                    setOpen(false);
                  }}
                >
                  <span className="map-layers-check" aria-hidden="true">
                    {isSelected ? "✓" : ""}
                  </span>
                  <span className="map-layers-label">{basemap.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function MarkerPopup({ properties }) {
  const safeProperties = properties || {};
  const title = safeProperties.descriptor || safeProperties.complaint_type || "Complaint";

  return (
    <Popup className="map-popup-shell">
      <div className="popup-card">
        <div className="popup-header">
          <div className="popup-header-left">
            <div className="popup-eyebrow">Service Request</div>
            <h3 className="popup-title">{safeProperties.complaint_type || "Complaint"}</h3>
          </div>
          <span className={`popup-pill popup-status-${(safeProperties.status || "Open").toLowerCase().replace(/\s+/g, "-")}`}>
            {safeProperties.status || "Open"}
          </span>
        </div>

        {safeProperties.descriptor && (
          <div className="popup-description-box">
            <div className="description-icon">📋</div>
            <div className="description-content">
              <p className="description-label">Description</p>
              <p className="description-text">{safeProperties.descriptor}</p>
            </div>
          </div>
        )}

        <div className="popup-body">
          {safeProperties.borough ? (
            <div className="popup-row">
              <span className="popup-label">🏙️ Borough</span>
              <strong>{safeProperties.borough}</strong>
            </div>
          ) : null}
          {safeProperties.address ? (
            <div className="popup-row">
              <span className="popup-label">📍 Address</span>
              <strong>{safeProperties.address}</strong>
            </div>
          ) : null}
          {safeProperties.agency_name ? (
            <div className="popup-row">
              <span className="popup-label">🏢 Agency</span>
              <strong>{safeProperties.agency_name}</strong>
            </div>
          ) : null}
          {safeProperties.created_date && (
            <div className="popup-row">
              <span className="popup-label">🕐 Created</span>
              <strong>{new Date(safeProperties.created_date).toLocaleDateString()} {new Date(safeProperties.created_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
            </div>
          )}
        </div>
      </div>
    </Popup>
  );
}

function Legend({ types, counts }) {
  if (!types.length) return null;
  // show top 8 by count, group the rest as "Other"
  const sorted = [...types].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  const shown = sorted.slice(0, 8);

  return (
    <div className="panel-card legend-card">
      <div className="panel-title">Complaint types</div>
      {shown.map((type) => (
        <div key={type} className="legend-row">
          <span
            className="legend-dot"
            style={{ background: colorForType(type, sorted) }}
          />
          <span>{type}</span>
        </div>
      ))}
      {sorted.length > 8 && (
        <div className="legend-footnote">+{sorted.length - 8} more</div>
      )}
    </div>
  );
}

export default function MapView() {
  const [complaintType, setComplaintType] = useState("");
  const [complaintTypes, setComplaintTypes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [opacity, setOpacity] = useState(0.8);
  const [features, setFeatures] = useState([]);
  const [featureCount, setFeatureCount] = useState(null);
  const [typeCounts, setTypeCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [basemapId, setBasemapId] = useState(DEFAULT_BASEMAP_ID);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mapRef = useRef(null);

  const cqlFilter = complaintType
    ? `complaint_type='${complaintType.replace(/'/g, "''")}'`
    : null;

  // Load distinct complaint types from the backend API
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/complaints/types`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed with ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setComplaintTypes(Array.isArray(data) ? data.sort() : []);
      })
      .catch((err) => console.error("Failed to load complaint types:", err));
    return () => { cancelled = true; };
  }, []);

  // Load stats from the backend API (used for the feature count + legend counts)
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/complaints/stats`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed with ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const counts = {};
        data.forEach((item) => { counts[item.complaint_type] = Number(item.count || 0); });
        setTypeCounts(counts);
      })
      .catch((err) => console.error("Failed to load stats:", err));
    return () => { cancelled = true; };
  }, []);

  // Load actual point features from GeoServer WFS as GeoJSON, so we can
  // render individual, clustered, color-coded markers instead of a flat
  // WMS raster layer.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: FULL_LAYER_NAME,
      outputFormat: "application/json",
    });
    if (cqlFilter) params.append("CQL_FILTER", cqlFilter);

    fetch(`${GEOSERVER_WFS_URL}?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`GeoServer responded with ${res.status}`);
        return res.json();
      })
      .then((geojson) => {
        if (cancelled) return;
        const feats = (geojson.features || []).filter(
          (f) => f.geometry && Array.isArray(f.geometry.coordinates)
        );
        setFeatures(feats);
        setFeatureCount(feats.length);
      })
      .catch((err) => {
        console.error("Failed to load map features:", err);
        if (!cancelled) {
          setError("Couldn't load complaint data. GeoServer may be unavailable.");
          setFeatures([]);
          setFeatureCount(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [cqlFilter]);

  const knownTypeOrder = useMemo(() => complaintTypes, [complaintTypes]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const hasActiveFilters = Boolean(complaintType || normalizedSearchQuery);
  const quickComplaintTypes = useMemo(() => {
    return [...complaintTypes].sort((a, b) => (typeCounts[b] || 0) - (typeCounts[a] || 0)).slice(0, 6);
  }, [complaintTypes, typeCounts]);

  const filteredFeatures = useMemo(() => {
    return features.filter((feature) => {
      const properties = feature.properties || {};
      const type = (properties.complaint_type || "").toString();
      const matchesType = !complaintType || type === complaintType;

      if (!matchesType) return false;
      if (!normalizedSearchQuery) return true;

      const searchableText = [
        type,
        properties.descriptor,
        properties.agency,
        properties.borough,
        properties.address,
        properties.street_name,
        properties.status,
        properties.created_date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearchQuery);
    });
  }, [complaintType, features, normalizedSearchQuery]);

  const visibleTypeCounts = useMemo(() => {
    const counts = {};
    filteredFeatures.forEach((feature) => {
      const type = feature.properties?.complaint_type || "Unknown";
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [filteredFeatures]);

  const activeBasemap = useMemo(
    () => BASEMAPS.find((basemap) => basemap.id === basemapId) ?? BASEMAPS[0],
    [basemapId]
  );

  const activeLabel = complaintType || (normalizedSearchQuery ? `Search: ${searchQuery.trim()}` : "All complaint types");

  return (
    <div className="dashboard-shell">
      <div className="dashboard-body">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          complaintType={complaintType}
          setComplaintType={setComplaintType}
          complaintTypes={complaintTypes}
          quickComplaintTypes={quickComplaintTypes}
          opacity={opacity}
          setOpacity={setOpacity}
          loading={loading}
        />

        <main className="map-stage">
          {/* MapStatsBar and MapToolbar removed per user request */}

          <div className="map-shell">
            <BasemapLayersControl basemapId={basemapId} setBasemapId={setBasemapId} />
            {loading && (
              <div className="map-loading-overlay">
                <div className="spinner" />
                <span>Loading complaints...</span>
              </div>
            )}

            {error && !loading && (
              <div className="map-error-banner">
                {error}
              </div>
            )}

          

            {(!loading && !error && filteredFeatures.length === 0 && features.length > 0) && (
              <div className="map-empty-state">
                No complaint points match the current filters.
                {hasActiveFilters ? " Try a broader search or reset the filters." : ""}
              </div>
            )}

            <MapContainer center={NYC_CENTER} zoom={11} ref={mapRef} className="basemap-transition">
              <MapResizeHandler layoutKey={sidebarCollapsed ? "collapsed" : "expanded"} />
              <BasemapLayer basemap={activeBasemap} />
              <MarkerClusterGroup chunkedLoading>
                {filteredFeatures.map((f) => {
                  const coords = f.geometry?.coordinates;
                  if (!Array.isArray(coords) || coords.length < 2) return null;

                  const [lng, lat] = coords;
                  const type = f.properties?.complaint_type || "Unknown";
                  return (
                    <CircleMarker
                      key={f.id}
                      center={[lat, lng]}
                      radius={6}
                      pathOptions={{
                        color: colorForType(type, knownTypeOrder),
                        fillColor: colorForType(type, knownTypeOrder),
                        fillOpacity: opacity,
                        opacity: opacity,
                      }}
                    >
                      <MarkerPopup properties={f.properties} />
                    </CircleMarker>
                  );
                })}
              </MarkerClusterGroup>
            </MapContainer>
          </div>
        </main>
      </div>
    </div>
  );
}