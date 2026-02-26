import { useState, useEffect } from "react";

// OFAC-sanctioned regions and restricted jurisdictions
const BLOCKED_COUNTRIES = [
  "IR", // Iran
  "KP", // North Korea
  "CU", // Cuba
  "SY", // Syria
  "SD", // Sudan
  "RU", // Russia (Crimea, Donetsk, Luhansk regions)
  "MM", // Myanmar
  "BY", // Belarus
  "VE", // Venezuela
  "ZW", // Zimbabwe
  "SO", // Somalia
  "YE", // Yemen
  "LY", // Libya
];

interface GeoResult {
  isBlocked: boolean;
  country: string | null;
  countryCode: string | null;
  loading: boolean;
  error: string | null;
}

export function useGeoRestriction(): GeoResult {
  const [result, setResult] = useState<GeoResult>({
    isBlocked: false,
    country: null,
    countryCode: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function checkGeo() {
      try {
        // Use a free geo-IP service
        const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error("Geo lookup failed");
        const data = await res.json();
        
        if (cancelled) return;
        
        const code = data.country_code?.toUpperCase() || null;
        setResult({
          isBlocked: code ? BLOCKED_COUNTRIES.includes(code) : false,
          country: data.country_name || null,
          countryCode: code,
          loading: false,
          error: null,
        });
      } catch (err: any) {
        if (cancelled) return;
        // If geo lookup fails, don't block — fail open
        setResult({
          isBlocked: false,
          country: null,
          countryCode: null,
          loading: false,
          error: err.message,
        });
      }
    }

    checkGeo();
    return () => { cancelled = true; };
  }, []);

  return result;
}

export { BLOCKED_COUNTRIES };
