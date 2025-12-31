// Mini-runtime: uniquement un mécanisme de "session" pour invalider/annuler des animations en cours.
// On évite volontairement tout système de phases/state global.

let sessionId = 0;

export function getSession() {
  return sessionId;
}

export function bumpSession() {
  sessionId += 1;
  return sessionId;
}
