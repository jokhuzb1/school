export function sendHttpError(reply: any, err: any) {
  const status = err?.statusCode || 500;
  if (status === 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  return reply.status(status).send({ error: err?.message || 'error' });
}
