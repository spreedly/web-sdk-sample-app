import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  status?: number;
  // Set by body-parser, e.g. 'entity.parse.failed' or 'entity.too.large'.
  type?: string;
}

// Never log the error object. A JSON parse error carries the raw request body, and an
// axios error carries the Authorization header.
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  console.error(`${req.method} ${req.path} failed: ${status} ${err.type || err.name || 'Error'}`);
  res.status(status).json({
    message: status < 500 ? 'Bad request' : 'Internal Server Error',
  });
};
