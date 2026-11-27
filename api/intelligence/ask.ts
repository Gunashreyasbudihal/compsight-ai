import { INITIAL_COMPETITORS } from '../../src/logic';
import { runServerAnalystQuery } from '../../src/services/serverGemini';
import {
  enforceMethod,
  readJsonBody,
  sendJson,
  type VercelLikeRequest,
  type VercelLikeResponse,
} from '../../src/services/vercelHttp';
import type { Competitor } from '../../src/types';

const MAX_QUESTION_CHARS = 4000;
const MAX_HISTORY_TURNS = 20;

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

  const question = String(payload.question || '').trim();
  if (!question) {
    sendJson(res, 400, { detail: 'Enter a question for CompSight AI.' });
    return;
  }
  if (question.length > MAX_QUESTION_CHARS) {
    sendJson(res, 400, {
      detail: `Question is too long (maximum ${MAX_QUESTION_CHARS} characters).`,
    });
    return;
  }

  const competitor = (
    payload.competitor && typeof payload.competitor === 'object'
      ? payload.competitor
      : INITIAL_COMPETITORS[0] || {}
  ) as Partial<Competitor>;

  const history = Array.isArray(payload.history)
    ? payload.history
        .slice(-MAX_HISTORY_TURNS)
        .filter(
          (item): item is { role: string; content: string } =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as Record<string, unknown>).content === 'string',
        )
        .map((item) => ({
          role: String(item.role || 'user'),
          content: item.content.slice(0, MAX_QUESTION_CHARS),
        }))
    : [];

  try {
    const answer = await runServerAnalystQuery({
      question,
      competitor,
      history,
    });
    sendJson(res, 200, { answer });
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : 'CompSight AI Analyst query failed.';
    sendJson(res, 500, { detail });
  }
}
