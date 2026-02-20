export function geographicImpossible(distanceKm: number, deltaSeconds: number): boolean {
  if (deltaSeconds <= 0) return true
  const kmPerHour = (distanceKm / deltaSeconds) * 3600
  return kmPerHour > 1000
}
