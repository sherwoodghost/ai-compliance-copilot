import { useState, useEffect } from 'react';

export interface ControlDetail {
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  framework: { name: string; type: string };
  evidenceRequirements: Array<{
    evidenceType: string;
    description: string;
    isMandatory: boolean;
  }>;
  // Flat CrosswalkMapping shape returned by the backend controller
  crosswalkSources: Array<{
    sourceCode: string; sourceTitle: string;
    targetCode: string; targetTitle: string;
    mappingType: string; confidence: string;
    sourceFramework: string; targetFramework: string;
  }>;
  crosswalkTargets: Array<{
    sourceCode: string; sourceTitle: string;
    targetCode: string; targetTitle: string;
    mappingType: string; confidence: string;
    sourceFramework: string; targetFramework: string;
  }>;
}

// Module-level in-memory cache — persists across renders, cleared on page refresh
const cache = new Map<string, ControlDetail>();
const inFlight = new Map<string, Promise<ControlDetail>>();

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function fetchControl(code: string): Promise<ControlDetail> {
  if (inFlight.has(code)) {
    return inFlight.get(code)!;
  }

  const promise = fetch(`${BASE_URL}/controls/library/control/${encodeURIComponent(code)}`)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch control ${code}: ${res.status}`);
      }
      const data: ControlDetail = await res.json();
      cache.set(code, data);
      inFlight.delete(code);
      return data;
    })
    .catch((err) => {
      inFlight.delete(code);
      throw err;
    });

  inFlight.set(code, promise);
  return promise;
}

interface UseControlDetailResult {
  data: ControlDetail | null;
  isLoading: boolean;
  error: string | null;
}

export function useControlDetail(code: string): UseControlDetailResult {
  const cached = cache.get(code);

  const [data, setData] = useState<ControlDetail | null>(cached ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Already cached — no fetch needed
    if (cache.has(code)) {
      setData(cache.get(code)!);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchControl(code)
      .then((detail) => {
        if (!cancelled) {
          setData(detail);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load control');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  return { data, isLoading, error };
}
