// Pure utility — no 'use client' so it can be used from Server Components too
export function getCategoryColor(category: string): {
  bg: string;
  text: string;
  dot: string;
} {
  const prefix = category.replace(/\s.*/, '');
  if (['CC1', 'CC2'].includes(prefix))
    return { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-400'   };
  if (['CC3', 'CC4', 'CC5'].includes(prefix))
    return { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-400' };
  if (['CC6', 'CC7'].includes(prefix))
    return { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-400'  };
  if (['CC8', 'CC9'].includes(prefix))
    return { bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-400'  };
  if (prefix === 'A1')
    return { bg: 'bg-cyan-100',   text: 'text-cyan-800',   dot: 'bg-cyan-400'   };
  if (prefix === 'C1')
    return { bg: 'bg-rose-100',   text: 'text-rose-800',   dot: 'bg-rose-400'   };
  if (prefix === 'PI1')
    return { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-400' };
  // P1–P8
  return   { bg: 'bg-pink-100',   text: 'text-pink-800',   dot: 'bg-pink-400'   };
}
