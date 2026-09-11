/* Transport-independent synchronization. read() returns {history, revision} or null.
   write(history, revision) must reject stale revisions with code CONFLICT. */
(function (root) {
  'use strict';
  const H = typeof module !== 'undefined' && module.exports ? require('./history.js') : root.WorkoutHistory;
  async function synchronize(store, { date, intent = null, initialize = null }) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const saved = await store.read();
      if (!saved && !initialize) throw new Error('No online history was found. A new device cannot reset or create it automatically.');
      const original = saved ? saved.history : initialize;
      H.validate(original);
      let next = original;
      let alreadyRecorded = false;
      if (intent) {
        const result = H.complete(next, intent);
        next = result.history;
        alreadyRecorded = result.alreadyRecorded;
      }
      next = H.reconcile(next, date).history;
      if (saved && JSON.stringify(next) === JSON.stringify(original)) return { history: original, alreadyRecorded };
      try {
        await store.write(next, saved ? saved.revision : null);
        return { history: next, alreadyRecorded };
      } catch (error) {
        if (error.code !== 'CONFLICT') throw error;
      }
    }
    throw new Error('Another device is updating the history. Your change is waiting to sync.');
  }
  const api = { synchronize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WorkoutSync = api;
})(typeof window === 'undefined' ? globalThis : window);
