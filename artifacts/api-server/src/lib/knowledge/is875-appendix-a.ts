import type { ExtractedPage } from "./extractor";

const CITY_NAMES = [
  "Agra",
  "Ahmadabad",
  "Ajmer",
  "Almora",
  "Amritsar",
  "Asansol",
  "Aurangabad",
  "Bahraich",
  "Bangalore",
  "Barauni",
  "Bareilly",
  "Bhatinda",
  "Bhilai",
  "Bhopal",
  "Bhubaneshwar",
  "Bhuj",
  "Bikaner",
  "Bokaro",
  "Bombay",
  "Calcutta",
  "Calicut",
  "Chandigarh",
  "Coimbatore",
  "Cuttack",
  "Darbhanga",
  "Darjeeling",
  "Dehra Dun",
  "Delhi",
  "Durgapur",
  "Gangtok",
  "Gauhati",
  "Gaya",
  "Gorakhpur",
  "Hyderabad",
  "Imphal",
  "Jabalpur",
  "Jaipur",
  "Jamshedpur",
  "Jhansi",
  "Jodhpur",
  "Kanpur",
  "Kohima",
  "Kurnool",
  "Lucknow",
  "Ludhiana",
  "Madras",
  "Madurai",
  "Mandi",
  "Mangalore",
  "Moradabad",
  "Mysore",
  "Nagpur",
  "Nainital",
  "Nasik",
  "Nellore",
  "Panjim",
  "Patiala",
  "Patna",
  "Pondicherry",
  "Port Blair",
  "Pune",
  "Raipur",
  "Rajkot",
  "Ranchi",
  "Roorkee",
  "Rourkela",
  "Simla",
  "Srinagar",
  "Surat",
  "Trivandrum",
  "Udaipur",
  "Vadodara",
  "Varanasi",
  "Vijaywada",
  "Lakshadweep",
  "Tiruchchirrappalli",
  "Visakhapatnam",
];

const SPEEDS = [
  47, 39, 47, 47, 47, 47, 39, 47, 33, 47,
  47, 47, 39, 39, 50, 50, 47, 47, 44, 50,
  39, 47, 39, 50, 55, 47, 47, 47, 47, 47,
  53,
  47, 47, 47, 44, 39, 39, 47, 47, 50, 39,
  39, 39, 47, 33, 44, 47, 39, 50, 39, 47,
  47, 50, 44, 39, 39, 39, 39, 39, 39, 39,
  39, 44, 47, 39, 47, 44, 47, 50, 50,
];

export function normalizeIS875AppendixA(
  pages: ExtractedPage[],
): ExtractedPage[] {
  const appendixPages = pages.filter((page) =>
    page.text.includes("APPENDIX A"),
  );

  if (appendixPages.length === 0) {
    return pages;
  }

  const cityIndex = new Map(
    CITY_NAMES.map((city, index) => [city.toLowerCase(), index]),
  );

  const appendixText = appendixPages
    .map((page) => page.text)
    .join("\n");

  const foundCities = CITY_NAMES.filter((city) =>
    appendixText.toLowerCase().includes(city.toLowerCase()),
  );

  if (foundCities.length === 0) {
    return pages;
  }

  const normalizedTable = [
    "IS 875 Part 3 — Appendix A",
    "BASIC WIND SPEED AT 10 m HEIGHT FOR SOME IMPORTANT CITIES/TOWNS",
    "",
    ...foundCities
      .map((city) => {
        const index = cityIndex.get(city.toLowerCase());

        if (index === undefined || SPEEDS[index] === undefined) {
          return null;
        }

        return `${city}: ${SPEEDS[index]} m/s`;
      })
      .filter(Boolean),
  ].join("\n");

  return pages.map((page) => {
    if (!page.text.includes("APPENDIX A")) {
      return page;
    }

    return {
      ...page,
      text: `${page.text}\n\n${normalizedTable}`,
    };
  });
}