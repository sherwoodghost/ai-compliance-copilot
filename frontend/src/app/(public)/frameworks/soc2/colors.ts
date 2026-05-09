// Pure utility — no 'use client' so it can be used from Server Components too
// Used by all 10 framework public reference pages via import from this file.
export function getCategoryColor(category: string): {
  bg: string;
  text: string;
  dot: string;
} {
  const prefix = category.replace(/\s.*/, '');

  // ── SOC 2 Trust Services Criteria ──────────────────────────────────────────
  if (['CC1', 'CC2'].includes(prefix))
    return { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-400'    };
  if (['CC3', 'CC4', 'CC5'].includes(prefix))
    return { bg: 'bg-purple-100',  text: 'text-purple-800',  dot: 'bg-purple-400'  };
  if (['CC6', 'CC7'].includes(prefix))
    return { bg: 'bg-green-100',   text: 'text-green-800',   dot: 'bg-green-400'   };
  if (['CC8', 'CC9'].includes(prefix))
    return { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-400'   };
  if (prefix === 'A1')
    return { bg: 'bg-cyan-100',    text: 'text-cyan-800',    dot: 'bg-cyan-400'    };
  if (prefix === 'C1')
    return { bg: 'bg-rose-100',    text: 'text-rose-800',    dot: 'bg-rose-400'    };
  if (prefix === 'PI1')
    return { bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-400'  };
  if (/^P[1-8]/.test(prefix))
    return { bg: 'bg-pink-100',    text: 'text-pink-800',    dot: 'bg-pink-400'    };

  // ── ISO 27001 Annex A ──────────────────────────────────────────────────────
  if (category.startsWith('A.5') || category === 'Organizational Controls')
    return { bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-400'     };
  if (category.startsWith('A.6') || category === 'People Controls')
    return { bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-400'  };
  if (category.startsWith('A.7') || category === 'Physical Controls')
    return { bg: 'bg-yellow-100',  text: 'text-yellow-800',  dot: 'bg-yellow-400'  };
  if (category.startsWith('A.8') || category === 'Technological Controls')
    return { bg: 'bg-indigo-100',  text: 'text-indigo-800',  dot: 'bg-indigo-400'  };

  // ── GDPR Articles ──────────────────────────────────────────────────────────
  if (category === 'Principles')
    return { bg: 'bg-violet-100',  text: 'text-violet-800',  dot: 'bg-violet-400'  };
  if (category === 'Controller Obligations' || category === 'Accountability')
    return { bg: 'bg-purple-100',  text: 'text-purple-800',  dot: 'bg-purple-400'  };
  if (category === 'Data Subject Rights')
    return { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-400'    };
  if (category === 'Processor Relations')
    return { bg: 'bg-indigo-100',  text: 'text-indigo-800',  dot: 'bg-indigo-400'  };
  if (category === 'Security' || category === 'Technical Measures')
    return { bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-400'     };
  if (category === 'Breach Notification')
    return { bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-400'  };
  if (category === 'DPIA')
    return { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-400'   };
  if (category === 'DPO')
    return { bg: 'bg-yellow-100',  text: 'text-yellow-800',  dot: 'bg-yellow-400'  };
  if (category === 'International Transfers')
    return { bg: 'bg-cyan-100',    text: 'text-cyan-800',    dot: 'bg-cyan-400'    };
  if (category === 'Enforcement')
    return { bg: 'bg-rose-100',    text: 'text-rose-800',    dot: 'bg-rose-400'    };

  // ── ISO 9001 Clauses ───────────────────────────────────────────────────────
  if (category === 'Context')
    return { bg: 'bg-teal-100',    text: 'text-teal-800',    dot: 'bg-teal-400'    };
  if (category === 'Leadership')
    return { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-400' };
  if (category === 'Planning')
    return { bg: 'bg-cyan-100',    text: 'text-cyan-800',    dot: 'bg-cyan-400'    };
  if (category === 'Support')
    return { bg: 'bg-sky-100',     text: 'text-sky-800',     dot: 'bg-sky-400'     };
  if (category === 'Operation')
    return { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-400'    };
  if (category === 'Performance Evaluation')
    return { bg: 'bg-indigo-100',  text: 'text-indigo-800',  dot: 'bg-indigo-400'  };
  if (category === 'Improvement')
    return { bg: 'bg-violet-100',  text: 'text-violet-800',  dot: 'bg-violet-400'  };

  // ── HIPAA Safeguards ───────────────────────────────────────────────────────
  if (category.includes('Administrative Safeguards') || category === 'Administrative')
    return { bg: 'bg-rose-100',    text: 'text-rose-800',    dot: 'bg-rose-400'    };
  if (category.includes('Physical Safeguards') || category === 'Physical')
    return { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-400'   };
  if (category.includes('Technical Safeguards') || category === 'Technical')
    return { bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-400'  };
  if (category.includes('Organizational') || category.includes('Breach Notification Rule'))
    return { bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-400'     };

  // ── PCI DSS Requirements ───────────────────────────────────────────────────
  if (category.includes('Network Security') || category.includes('Req 1') || category.includes('Req 2'))
    return { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-400'    };
  if (category.includes('Account Data') || category.includes('Req 3') || category.includes('Req 4'))
    return { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-400'   };
  if (category.includes('Vulnerability') || category.includes('Req 5') || category.includes('Req 6'))
    return { bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-400'  };
  if (category.includes('Access') || category.includes('Req 7') || category.includes('Req 8') || category.includes('Req 9'))
    return { bg: 'bg-green-100',   text: 'text-green-800',   dot: 'bg-green-400'   };
  if (category.includes('Monitoring') || category.includes('Policy') || category.includes('Req 10') || category.includes('Req 11') || category.includes('Req 12'))
    return { bg: 'bg-purple-100',  text: 'text-purple-800',  dot: 'bg-purple-400'  };

  // ── FedRAMP / NIST SP 800-53 Control Families ──────────────────────────────
  if (category === 'Access Control' || category === 'AC')
    return { bg: 'bg-sky-100',     text: 'text-sky-800',     dot: 'bg-sky-400'     };
  if (category.includes('Audit') || category === 'AU')
    return { bg: 'bg-indigo-100',  text: 'text-indigo-800',  dot: 'bg-indigo-400'  };
  if (category.includes('Incident') || category === 'IR')
    return { bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-400'     };
  if (category.includes('System') || category === 'SC' || category === 'SI')
    return { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-400'    };
  if (category.includes('Contingency') || category === 'CP')
    return { bg: 'bg-cyan-100',    text: 'text-cyan-800',    dot: 'bg-cyan-400'    };
  if (category.includes('Configuration') || category === 'CM')
    return { bg: 'bg-teal-100',    text: 'text-teal-800',    dot: 'bg-teal-400'    };
  if (category.includes('Identification') || category === 'IA')
    return { bg: 'bg-violet-100',  text: 'text-violet-800',  dot: 'bg-violet-400'  };
  if (category.includes('Risk') || category === 'RA')
    return { bg: 'bg-rose-100',    text: 'text-rose-800',    dot: 'bg-rose-400'    };

  // ── NIST CSF 2.0 Functions ─────────────────────────────────────────────────
  if (category.startsWith('GV') || category === 'Govern')
    return { bg: 'bg-slate-100',   text: 'text-slate-800',   dot: 'bg-slate-400'   };
  if (category.startsWith('ID') || category === 'Identify')
    return { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-400'    };
  if (category.startsWith('PR') || category === 'Protect')
    return { bg: 'bg-green-100',   text: 'text-green-800',   dot: 'bg-green-400'   };
  if (category.startsWith('DE') || category === 'Detect')
    return { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-400'   };
  if (category.startsWith('RS') || category === 'Respond')
    return { bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-400'  };
  if (category.startsWith('RC') || category === 'Recover')
    return { bg: 'bg-teal-100',    text: 'text-teal-800',    dot: 'bg-teal-400'    };

  // ── ISO 14001 EMS Clauses ──────────────────────────────────────────────────
  if (category.includes('Environmental') || category.startsWith('Clause 6') || category.startsWith('Clause 8'))
    return { bg: 'bg-green-100',   text: 'text-green-800',   dot: 'bg-green-400'   };

  // ── ISO 45001 OHSMS Clauses ────────────────────────────────────────────────
  if (category.includes('Hazard') || category.includes('OH&S') || category.includes('OHS'))
    return { bg: 'bg-yellow-100',  text: 'text-yellow-800',  dot: 'bg-yellow-400'  };
  if (category.includes('Worker') || category.includes('Participation'))
    return { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-400'   };

  // ── Generic clause-based fallback (ISO 9001 / ISO 14001 / ISO 45001 style) ─
  const clauseMatch = category.match(/^Clause\s+(\d+)/i);
  if (clauseMatch) {
    const clauseNum = parseInt(clauseMatch[1], 10);
    if (clauseNum === 4) return { bg: 'bg-sky-100',    text: 'text-sky-800',    dot: 'bg-sky-400'    };
    if (clauseNum === 5) return { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-400' };
    if (clauseNum === 6) return { bg: 'bg-cyan-100',   text: 'text-cyan-800',   dot: 'bg-cyan-400'   };
    if (clauseNum === 7) return { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-400'   };
    if (clauseNum === 8) return { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-400' };
    if (clauseNum === 9) return { bg: 'bg-violet-100', text: 'text-violet-800', dot: 'bg-violet-400' };
    if (clauseNum === 10) return { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-400' };
  }

  // ── Default ────────────────────────────────────────────────────────────────
  return { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };
}
