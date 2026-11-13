"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

export interface DeliveryMapPoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  status?: string;
}

interface LocationMapProps {
  points: DeliveryMapPoint[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onPick?: (latitude: number, longitude: number) => void;
  className?: string;
}

const validPoint = (p: DeliveryMapPoint) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
  && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;

/** Tile requests contain map areas; customer labels stay in this browser. */
export function LocationMap({ points, selectedId, onSelect, onPick, className }: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const tiles = useRef<Leaflet.TileLayer | null>(null);
  const markers = useRef<Leaflet.LayerGroup | null>(null);
  const callbacks = useRef({ onSelect, onPick });
  const lastBounds = useRef("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tileError, setTileError] = useState(false);

  useEffect(() => { callbacks.current = { onSelect, onPick }; }, [onSelect, onPick]);

  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    void import("leaflet").then(L => {
      if (disposed || !container.current) return;
      library.current = L;
      const instance = L.map(container.current, { scrollWheelZoom: false, zoomControl: true })
        .setView([47.918, 106.917], 12);
      map.current = instance;
      const layer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      });
      tiles.current = layer;
      layer.on("tileerror", () => { if (!disposed) setTileError(true); });
      let receivedTile = false;
      layer.on("tileload", () => { receivedTile = true; });
      layer.addTo(instance);
      markers.current = L.layerGroup().addTo(instance);
      instance.on("click", (event: Leaflet.LeafletMouseEvent) => {
        const longitude = ((event.latlng.lng + 180) % 360 + 360) % 360 - 180;
        callbacks.current.onPick?.(Number(event.latlng.lat.toFixed(6)), Number(longitude.toFixed(6)));
      });
      resize = new ResizeObserver(() => instance.invalidateSize());
      resize.observe(container.current);
      timeout = setTimeout(() => { if (!disposed && !receivedTile) setTileError(true); }, 15000);
      setReady(true);
    }).catch(() => { if (!disposed) setFailed(true); });

    return () => {
      disposed = true;
      if (timeout) clearTimeout(timeout);
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
      library.current = null;
      markers.current = null;
      tiles.current = null;
      lastBounds.current = "";
    };
  }, []);

  useEffect(() => {
    const L = library.current;
    const instance = map.current;
    const layer = markers.current;
    if (!ready || !L || !instance || !layer) return;
    layer.clearLayers();
    const safePoints = points.filter(validPoint);
    for (const [index, point] of safePoints.entries()) {
      const content = document.createElement("span");
      content.textContent = String(index + 1);
      const active = point.id === selectedId;
      const color = point.status === "delivered" ? "#16a34a" : point.status === "cancelled" ? "#64748b" : point.status === "shipped" ? "#2563eb" : "#7c3aed";
      Object.assign(content.style, {
        display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px",
        borderRadius: "50% 50% 50% 4px", background: color, color: "white", fontWeight: "700", fontSize: "12px",
        border: "2px solid white", boxShadow: active ? `0 0 0 4px ${color}50, 0 2px 6px #0004` : "0 2px 6px #0004",
      });
      const label = document.createElement("span");
      label.textContent = point.label;
      const marker = L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({ html: content, className: "axora-delivery-pin", iconSize: [30, 30], iconAnchor: [7, 28] }),
        title: point.label, alt: point.label, keyboard: true, zIndexOffset: active ? 1000 : 0,
      }).bindTooltip(label, { direction: "top", offset: [8, -24] })
        .on("click", () => callbacks.current.onSelect?.(point.id)).addTo(layer);
      marker.getElement()?.setAttribute("aria-label", point.label);
      marker.getElement()?.setAttribute("aria-pressed", String(active));
    }
    const boundsKey = safePoints.map(p => `${p.id}:${p.latitude},${p.longitude}`).join("|");
    if (safePoints.length && lastBounds.current !== boundsKey) {
      instance.fitBounds(L.latLngBounds(safePoints.map(p => [p.latitude, p.longitude])), { padding: [40, 40], maxZoom: 15, animate: false });
    }
    lastBounds.current = boundsKey;
  }, [points, selectedId, ready]);

  useEffect(() => {
    const selected = points.find(p => p.id === selectedId && validPoint(p));
    if (ready && selected) map.current?.panTo([selected.latitude, selected.longitude], { animate: false });
  }, [selectedId, points, ready]);

  return (
    <div className={cn("relative isolate overflow-hidden rounded-xl border border-ink-200 bg-ink-50", className)}>
      <div ref={container} className="h-full min-h-[300px] w-full" role="region" aria-label={onPick ? "Хүргэлтийн байршил сонгох газрын зураг" : "Захиалгын хүргэлтийн байршлууд"} />
      {!ready || failed ? <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-ink-50/95 px-5 text-center text-sm text-ink-500" role="status">{failed ? (onPick ? "Газрын зураг ачаалагдсангүй. Координатыг доорх талбарт оруулж болно." : "Газрын зураг ачаалагдсангүй. Доорх жагсаалтаас захиалгаа сонгоно уу.") : "Газрын зураг ачаалж байна…"}</div> : null}
      {tileError && ready ? <div className="absolute left-3 right-3 top-3 z-[1000] rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="status">Газрын зургийн дүрс ачаалагдсангүй. Байршлын координат болон захиалгын жагсаалтыг ашиглах боломжтой. <button type="button" className="ml-1 font-semibold underline" onClick={() => { setTileError(false); tiles.current?.redraw(); }}>Дахин ачаалах</button></div> : null}
    </div>
  );
}
