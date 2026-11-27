import type { IncomingMessage, ServerResponse } from 'node:http';

export interface VercelLikeRequest extends IncomingMessage {
  body?: unknown;
  query?: Record<string, string | string[]>;
}

export interface VercelLikeResponse extends ServerResponse {
  status?: (code: number) => VercelLikeResponse;
  json?: (body: unknown) => void;
}

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024; // 1 MB

export function sendJson(
  res: VercelLikeResponse,
  statusCode: number,
  payload: unknown,
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function enforceMethod(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
  allowedMethod: 'GET' | 'POST',
): boolean {
  if (req.method === allowedMethod) {
    return true;
  }
  res.setHeader('Allow', allowedMethod);
  sendJson(res, 405, {
    detail: `Method ${req.method || 'UNKNOWN'} not allowed. Use ${allowedMethod}.`,
  });
  return false;
}

export async function readJsonBody(
  req: VercelLikeRequest,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<Record<string, unknown>> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Array.isArray(req.body)) {
      return req.body as Record<string, unknown>;
    }
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body, 'utf8') > maxBytes) {
        throw new Error('Request body exceeds maximum allowed size.');
      }
      const parsed = req.body.trim() ? JSON.parse(req.body) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      throw new Error('Request body must be a JSON object.');
    }
  }

  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    let rejected = false;

    req.on('data', (chunk: Buffer | string) => {
      if (rejected) return;
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      size += buf.length;
      if (size > maxBytes) {
        rejected = true;
        reject(new Error('Request body exceeds maximum allowed size.'));
        return;
      }
      raw += buf.toString('utf8');
    });

    req.on('end', () => {
      if (rejected) return;
      try {
        const parsed = raw.trim() ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          resolve(parsed as Record<string, unknown>);
        } else {
          reject(new Error('Request body must be a JSON object.'));
        }
      } catch {
        reject(new Error('Malformed JSON request body.'));
      }
    });

    req.on('error', () => {
      if (!rejected) {
        rejected = true;
        reject(new Error('Failed to read request body.'));
      }
    });
  });
}
