// Express 4 doesn't catch rejected promises from async handlers.
export const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
