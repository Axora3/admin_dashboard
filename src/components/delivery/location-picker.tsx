"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LocateFixed, MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LocationMap } from "./location-map";

export interface LocationPickerProps {
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  onChange?: (latitude: number | null, longitude: number | null) => void;
}

export function LocationPicker({ initialLatitude, initialLongitude, onChange }: LocationPickerProps) {
  const id = useId();
  const [latitude, setLatitude] = useState(initialLatitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(initialLongitude?.toString() ?? "");
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current += 1; }, []);
  const valid = latitude.trim() !== "" && longitude.trim() !== "" && Number.isFinite(Number(latitude))
    && Number.isFinite(Number(longitude)) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;
  const points = useMemo(() => valid ? [{ id: "destination", latitude: Number(latitude), longitude: Number(longitude), label: "Хүргэлт хүлээн авах байршил" }] : [], [latitude, longitude, valid]);

  function update(lat: string, lng: string) {
    // A manual edit or clear supersedes any browser geolocation still in flight.
    locationRequest.current += 1;
    setLocating(false);
    setLatitude(lat); setLongitude(lng); setMessage("");
    onChange?.(lat.trim() ? Number(lat) : null, lng.trim() ? Number(lng) : null);
  }

  function locate() {
    if (!navigator.geolocation) { setMessage("Энэ браузер байршил тодорхойлох боломжгүй. Газрын зураг дээр сонгоно уу."); return; }
    setLocating(true); setMessage("");
    const request = ++locationRequest.current;
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationRequest.current) return;
      update(position.coords.latitude.toFixed(6), position.coords.longitude.toFixed(6));
      setLocating(false);
    }, error => {
      if (request !== locationRequest.current) return;
      setMessage(error.code === 1 ? "Байршлын зөвшөөрөл өгөөгүй байна. Газрын зураг дээр сонгох боломжтой." : "Байршлыг тодорхойлж чадсангүй. Газрын зураг дээр сонгоно уу.");
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink-800"><MapPin className="h-4 w-4" /> Газрын зураг дээрх байршил</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={locating} onClick={locate} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 disabled:opacity-50"><LocateFixed className="h-3.5 w-3.5" />{locating ? "Тодорхойлж байна…" : "Миний байршил"}</button>
        {latitude || longitude ? <button type="button" onClick={() => update("", "")} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-ink-500"><X className="h-3.5 w-3.5" /> Арилгах</button> : null}
      </div>
    </div>
    <p className="text-xs leading-relaxed text-ink-500">Хүргэлт хүлээн авах газраа зураг дээр дарж тэмдэглэнэ үү. Координатыг гараар оруулж болно. Эхний харагдац Улаанбаатар; цэг сонгоогүй бол байршил хадгалагдахгүй.</p>
    <LocationMap points={points} onPick={(lat, lng) => update(String(lat), String(lng))} className="h-[300px]" />
    <div className="grid grid-cols-2 gap-3">
      <label htmlFor={`${id}-latitude`} className="min-w-0 space-y-1 text-xs font-medium text-ink-600"><span>Өргөрөг (Latitude)</span><Input id={`${id}-latitude`} name="latitude" type="number" inputMode="text" min={-90} max={90} step="any" value={latitude} placeholder="47.918000" onChange={event => update(event.target.value, longitude)} required={longitude.trim() !== ""} /></label>
      <label htmlFor={`${id}-longitude`} className="min-w-0 space-y-1 text-xs font-medium text-ink-600"><span>Уртраг (Longitude)</span><Input id={`${id}-longitude`} name="longitude" type="number" inputMode="text" min={-180} max={180} step="any" value={longitude} placeholder="106.917000" onChange={event => update(latitude, event.target.value)} required={latitude.trim() !== ""} /></label>
    </div>
    {message ? <p role="status" className="text-xs text-amber-700">{message}</p> : null}
  </div>;
}
