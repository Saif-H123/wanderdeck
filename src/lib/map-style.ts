// Printed-atlas style — warm cream land, soft slate water, country borders only.
export const ATLAS_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "labels.text.fill", stylers: [{ color: "#5a4f44" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#efe4cd" }, { weight: 4 }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },

  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#7a6754" }, { weight: 1.2 }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#b09779" }, { weight: 0.6 }] },

  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#efe4cd" }] },
  { featureType: "landscape.natural.terrain", elementType: "geometry", stylers: [{ visibility: "off" }] },

  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },

  { featureType: "water", elementType: "geometry", stylers: [{ color: "#9bbcc4" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d5a6c" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#9bbcc4" }, { weight: 3 }] },
];

// Numbered SVG pin, off-black on cream.
export function numberedPinIcon(index: number, selected: boolean): google.maps.Icon {
  const size = selected ? 38 : 32;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="${size}" height="${(size * 48) / 36}">
  <path d="M18 0C8.06 0 0 8.06 0 18c0 12 18 30 18 30s18-18 18-30C36 8.06 27.94 0 18 0z" fill="#1c1917" stroke="#fafaf9" stroke-width="1"/>
  <circle cx="18" cy="18" r="10" fill="#fafaf9"/>
  <text x="18" y="22" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700" font-size="13" fill="#1c1917">${index + 1}</text>
</svg>`.trim();
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, (size * 48) / 36),
    anchor: new google.maps.Point(size / 2, (size * 48) / 36),
  };
}

// Plain circle pin for the featured-location landing map.
export function dotPinIcon(selected: boolean): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: "#1c1917",
    fillOpacity: 1,
    strokeColor: "#fafaf9",
    strokeWeight: 2,
    scale: selected ? 10 : 7,
  };
}
