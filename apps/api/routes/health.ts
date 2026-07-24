import { route, type Req, type Res } from '../handler.js';

/** Liveness probe. Deliberately does not touch the database: a health check
 *  that opens a connection turns a slow database into a total outage. */
export default route(['GET'], (_req: Req, res: Res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});
