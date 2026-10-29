'use strict';

// Apply the same homepage HTTP-error rule during collection and later analysis.
// Missing status values in legacy records are not treated as HTTP errors.
function isHttpErrorStatus(status) {
  const code = Number(status);
  return Number.isInteger(code) && code >= 400 && code < 600;
}

module.exports = { isHttpErrorStatus };
