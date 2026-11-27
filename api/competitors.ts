import { INITIAL_COMPETITORS } from '../src/logic';
import {
  enforceMethod,
  sendJson,
  type VercelLikeRequest,
  type VercelLikeResponse,
} from '../src/services/vercelHttp';

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
): Promise<void> {
  if (!enforceMethod(req, res, 'GET')) return;
  sendJson(res, 200, INITIAL_COMPETITORS);
}
