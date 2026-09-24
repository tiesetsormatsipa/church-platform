/** Directions link for a place: the stored maps URL, else coordinates, else the address. */
export function directionsUrl(place: {
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string[];
}): string | null {
  if (place.mapsUrl && /^https:\/\//.test(place.mapsUrl)) return place.mapsUrl;
  if (place.latitude !== null && place.longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  }
  const address = place.address.filter(Boolean).join(', ');
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
}
