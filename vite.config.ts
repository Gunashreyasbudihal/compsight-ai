import { defineConfig, Plugin } from 'vite';
import {
  INITIAL_COMPETITORS,
  normalizeCompetitorUrl,
} from './src/logic';
import { buildCompetitorFromSnapshot } from './src/services/intelligenceService';
import {
  runServerAnalystQuery,
  runServerCompetitorResearch,
} from './src/services/serverGemini';
import { Competitor } from './src/types';

function compSightApiPlugin(): Plugin {
  let competitors: Competitor[] = [...INITIAL_COMPETITORS];

  const readJsonBody = (
    req: import('http').IncomingMessage,
  ): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });

  return {
    name: 'compsight-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        const urlObj = new URL(req.url, 'http://localhost:3000');
        res.setHeader('Content-Type', 'application/json');

        // 1. Live 360° Gemini Search Grounding Research Endpoint
        if (
          req.method === 'POST' &&
          urlObj.pathname === '/api/intelligence/research'
        ) {
          try {
            const payload = await readJsonBody(req);
            const validation = normalizeCompetitorUrl(
              String(payload.url || payload.brandName || ''),
            );
            if (!validation.valid) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  detail: validation.error || 'Invalid competitor input',
                }),
              );
              return;
            }
            const result = await runServerCompetitorResearch({
              brandName: validation.brandName,
              domain: validation.domain,
              url: validation.url,
              isRescan: Boolean(payload.isRescan),
            });
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err) {
            const detail =
              err instanceof Error
                ? err.message
                : 'Live Gemini intelligence research failed.';
            res.statusCode = 500;
            res.end(JSON.stringify({ detail }));
          }
          return;
        }

        // 2. Interactive AI Analyst ("Ask CompSight AI") Endpoint
        if (
          req.method === 'POST' &&
          urlObj.pathname === '/api/intelligence/ask'
        ) {
          try {
            const payload = await readJsonBody(req);
            const question = String(payload.question || '');
            const competitor = (payload.competitor ||
              competitors[0] ||
              {}) as Partial<Competitor>;
            const history = Array.isArray(payload.history)
              ? (payload.history as { role: string; content: string }[])
              : [];
            const answer = await runServerAnalystQuery({
              question,
              competitor,
              history,
            });
            res.statusCode = 200;
            res.end(JSON.stringify({ answer }));
          } catch (err) {
            const detail =
              err instanceof Error
                ? err.message
                : 'CompSight AI Analyst query failed.';
            res.statusCode = 500;
            res.end(JSON.stringify({ detail }));
          }
          return;
        }

        // 3. Existing FastAPI-compatible endpoints (/api/competitors, /api/competitors/:id, /api/analyze)
        if (req.method === 'GET' && urlObj.pathname === '/api/competitors') {
          res.statusCode = 200;
          res.end(JSON.stringify(competitors));
          return;
        }

        if (
          req.method === 'GET' &&
          urlObj.pathname.startsWith('/api/competitors/')
        ) {
          const id = decodeURIComponent(
            urlObj.pathname.replace('/api/competitors/', ''),
          );
          const found = competitors.find((c) => c.id === id);
          if (found) {
            res.statusCode = 200;
            res.end(JSON.stringify(found));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ detail: 'Competitor not found' }));
          }
          return;
        }

        if (req.method === 'POST' && urlObj.pathname === '/api/analyze') {
          try {
            const payload = await readJsonBody(req);
            const validation = normalizeCompetitorUrl(
              String(payload.url || ''),
            );
            if (!validation.valid) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  detail: validation.error || 'Invalid URL',
                }),
              );
              return;
            }
            const existing = competitors.find(
              (c) =>
                c.domain.toLowerCase() === validation.domain.toLowerCase(),
            );
            const research = await runServerCompetitorResearch({
              brandName: validation.brandName,
              domain: validation.domain,
              url: validation.url,
              isRescan: Boolean(existing),
            });
            const { competitor } = buildCompetitorFromSnapshot(
              validation,
              research.dossier,
              existing,
            );
            const idx = competitors.findIndex((c) => c.id === competitor.id);
            if (idx >= 0) {
              competitors[idx] = competitor;
            } else {
              competitors = [competitor, ...competitors];
            }
            res.statusCode = 200;
            res.end(JSON.stringify(competitor));
          } catch (err) {
            const detail =
              err instanceof Error
                ? err.message
                : 'Live analysis failed.';
            res.statusCode = 500;
            res.end(JSON.stringify({ detail }));
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [compSightApiPlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
