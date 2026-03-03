import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { City, Country } from "country-state-city";

type Output = {
  version: number;
  generatedAt: string;
  counts: { countries: number; cities: number };
  countries: Array<{ name: string }>;
  cities: Array<{ name: string; country: string; label: string }>;
};

function main() {
  const countriesRaw = Country.getAllCountries();
  const citiesRaw = City.getAllCities();

  const countries = countriesRaw
    .map((country) => ({ name: country.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const countryByCode = new Map(countriesRaw.map((country) => [country.isoCode, country.name]));

  const seenCity = new Set<string>();
  const cities: Output["cities"] = [];
  for (const city of citiesRaw) {
    const countryName = countryByCode.get(city.countryCode) ?? city.countryCode;
    const label = `${city.name}, ${countryName}`;
    const key = label.toLowerCase();
    if (seenCity.has(key)) continue;
    seenCity.add(key);
    cities.push({
      name: city.name,
      country: countryName,
      label,
    });
  }
  cities.sort((a, b) => a.label.localeCompare(b.label));

  const output: Output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    counts: {
      countries: countries.length,
      cities: cities.length,
    },
    countries,
    cities,
  };

  const outputPath = join(process.cwd(), "src", "data", "locations.json");
  writeFileSync(outputPath, JSON.stringify(output));
  console.log(`Wrote ${outputPath}`);
  console.log(`countries=${countries.length}, cities=${cities.length}`);
}

main();
