import type { NextFunction, Request, Response } from "express";

/** Wraps an async Express handler/middleware so a rejected promise reaches the error middleware instead of hanging the request. */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Req, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
