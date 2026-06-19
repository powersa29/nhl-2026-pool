'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export interface LivePin {
  player_id: number;
  player_name: string;
  lat: number;
  lng: number;
  course_id: number | null;
}

interface Props {
  center?: { lat: number; lng: number; label: string };
  filterCourseId?: number;
  liveLocations?: LivePin[];
  height?: number | string;
  zoom?: number;
  pinDropMode?: boolean;
  droppedPin?: { lat: number; lng: number } | null;
  myPosition?: { lat: number; lng: number } | null;
  onPinDrop?: (lat: number, lng: number) => void;
}

function initials(name: string) {
  return name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase();
}

const COLORS = ['#15803d','#1d4ed8','#b45309','#7c3aed','#dc2626','#0891b2'];

export default function GolfMap({
  center, filterCourseId, liveLocations = [], height = 340, zoom = 16,
  pinDropMode = false, droppedPin, myPosition, onPinDrop,
}: Props) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const lRef            = useRef<any>(null);
  const pinRefs         = useRef<any[]>([]);
  const droppedPinRef   = useRef<any>(null);
  const myPositionRef   = useRef<any>(null);
  const clickHandlerRef = useRef<any>(null);

  // ── Init map once ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import('leaflet').then(mod => {
      const L = mod.default;
      lRef.current = L;

      const initCenter: [number, number] = center
        ? [center.lat, center.lng]
        : myPosition
          ? [myPosition.lat, myPosition.lng]
          : [38.5, -96];

      const map = L.map(containerRef.current!, {
        center: initCenter,
        zoom: (center || myPosition) ? zoom : 4,
        scrollWheelZoom: false,
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Course flag — only when label is provided
      if (center && center.label) {
        L.marker([center.lat, center.lng], {
          icon: L.divIcon({
            html: '<div style="font-size:26px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">⛳</div>',
            className: '',
            iconSize: [28, 28],
            iconAnchor: [4, 28],
          }),
        }).addTo(map).bindPopup(`<strong>${center.label}</strong>`);
      }

      drawPins(L, map);
      updateDroppedPin(L, map, droppedPin ?? null);
      updateMyPosition(L, map, myPosition ?? null);
      setupClickHandler(map, pinDropMode);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      lRef.current   = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pin drop click handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    setupClickHandler(mapRef.current, pinDropMode);
    if (containerRef.current) {
      containerRef.current.style.cursor = pinDropMode ? 'crosshair' : '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinDropMode, onPinDrop]);

  // ── Dropped pin marker ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !lRef.current) return;
    updateDroppedPin(lRef.current, mapRef.current, droppedPin ?? null);
  }, [droppedPin]);

  // ── My position marker ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !lRef.current) return;
    updateMyPosition(lRef.current, mapRef.current, myPosition ?? null);
  }, [myPosition]);

  // ── Live player pins ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !lRef.current) return;
    drawPins(lRef.current, mapRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLocations, filterCourseId]);

  function setupClickHandler(map: any, active: boolean) {
    if (clickHandlerRef.current) {
      map.off('click', clickHandlerRef.current);
      clickHandlerRef.current = null;
    }
    if (active && onPinDrop) {
      clickHandlerRef.current = (e: any) => onPinDrop(e.latlng.lat, e.latlng.lng);
      map.on('click', clickHandlerRef.current);
    }
  }

  function updateDroppedPin(L: any, map: any, pin: { lat: number; lng: number } | null) {
    if (droppedPinRef.current) { droppedPinRef.current.remove(); droppedPinRef.current = null; }
    if (!pin) return;
    droppedPinRef.current = L.marker([pin.lat, pin.lng], {
      icon: L.divIcon({
        html: '<div style="font-size:30px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.5));line-height:1">📍</div>',
        className: '',
        iconSize: [30, 34],
        iconAnchor: [8, 32],
      }),
      zIndexOffset: 2000,
    }).addTo(map);
  }

  function updateMyPosition(L: any, map: any, pos: { lat: number; lng: number } | null) {
    if (myPositionRef.current) { myPositionRef.current.remove(); myPositionRef.current = null; }
    if (!pos) return;
    myPositionRef.current = L.marker([pos.lat, pos.lng], {
      icon: L.divIcon({
        html: `<div style="
          width:16px;height:16px;border-radius:50%;
          background:#3b82f6;border:3px solid white;
          box-shadow:0 0 0 5px rgba(59,130,246,0.25),0 2px 8px rgba(0,0,0,.4);
        "></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
      zIndexOffset: 3000,
    }).addTo(map).bindPopup('<strong>You</strong>');
  }

  function drawPins(L: any, map: any) {
    pinRefs.current.forEach(m => m.remove());
    pinRefs.current = [];

    const visible = filterCourseId != null
      ? liveLocations.filter(p => p.course_id === filterCourseId)
      : liveLocations;

    const bounds: [number, number][] = [];

    visible.forEach((p, i) => {
      const color = COLORS[i % COLORS.length];
      const ini   = initials(p.player_name);
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          html: `<div style="
            width:34px;height:34px;border-radius:50%;
            background:${color};color:#fff;
            display:flex;align-items:center;justify-content:center;
            font-size:12px;font-weight:700;
            border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);
          ">${ini}</div>`,
          className: '',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        zIndexOffset: 1000,
      }).addTo(map).bindPopup(`<strong>${p.player_name}</strong>`);
      pinRefs.current.push(marker);
      bounds.push([p.lat, p.lng]);
    });

    if (!center && bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', borderRadius: 'var(--radius)', overflow: 'hidden', position: 'relative' }}
    />
  );
}
