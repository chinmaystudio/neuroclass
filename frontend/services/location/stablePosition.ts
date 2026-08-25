export type StablePosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

type PositionOptionsProfile = PositionOptions;

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const readPosition = (options: PositionOptionsProfile) => new Promise<GeolocationPosition>((resolve, reject) => {
  navigator.geolocation.getCurrentPosition(resolve, reject, options);
});

const median = (values: number[]) => {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
};

/**
 * Collect several fresh browser fixes and return a robust representative point.
 * The reported accuracy includes the sample spread so the server never receives
 * an unrealistically precise point just because one device fix was optimistic.
 */
export async function getStableBrowserPosition(sampleCount = 3): Promise<StablePosition> {
  if (!navigator.geolocation) {
    throw Object.assign(new Error('This device does not provide browser location services.'), { code: 2 });
  }

  const profiles: PositionOptionsProfile[] = [
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 20_000, maximumAge: 0 },
  ];
  const samples: GeolocationPosition[] = [];
  let lastError: GeolocationPositionError | null = null;

  for (let index = 0; index < sampleCount; index += 1) {
    try {
      const position = await readPosition(profiles[index === 0 ? 0 : 1]);
      samples.push(position);
    } catch (error) {
      lastError = error as GeolocationPositionError;
      if (lastError.code === 1) throw lastError;
    }
    if (index < sampleCount - 1) await wait(500);
  }

  if (!samples.length) {
    throw lastError || Object.assign(new Error('No location fix was returned.'), { code: 2 });
  }

  const latitudes = samples.map((sample) => sample.coords.latitude);
  const longitudes = samples.map((sample) => sample.coords.longitude);
  const accuracies = samples.map((sample) => Number.isFinite(sample.coords.accuracy) ? Math.max(0, sample.coords.accuracy) : 0);
  const latitude = median(latitudes);
  const longitude = median(longitudes);
  const spreadMeters = Math.max(
    ...samples.map((sample) => {
      const latitudeDelta = (sample.coords.latitude - latitude) * 111_320;
      const longitudeDelta = (sample.coords.longitude - longitude) * 111_320 * Math.cos(latitude * Math.PI / 180);
      return Math.sqrt(latitudeDelta ** 2 + longitudeDelta ** 2);
    }),
  );

  return {
    latitude,
    longitude,
    accuracy: Math.max(median(accuracies), spreadMeters),
    timestamp: Math.max(...samples.map((sample) => Number.isFinite(sample.timestamp) && sample.timestamp > 0 ? sample.timestamp : Date.now())),
  };
}
