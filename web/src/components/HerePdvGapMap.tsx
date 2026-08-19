import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { clientPdvIconFor, sellerNowIcon } from "../lib/mapMarkers";
import { formatGapDistance } from "../lib/visitEvidence";

type Point = { latitude: number; longitude: number };

type Props = {
  pdv: Point;
  here: Point;
  meters: number;
  pdvName?: string | null;
};

/** Mapa compacto: tú ↔ PDV con la distancia en el tramo. */
export function HerePdvGapMap({ pdv, here, meters, pdvName }: Props) {
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!canvasEl) return;

    const pdvLl: L.LatLngExpression = [pdv.latitude, pdv.longitude];
    const hereLl: L.LatLngExpression = [here.latitude, here.longitude];

    const map = L.map(canvasEl, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const line = L.polyline([hereLl, pdvLl], {
      color: "#f16b5f",
      weight: 4,
      opacity: 1,
      lineCap: "round",
    }).addTo(map);

    line.bindTooltip(formatGapDistance(meters), {
      permanent: true,
      direction: "center",
      opacity: 1,
      className: "map-dist-on-line",
    });

    L.marker(pdvLl, { icon: clientPdvIconFor(pdvName || "PDV") }).addTo(map);
    L.marker(hereLl, { icon: sellerNowIcon, zIndexOffset: 1400 }).addTo(map);

    map.fitBounds(L.latLngBounds([hereLl, pdvLl]), { padding: [44, 44], maxZoom: 17 });
    const t1 = window.setTimeout(() => map.invalidateSize(), 80);
    const t2 = window.setTimeout(() => map.invalidateSize(), 320);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      map.remove();
    };
  }, [canvasEl, pdv.latitude, pdv.longitude, here.latitude, here.longitude, meters, pdvName]);

  return (
    <div className="map-stage here-pdv-map">
      <div ref={setCanvasEl} className="map-stage-canvas is-gap" />
    </div>
  );
}
