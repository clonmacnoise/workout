/* Private history model. Storage adapters must use conditional writes. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const KEYS = Array.from({ length: 7 }, (_, i) => 'day-' + (i + 1));
  function validDate(value) {
    if (typeof value !== 'string' || !DATE.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function addDays(value, days) {
    if (!validDate(value)) throw new Error('Invalid history date.');
    return new Date(new Date(value + 'T00:00:00Z').getTime() + days * DAY).toISOString().slice(0, 10);
  }
  function today(timeZone = 'America/Los_Angeles', now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = type => parts.find(part => part.type === type).value;
    return get('year') + '-' + get('month') + '-' + get('day');
  }
  function create(startDate, id) {
    if (!validDate(startDate) || !id) throw new Error('A start date and history ID are required.');
    return { schemaVersion: 1, id, timeZone: 'America/Los_Angeles', startDate, events: [] };
  }
  function validate(history) {
    if (!history || history.schemaVersion !== 1 || typeof history.id !== 'string' || !history.id ||
        history.timeZone !== 'America/Los_Angeles' || !validDate(history.startDate) || !Array.isArray(history.events)) {
      throw new Error('The saved history is not recognized. It has not been changed.');
    }
    let index = 0;
    let windowStart = history.startDate;
    const ids = new Set();
    for (const event of history.events) {
      if (!event || typeof event.id !== 'string' || !event.id || ids.has(event.id) ||
          !['complete', 'miss'].includes(event.type) || event.workoutKey !== KEYS[index] ||
          event.windowStart !== windowStart || event.windowEnd !== addDays(windowStart, 1)) {
        throw new Error('The saved history contains an inconsistent event. It has not been changed.');
      }
      ids.add(event.id);
      if (event.type === 'complete') {
        if (!validDate(event.completedAt) || event.completedAt < windowStart || event.completedAt > event.windowEnd) {
          throw new Error('A saved completion date is invalid. It has not been changed.');
        }
        index = (index + 1) % KEYS.length;
        windowStart = addDays(event.completedAt, 1);
      } else {
        if (event.recordedAt !== addDays(windowStart, 2)) throw new Error('A saved miss date is invalid.');
        windowStart = event.recordedAt;
      }
    }
    return { currentWorkoutIndex: index, windowStart };
  }
  function reconcile(history, date) {
    if (!validDate(date)) throw new Error('Invalid current date.');
    const state = validate(history);
    const copy = { ...history, events: history.events.slice() };
    while (date >= addDays(state.windowStart, 2)) {
      const workoutKey = KEYS[state.currentWorkoutIndex];
      copy.events.push({ id: 'miss:' + state.windowStart + ':' + workoutKey, type: 'miss', workoutKey,
        windowStart: state.windowStart, windowEnd: addDays(state.windowStart, 1), recordedAt: addDays(state.windowStart, 2) });
      state.windowStart = addDays(state.windowStart, 2);
    }
    return { history: copy, state };
  }
  function complete(history, intent) {
    validate(history);
    if (!intent || intent.historyId !== history.id || !validDate(intent.completedAt) ||
        !validDate(intent.windowStart) || !KEYS.includes(intent.workoutKey) || typeof intent.id !== 'string' || !intent.id) {
      throw new Error('This completion does not belong to the connected history.');
    }
    const existing = history.events.find(event => event.type === 'complete' && event.workoutKey === intent.workoutKey && event.windowStart === intent.windowStart);
    if (existing) return { history, alreadyRecorded: true };
    const result = reconcile(history, intent.completedAt);
    if (result.state.windowStart !== intent.windowStart || KEYS[result.state.currentWorkoutIndex] !== intent.workoutKey) {
      throw new Error('The schedule changed on another device. Your pending completion needs review.');
    }
    result.history.events.push({ id: intent.id, type: 'complete', workoutKey: intent.workoutKey,
      windowStart: intent.windowStart, windowEnd: addDays(intent.windowStart, 1), completedAt: intent.completedAt });
    validate(result.history);
    return { history: result.history, alreadyRecorded: false };
  }
  function summary(history, date) {
    const { history: current, state } = reconcile(history, date);
    const cutoff = addDays(date, -89);
    const misses = current.events.filter(event => event.type === 'miss' && event.recordedAt >= cutoff && event.recordedAt <= date).length;
    const done = current.events.filter(event => event.type === 'complete' && event.completedAt.slice(0, 4) === date.slice(0, 4) && event.completedAt <= date).length;
    let streak = 0;
    for (let i = current.events.length - 1; i >= 0 && current.events[i].type === 'complete'; i--) streak++;
    return { ...state, done, misses, streak, performance: misses <= 4 ? 'High' : misses <= 10 ? 'Medium' : 'Low' };
  }
  const api = { create, validate, reconcile, complete, summary, today, addDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WorkoutHistory = api;
})(typeof window === 'undefined' ? globalThis : window);
