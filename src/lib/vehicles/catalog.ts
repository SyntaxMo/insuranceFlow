export type VehicleMake = {
  name: string;
  logo?: string;
  models: readonly string[];
};

export const VEHICLE_CATALOG: readonly VehicleMake[] = [
  { name: "Toyota", logo: "/vehicle-brands/toyota.svg", models: ["Corolla", "Corolla Cross", "Camry", "Yaris", "RAV4", "Raize", "Urban Cruiser", "Veloz", "Highlander", "Land Cruiser", "Fortuner", "Prado", "Innova", "Hilux", "GR86"] },
  { name: "Nissan", logo: "/vehicle-brands/nissan.svg", models: ["Sunny", "Sentra", "Altima", "Maxima", "Kicks", "Magnite", "X-Trail", "Patrol", "Patrol Safari", "Pathfinder", "Navara", "Z"] },
  { name: "Kia", logo: "/vehicle-brands/kia.svg", models: ["Picanto", "Rio", "Pegas", "Cerato", "K5", "Sonet", "Seltos", "Sportage", "Sorento", "Carens", "Carnival", "Telluride", "EV6"] },
  { name: "Hyundai", logo: "/vehicle-brands/hyundai.svg", models: ["Grand i10", "Accent", "Elantra", "Sonata", "Azera", "Venue", "Creta", "Tucson", "Santa Fe", "Palisade", "Kona", "Ioniq 5"] },
  { name: "Honda", logo: "/vehicle-brands/honda.svg", models: ["City", "Civic", "Civic Type R", "Accord", "HR-V", "ZR-V", "CR-V", "Pilot", "Odyssey"] },
  { name: "Mazda", logo: "/vehicle-brands/mazda.svg", models: ["Mazda 3", "Mazda 6", "MX-5", "CX-3", "CX-30", "CX-5", "CX-50", "CX-60", "CX-9", "CX-90"] },
  { name: "Mitsubishi", logo: "/vehicle-brands/mitsubishi.svg", models: ["Attrage", "Lancer", "ASX", "Eclipse Cross", "Outlander", "Xpander", "Pajero", "Montero Sport", "L200"] },
  { name: "Lexus", logo: "/vehicle-brands/lexus-logo.png", models: ["IS", "ES", "LS", "RC", "LC", "UX", "NX", "RX", "GX", "LX", "LM"] },
  { name: "BMW", logo: "/vehicle-brands/bmw.svg", models: ["1 Series", "2 Series", "3 Series", "4 Series", "5 Series", "7 Series", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "i4", "iX"] },
  { name: "Mercedes-Benz", logo: "/vehicle-brands/mercedes-benz-logo.svg", models: ["A-Class", "CLA", "C-Class", "E-Class", "CLS", "S-Class", "GLA", "GLC", "GLE", "GLS", "G-Class", "V-Class", "EQE", "EQS"] },
  { name: "Audi", logo: "/vehicle-brands/audi.svg", models: ["A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q5", "Q7", "Q8", "e-tron GT"] },
  { name: "Volkswagen", logo: "/vehicle-brands/volkswagen.svg", models: ["Polo", "Golf", "Jetta", "Passat", "Virtus", "T-Roc", "Taos", "Tiguan", "Teramont", "Touareg", "ID.4"] },
  { name: "Ford", logo: "/vehicle-brands/ford.svg", models: ["Taurus", "Territory", "Escape", "Edge", "Explorer", "Expedition", "Bronco", "Everest", "Ranger", "F-150", "Mustang"] },
  { name: "Chevrolet", logo: "/vehicle-brands/chevrolet.svg", models: ["Groove", "Captiva", "Trailblazer", "Traverse", "Malibu", "Tahoe", "Suburban", "Silverado", "Camaro", "Corvette"] },
  { name: "GMC", logo: "/vehicle-brands/gmc-logo.png", models: ["Terrain", "Acadia", "Yukon", "Yukon XL", "Sierra", "Canyon", "Hummer EV"] },
  { name: "Jeep", logo: "/vehicle-brands/jeep.svg", models: ["Renegade", "Compass", "Wrangler", "Cherokee", "Grand Cherokee", "Wagoneer", "Grand Wagoneer", "Gladiator"] },
  { name: "Dodge", logo: "/vehicle-brands/dodge-logo.png", models: ["Charger", "Challenger", "Durango", "Journey", "Hornet"] },
  { name: "Tesla", logo: "/vehicle-brands/tesla.svg", models: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"] },
  { name: "Porsche", logo: "/vehicle-brands/porsche.svg", models: ["718", "911", "Taycan", "Macan", "Cayenne", "Panamera"] },
  { name: "Land Rover", logo: "/vehicle-brands/land-rover-logo.svg", models: ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Sport", "Range Rover Velar", "Range Rover Evoque"] },
  { name: "Volvo", logo: "/vehicle-brands/volvo.svg", models: ["S60", "S90", "V60", "XC40", "XC60", "XC90", "C40", "EX30", "EX90"] },
  { name: "Subaru", logo: "/vehicle-brands/subaru.svg", models: ["Impreza", "Legacy", "Crosstrek", "Forester", "Outback", "WRX", "BRZ", "Solterra"] },
  { name: "Suzuki", logo: "/vehicle-brands/suzuki.svg", models: ["Swift", "Dzire", "Baleno", "Ciaz", "Jimny", "Vitara", "Grand Vitara", "Ertiga", "Fronx", "Carry"] },
  { name: "Infiniti", logo: "/vehicle-brands/infiniti.svg", models: ["Q30", "Q50", "Q60", "QX50", "QX55", "QX60", "QX70", "QX80"] },
  { name: "Genesis", logo: "/vehicle-brands/genesis-logo.svg", models: ["G70", "G80", "G90", "GV60", "GV70", "GV80"] },
  { name: "Peugeot", logo: "/vehicle-brands/peugeot.svg", models: ["208", "308", "408", "508", "2008", "3008", "5008", "Rifter", "Partner", "Landtrek"] },
  { name: "Renault", logo: "/vehicle-brands/renault.svg", models: ["Symbol", "Megane", "Captur", "Arkana", "Koleos", "Duster", "Talisman", "Express"] },
  { name: "MG", logo: "/vehicle-brands/mg.svg", models: ["MG 3", "MG 4", "MG 5", "MG 6", "ZS", "ZS EV", "HS", "RX5", "RX8", "One", "Cyberster"] },
  { name: "Geely", logo: "/vehicle-brands/geely-logo.svg", models: ["Emgrand", "Coolray", "Geometry C", "Azkarra", "Preface", "Monjaro", "Okavango", "Starray"] },
  { name: "Changan", logo: "/vehicle-brands/changan-logo.png", models: ["Alsvin", "Eado Plus", "CS35 Plus", "CS55 Plus", "CS75 Plus", "CS95", "UNI-T", "UNI-V", "UNI-K"] },
  { name: "BYD", logo: "/vehicle-brands/byd-logo.svg", models: ["Dolphin", "Atto 3", "Seal", "Seal U", "Qin Plus", "Han", "Song Plus", "Tang"] },
  { name: "Isuzu", logo: "/vehicle-brands/isuzu-logo.svg", models: ["D-Max", "MU-X", "N-Series"] },
  { name: "Cadillac", logo: "/vehicle-brands/cadillac-logo.png", models: ["CT4", "CT5", "XT4", "XT5", "XT6", "LYRIQ", "Escalade", "Escalade IQ"] },
] as const;

export const MAX_AUTOCOMPLETE_SUGGESTIONS = 8;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

export function findVehicleMake(value: string): VehicleMake | undefined {
  const query = normalized(value);
  return VEHICLE_CATALOG.find((make) => normalized(make.name) === query);
}

function rankedMatches(values: readonly string[], query: string): string[] {
  const normalizedQuery = normalized(query);
  if (!normalizedQuery) return values.slice(0, MAX_AUTOCOMPLETE_SUGGESTIONS);
  return values
    .filter((value) => normalized(value).includes(normalizedQuery))
    .sort((left, right) => {
      const leftStarts = normalized(left).startsWith(normalizedQuery);
      const rightStarts = normalized(right).startsWith(normalizedQuery);
      return Number(rightStarts) - Number(leftStarts) || left.localeCompare(right);
    })
    .slice(0, MAX_AUTOCOMPLETE_SUGGESTIONS);
}

export function filterVehicleMakes(query: string): VehicleMake[] {
  const names = rankedMatches(VEHICLE_CATALOG.map((make) => make.name), query);
  return names.map((name) => VEHICLE_CATALOG.find((make) => make.name === name)!);
}

export function filterVehicleModels(makeValue: string, query: string): string[] {
  const make = findVehicleMake(makeValue);
  return make ? rankedMatches(make.models, query) : [];
}

export const VEHICLE_CATALOG_MODEL_COUNT = VEHICLE_CATALOG.reduce(
  (total, make) => total + make.models.length,
  0,
);
