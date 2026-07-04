"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { LOCALES_BAC, BAC_MAP_CENTER, type LocalBac } from "@/data/localesBac";

export interface UserPosition {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface BacMapProps {
  sellosBac: Record<string, number>;
  userPos: UserPosition | null;
  onLocalTap: (local: LocalBac) => void;
  flyToUser: number;
}

const NIGHT = "#1a2b5c";
const PINK = "#FF4B91";
const CREAM = "#FDF1D6";

const INITIAL_ZOOM = 15;
const LABEL_ZOOM_THRESHOLD = 16;

// Shorten long names so labels stay legible on the map.
function labelText(nombre: string): string {
  const up = nombre.toUpperCase();
  if (up.length <= 14) return up;
  const words = up.split(/\s+/);
  return words[0].length <= 14 ? words[0] : up.slice(0, 12) + "…";
}

function buildFlyerLabel(nombre: string, visited: boolean, frequent: boolean) {
  const text = labelText(nombre);

  const base = `
    font-family: var(--font-bac-display), Montserrat, 'Arial Black', sans-serif;
    font-weight: 900;
    letter-spacing: 0.03em;
    white-space: nowrap;
    padding: 3px 8px;
    border-radius: 6px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    user-select: none;
    position: absolute;
    left: 50%;
    top: 50%;
  `;

  const scale = visited ? 1.1 : 1;
  const transform = `translate(-50%, -50%) scale(${scale})`;

  const style = visited
    ? `
        ${base}
        background: ${frequent ? "#FFD84D" : PINK};
        color: ${frequent ? NIGHT : "#fff"};
        border: 2px solid ${CREAM};
        box-shadow: 0 0 12px ${frequent ? "rgba(255,216,77,0.8)" : "rgba(255,75,145,0.85)"}, 0 2px 4px rgba(0,0,0,0.4);
        transform: ${transform};
        font-size: 10px;
      `
    : `
        ${base}
        background: ${CREAM};
        color: ${NIGHT};
        border: 1.5px solid ${NIGHT};
        box-shadow: 0 2px 5px rgba(0,0,0,0.45);
        transform: ${transform};
        font-size: 10px;
      `;

  const bracketColor = visited ? (frequent ? NIGHT : CREAM) : PINK;

  const html = `
    <div style="${style}">
      <span style="color:${bracketColor}; font-weight:900;">[</span>
      <span>${text}</span>
      <span style="color:${bracketColor}; font-weight:900;">]</span>
    </div>
  `;

  return L.divIcon({
    className: "bac-flyer-label",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function buildCompactDot(visited: boolean, frequent: boolean) {
  const style = visited
    ? `
        position: absolute;
        left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: 16px; height: 16px;
        border-radius: 50%;
        background: ${frequent ? "#FFD84D" : PINK};
        border: 2px solid ${CREAM};
        box-shadow: 0 0 12px ${frequent ? "rgba(255,216,77,0.9)" : "rgba(255,75,145,0.9)"}, 0 2px 4px rgba(0,0,0,0.4);
        animation: bacDotPulse 1.8s ease-in-out infinite;
      `
    : `
        position: absolute;
        left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: 14px; height: 14px;
        border-radius: 50%;
        background: ${CREAM};
        border: 1.5px solid ${NIGHT};
        box-shadow: 0 2px 5px rgba(0,0,0,0.4);
        transition: transform 0.2s ease;
      `;

  return L.divIcon({
    className: "bac-compact-dot",
    html: `<div style="${style}"></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function buildUserIcon() {
  const html = `
    <div style="position:relative; width: 22px; height: 22px;">
      <div style="
        position:absolute; inset:0;
        border-radius:50%;
        background: rgba(59,130,246,0.32);
        animation: bacUserPulse 1.6s ease-out infinite;
      "></div>
      <div style="
        position:absolute; top:50%; left:50%;
        width: 14px; height: 14px;
        transform: translate(-50%, -50%);
        border-radius:50%;
        background:#3B82F6;
        border: 2px solid #fff;
        box-shadow: 0 0 8px rgba(59,130,246,0.9);
      "></div>
    </div>
  `;
  return L.divIcon({
    className: "bac-user-icon",
    html,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });
  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);
  return null;
}

function FlyToUser({ userPos, trigger }: { userPos: UserPosition | null; trigger: number }) {
  const map = useMap();
  const lastTrigger = useRef(0);
  useEffect(() => {
    if (trigger === 0) return;
    if (trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    if (userPos) {
      map.flyTo([userPos.lat, userPos.lng], 17, { duration: 1.2 });
    }
  }, [trigger, userPos, map]);
  return null;
}

export default function BacMap({ sellosBac, userPos, onLocalTap, flyToUser }: BacMapProps) {
  const userIcon = useMemo(() => buildUserIcon(), []);
  const [zoomLevel, setZoomLevel] = useState(INITIAL_ZOOM);
  const showLabels = zoomLevel >= LABEL_ZOOM_THRESHOLD;

  return (
    <div
      className="map-bac-style"
      style={{ width: "100%", height: "100%", position: "relative", isolation: "isolate", background: "#24346c" }}
    >
      <style>{`
        @keyframes bacUserPulse {
          0%   { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes bacDotPulse {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.35); }
        }
        .bac-compact-dot { cursor: pointer; }
        .bac-compact-dot:hover > div { transform: translate(-50%, -50%) scale(1.25); }
        /* Flyer-style filter: shifts CartoDB Dark Matter toward indigo/magenta */
        .map-bac-style .leaflet-tile {
          filter: hue-rotate(220deg) saturate(2.5) contrast(1.15) brightness(0.75);
        }
        .map-bac-style .leaflet-container {
          background: #24346c !important;
          font-family: var(--font-bac-display), Montserrat, sans-serif;
        }
        /* Keep every Leaflet layer inside a low stacking context so the
           app-level modals (z-[9999]) always render on top. */
        .map-bac-style .leaflet-pane,
        .map-bac-style .leaflet-top,
        .map-bac-style .leaflet-bottom {
          z-index: 1;
        }
        .map-bac-style .leaflet-control-attribution {
          background: rgba(15,27,76,0.7) !important;
          color: rgba(253,241,214,0.6) !important;
          font-size: 9px !important;
        }
        .map-bac-style .leaflet-control-attribution a {
          color: #FF4B91 !important;
        }
        .map-bac-style .leaflet-control-zoom a {
          background: rgba(26,43,92,0.92) !important;
          color: #FDF1D6 !important;
          border-color: rgba(255,75,145,0.35) !important;
        }
        .map-bac-style .leaflet-control-zoom a:hover {
          background: rgba(255,75,145,0.3) !important;
        }
        .bac-flyer-label {
          cursor: pointer;
        }
        .bac-flyer-label:hover > div {
          filter: brightness(1.12);
        }
      `}</style>

      <MapContainer
        center={BAC_MAP_CENTER}
        zoom={INITIAL_ZOOM}
        scrollWheelZoom
        style={{ width: "100%", height: "100%", zIndex: 0 }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>'
          subdomains={["a", "b", "c", "d"]}
        />

        <ZoomTracker onZoomChange={setZoomLevel} />

        {LOCALES_BAC.map((local) => {
          const count = sellosBac[local.id] || 0;
          const visited = count > 0;
          const frequent = count >= 3;
          const icon = showLabels
            ? buildFlyerLabel(local.nombre, visited, frequent)
            : buildCompactDot(visited, frequent);
          return (
            <Marker
              key={local.id}
              position={[local.lat, local.lng]}
              icon={icon}
              eventHandlers={{ click: () => onLocalTap(local) }}
            />
          );
        })}

        {userPos && <Marker position={[userPos.lat, userPos.lng]} icon={userIcon} />}
        <FlyToUser userPos={userPos} trigger={flyToUser} />
      </MapContainer>
    </div>
  );
}
