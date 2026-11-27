import { normalizeCompetitorInput } from '../../src/services/intelligenceService';
import { runServerCompetitorResearch } from '../../src/services/serverGemini';
import {
  enforceMethod,
  readJsonBody,
  sendJson,
  type VercelLikeRequest,
  type VercelLikeResponse,
} from '../../src/services/vercelHttp';

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
): Promise<void> {
  if (!enforceMethod(req, res, 'POST')) return;

  let payload: Record<string, unknown>;
  try {
    payload = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, {
      detail: err instanceof Error ? err.message : 'Invalid JSON request body.',
    });
    return;
  }

  const rawTarget = String(payload.url || payload.brandName || '');
  const validation = normalizeCompetitorInput(rawTarget);
  if (!validation.valid) {
    sendJson(res, 400, {
      detail: validation.error || 'Invalid competitor input.',
    });
    return;
  }

  try {
    const result = await runServerCompetitorResearch({
      brandName: validation.brandName,
      domain: validation.domain,
      url: validation.url,
      isRescan: Boolean(payload.isRescan),
    });
    sendJson(res, 200, result);
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : 'Live Gemini intelligence research failed.';
    sendJson(res, 500, { detail });
  }
}
