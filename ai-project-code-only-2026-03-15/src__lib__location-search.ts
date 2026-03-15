import locationsData from "../data/locations.json";

type CountryEntry = { name: string };
type CityEntry = { name: string; country: string; label: string };

export type LocationSuggestion = {
  label: string;
  value: string;
  type: "city" | "country";
};

function normalize(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function bucketKey(value: string) {
  const n = normalize(value);
  return n.slice(0, 2);
}

const countries = (locationsData.countries as CountryEntry[]).map((country) => ({
  ...country,
  nameLower: normalize(country.name),
}));

const cities = (locationsData.cities as CityEntry[]).map((city) => ({
  ...city,
  nameLower: normalize(city.name),
  countryLower: normalize(city.country),
  labelLower: normalize(city.label),
}));

// Some globally-used city names are missing in upstream city datasets.
// Keep a small supplemental list here for predictable UX.
const supplementalCities: Array<{ name: string; country: string; label: string }> = [
  { name: "Istanbul", country: "Turkey", label: "Istanbul, Turkey" },
  { name: "Bengaluru", country: "India", label: "Bengaluru, India" },
  { name: "Ho Chi Minh City", country: "Vietnam", label: "Ho Chi Minh City, Vietnam" },
];

for (const city of supplementalCities) {
  const exists = cities.some((entry) => entry.labelLower === normalize(city.label));
  if (exists) continue;
  cities.push({
    ...city,
    nameLower: normalize(city.name),
    countryLower: normalize(city.country),
    labelLower: normalize(city.label),
  });
}

const countryBuckets = new Map<string, number[]>();
const cityBuckets = new Map<string, number[]>();

for (let i = 0; i < countries.length; i += 1) {
  const key = bucketKey(countries[i].name);
  if (!key) continue;
  const arr = countryBuckets.get(key);
  if (arr) arr.push(i);
  else countryBuckets.set(key, [i]);
}

for (let i = 0; i < cities.length; i += 1) {
  const city = cities[i];
  const keys = new Set<string>();
  keys.add(bucketKey(city.name));
  keys.add(bucketKey(city.country));
  for (const key of keys) {
    if (!key) continue;
    const arr = cityBuckets.get(key);
    if (arr) arr.push(i);
    else cityBuckets.set(key, [i]);
  }
}

export function searchLocations(query: string, limit = 8): LocationSuggestion[] {
  const q = normalize(query);
  if (!q) return [];

  const safeLimit = Math.max(1, Math.min(20, limit));
  const results: LocationSuggestion[] = [];
  const seen = new Set<string>();

  const cKey = bucketKey(q);
  const countryCandidates = countryBuckets.get(cKey) ?? [];
  for (const idx of countryCandidates) {
    const country = countries[idx];
    if (!country.nameLower.includes(q)) continue;
    const dedup = `country:${country.nameLower}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    results.push({ label: country.name, value: country.name, type: "country" });
    if (results.length >= safeLimit) return results;
  }

  const cityCandidates = cityBuckets.get(cKey) ?? [];
  for (const idx of cityCandidates) {
    const city = cities[idx];
    const matches =
      city.nameLower.includes(q) || city.countryLower.includes(q) || city.labelLower.includes(q);
    if (!matches) continue;
    const dedup = `city:${city.labelLower}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    results.push({ label: city.label, value: city.label, type: "city" });
    if (results.length >= safeLimit) return results;
  }

  // Fallback full scan in case bucketing misses unicode/transliteration edge cases.
  if (results.length === 0) {
    for (let i = 0; i < countries.length; i += 1) {
      const country = countries[i];
      if (!country.nameLower.includes(q)) continue;
      const dedup = `country:${country.nameLower}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      results.push({ label: country.name, value: country.name, type: "country" });
      if (results.length >= safeLimit) return results;
    }
    for (let i = 0; i < cities.length; i += 1) {
      const city = cities[i];
      const matches =
        city.nameLower.includes(q) || city.countryLower.includes(q) || city.labelLower.includes(q);
      if (!matches) continue;
      const dedup = `city:${city.labelLower}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      results.push({ label: city.label, value: city.label, type: "city" });
      if (results.length >= safeLimit) return results;
    }
  }

  return results;
}
