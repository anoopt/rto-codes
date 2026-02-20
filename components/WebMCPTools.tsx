'use client';

import { useEffect } from 'react';
import { getSearchTerms, matchesNormalized, normalize } from '@/lib/search-utils';
import type { RTOCode } from '@/types/rto';

interface WebMCPToolsProps {
  rtos: RTOCode[];
}

/**
 * Registers WebMCP tools on the page so Chrome's in-browser AI agents
 * can discover and invoke them via `navigator.modelContext`.
 *
 * Requires Chrome 146+ with the WebMCP flag enabled.
 */
export default function WebMCPTools({ rtos }: WebMCPToolsProps) {
  useEffect(() => {
    const mc = navigator.modelContext;
    if (!mc) return;

    mc.provideContext({
      tools: [
        // ── search_rtos ──────────────────────────────────────────────
        {
          name: 'search_rtos',
          description:
            'Search Indian RTO (Regional Transport Office) codes by a query string. ' +
            'Matches against RTO code, region name, city, district, and jurisdiction areas. ' +
            'Use for questions like: "What is the RTO code for Patna?", ' +
            '"Where is Hospet RTO located?", "Which areas come under KA-53?", ' +
            '"Find RTOs in HSR Layout".',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query — a city name, RTO code, district, or locality.',
              },
            },
            required: ['query'],
          },
          execute: ({ query }) => {
            const q = String(query ?? '').toLowerCase().trim();
            if (!q) {
              return { content: [{ type: 'text', text: 'Please provide a search query.' }] };
            }

            const terms = getSearchTerms(q);
            const results = rtos.filter(
              (rto) =>
                matchesNormalized(rto.code, terms) ||
                matchesNormalized(rto.region, terms) ||
                matchesNormalized(rto.city, terms) ||
                (rto.district && matchesNormalized(rto.district, terms)) ||
                (rto.jurisdictionAreas &&
                  rto.jurisdictionAreas.some((a) => matchesNormalized(a, terms))),
            );

            // Update the UI: if on homepage, filter the grid; otherwise navigate to homepage with search
            if (window.location.pathname === '/') {
              window.dispatchEvent(new CustomEvent('webmcpSearch', { detail: String(query) }));
            } else {
              window.location.href = `/?search=${encodeURIComponent(String(query))}`;
            }

            if (results.length === 0) {
              return { content: [{ type: 'text', text: `No RTOs found for "${query}".` }] };
            }

            const items = results.map((r) => ({
              code: r.code,
              region: r.region,
              city: r.city,
              district: r.district ?? null,
              state: r.state,
              status: r.status ?? 'active',
            }));

            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${results.length} RTO(s) matching "${query}":\n${JSON.stringify(items, null, 2)}`,
                },
              ],
            };
          },
        },

        // ── get_rto_details ──────────────────────────────────────────
        {
          name: 'get_rto_details',
          description:
            'Get full details for a single RTO by its code. ' +
            'Returns region, city, district, address, phone, email, pin code, coverage, jurisdiction areas, established year, and status. ' +
            'Use for questions like: "What is the phone number of KA-22?", ' +
            '"What are the contact details for MH-12?", ' +
            '"When was DL-01 established?", "What pin code does the Hubli RTO have?".',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'The RTO code, e.g. "KA-01" or "MH-12".',
              },
            },
            required: ['code'],
          },
          execute: ({ code }) => {
            const c = String(code ?? '').trim();
            const rto = rtos.find((r) => r.code.toLowerCase() === c.toLowerCase());

            if (!rto) {
              return { content: [{ type: 'text', text: `No RTO found with code "${c}".` }] };
            }

            // Navigate to the RTO detail page so the user sees the result
            window.location.href = `/rto/${rto.code.toLowerCase()}`;

            return { content: [{ type: 'text', text: JSON.stringify(rto, null, 2) }] };
          },
        },

        // ── get_district_rtos ────────────────────────────────────────
        {
          name: 'get_district_rtos',
          description:
            'Get all RTO offices in a specific district. ' +
            'Use for questions like: "How many RTOs are in Belgaum district?", ' +
            '"List all RTOs in Dakshina Kannada", "Which RTOs cover Pune district?". ' +
            'Supports alternate names (e.g., Belgaum for Belagavi, Mangalore for Mangaluru).',
          inputSchema: {
            type: 'object',
            properties: {
              district: {
                type: 'string',
                description: 'District name, e.g. "Bengaluru Urban", "Pune", "Belagavi".',
              },
            },
            required: ['district'],
          },
          execute: ({ district }) => {
            const d = String(district ?? '').toLowerCase().trim();
            // Try multiple search terms (handles Belgaum→Belagavi, etc.)
            const terms = getSearchTerms(d);
            const results = rtos.filter(
              (rto) => rto.district && terms.some((term) => normalize(rto.district!) === term),
            );

            if (results.length === 0) {
              return {
                content: [{ type: 'text', text: `No RTOs found in district "${district}".` }],
              };
            }

            // Update the UI: search by district name so the user sees filtered results
            if (window.location.pathname === '/') {
              window.dispatchEvent(new CustomEvent('webmcpSearch', { detail: String(district) }));
            } else {
              window.location.href = `/?search=${encodeURIComponent(String(district))}`;
            }

            const items = results.map((r) => ({
              code: r.code,
              region: r.region,
              city: r.city,
              state: r.state,
              status: r.status ?? 'active',
            }));

            return {
              content: [
                {
                  type: 'text',
                  text: `${results.length} RTO(s) in ${district} district:\n${JSON.stringify(items, null, 2)}`,
                },
              ],
            };
          },
        },

        // ── get_stats ────────────────────────────────────────────────
        {
          name: 'get_stats',
          description:
            'Get statistics about the RTO codes database. ' +
            'Use for questions like: "How many RTOs are there in India?", ' +
            '\"How many states are covered?\", \"Which state has the most RTOs?\".',
          inputSchema: {
            type: 'object',
            properties: {},
          },
          execute: () => {
            const states = new Map<string, number>();
            let active = 0;

            for (const rto of rtos) {
              states.set(rto.state, (states.get(rto.state) || 0) + 1);
              if (rto.status !== 'not-in-use' && rto.status !== 'discontinued') {
                active++;
              }
            }

            const districts = new Set(rtos.map((r) => r.district).filter(Boolean));

            const perState = Array.from(states.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, count]) => ({ state: name, totalRTOs: count }));

            const stats = {
              totalRTOs: rtos.length,
              activeRTOs: active,
              statesAndUTs: states.size,
              districts: districts.size,
              perState,
            };

            return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
          },
        },
      ],
    });

    return () => {
      mc.clearContext();
    };
  }, [rtos]);

  // This component renders nothing — it only registers WebMCP tools
  return null;
}
