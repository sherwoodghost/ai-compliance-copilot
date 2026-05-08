'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

type FlagMap = Record<string, boolean>;

let cache: FlagMap | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches feature flags for the current org from the backend.
 * Results are cached in-memory for 5 minutes to avoid hammering the API.
 */
export function useFeatureFlags(): { flags: FlagMap; loading: boolean } {
  const [flags, setFlags]     = useState<FlagMap>(cache ?? {});
  const [loading, setLoading] = useState<boolean>(!cache || Date.now() > cacheExpiry);

  useEffect(() => {
    if (cache && Date.now() < cacheExpiry) {
      setFlags(cache);
      setLoading(false);
      return;
    }

    apiClient
      .get<FlagMap>('/feature-flags')
      .then(({ data }) => {
        cache        = data;
        cacheExpiry  = Date.now() + CACHE_TTL;
        setFlags(data);
      })
      .catch(() => {
        // Fail open — missing flags default to false
        setFlags({});
      })
      .finally(() => setLoading(false));
  }, []);

  return { flags, loading };
}

/**
 * Checks a single feature flag.
 * @example
 *   const aiEnabled = useFlag('documents.aiFeatures');
 */
export function useFlag(key: string): boolean {
  const { flags } = useFeatureFlags();
  return flags[key] ?? false;
}
