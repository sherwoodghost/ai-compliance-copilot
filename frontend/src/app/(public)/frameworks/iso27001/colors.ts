// Pure utility — no 'use client' so it can be used from Server Components too
export function getCategoryColor(category: string): {
  bg: string;
  text: string;
  dot: string;
} {
  if (category.startsWith('A.5'))
    return { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-400'    };
  if (category.startsWith('A.6'))
    return { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-400' };
  if (category.startsWith('A.7'))
    return { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-400' };
  // A.8 + fallback
  return   { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-400' };
}
