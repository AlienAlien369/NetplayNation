class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
exports.HttpError = HttpError;
exports.bad = (msg, extra) => new HttpError(400, msg, extra);
exports.notFound = (msg = 'Not found') => new HttpError(404, msg);
