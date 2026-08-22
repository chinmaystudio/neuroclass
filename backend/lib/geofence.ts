export type LocationStatus =
  | 'LOCATION_VERIFIED'
  | 'LOCATION_UNCERTAIN'
  | 'OUTSIDE_RADIUS'
  | 'LOCATION_PERMISSION_DENIED'
  | 'LOCATION_UNAVAILABLE';

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METERS = 6_371_000;

export function isValidCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function isValidGeoPoint(point: Partial<GeoPoint> | null | undefined): point is GeoPoint {
  return Boolean(
    point &&
      isValidCoordinate(point.latitude, -90, 90) &&
      isValidCoordinate(point.longitude, -180, 180),
  );
}

export function haversineDistanceMeters(from: GeoPoint, to: GeoPoint): number {
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const latitudeOne = toRadians(from.latitude);
  const latitudeTwo = toRadians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeOne) * Math.cos(latitudeTwo) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function evaluateGeofence(
  teacher: GeoPoint,
  student: GeoPoint,
  accuracyMeters: number,
  radiusMeters: number,
): { status: LocationStatus; distanceMeters: number; accuracyMeters: number } {
  const distanceMeters = haversineDistanceMeters(teacher, student);
  const safeAccuracy = Math.max(0, accuracyMeters);
  const safeRadius = Math.max(25, radiusMeters);

  // A fix is verified only when the entire reported uncertainty circle is inside
  // the zone. If the uncertainty overlaps the boundary, require teacher review.
  if (distanceMeters + safeAccuracy <= safeRadius) {
    return { status: 'LOCATION_VERIFIED', distanceMeters, accuracyMeters: safeAccuracy };
  }
  if (distanceMeters - safeAccuracy > safeRadius) {
    return { status: 'OUTSIDE_RADIUS', distanceMeters, accuracyMeters: safeAccuracy };
  }
  return { status: 'LOCATION_UNCERTAIN', distanceMeters, accuracyMeters: safeAccuracy };
}
