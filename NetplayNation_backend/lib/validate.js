const { z } = require('zod');
const { bad } = require('./http');

// Parses data or throws a 400 whose message is the first human-readable problem.
exports.parse = (schema, data) => {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const field = String(issue.path.at(-1) ?? '');
  const label = field.charAt(0).toUpperCase() + field.slice(1);
  throw bad(field ? `${label}: ${issue.message}` : issue.message);
};

exports.objectId = z.string().regex(/^[a-f\d]{24}$/i, 'invalid id');
exports.z = z;
