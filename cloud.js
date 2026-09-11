(function () {
  'use strict';
  const H = window.WorkoutHistory;
  const programs = window.WORKOUT_PROGRAM.workouts;
  const CACHE = 'workout_cloud_cache_v1:clonmacnoise/workout-history';
  const PENDING = 'workout_cloud_pending_v1:clonmacnoise/workout-history';
  const ACCESS = 'workout_cloud_session_access_v1';
  const HIDDEN = 'workout_cloud_hidden_v1';
  let history = readLocal(CACHE);
  let pending = readLocal(PENDING);
  let store = null, busy = false, connected = false;
  let message = 'Connect to load your private history.';
  try { if (history) H.validate(history); } catch { history = null; }
  function readLocal(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
  function putLocal(key,value) { localStorage.setItem(key,JSON.stringify(value)); }
  function date() { return H.today(); }
  const $ = id => document.getElementById(id);
  function short(value) { return Number(value.slice(5,7)) + '/' + Number(value.slice(8,10)); }
  function effective() {
    if (!history) return null;
    if (pending) { try { return H.complete(history,pending).history; } catch {} }
    return history;
  }
  function hiddenKey(summary,index) {return history.id + ':' + summary.windowStart + ':' + summary.currentWorkoutIndex + ':' + index;}
  function render() {
    $('syncStatus').textContent = message;
    $('connectButton').disabled = busy;
    $('syncButton').disabled = busy || !connected;
    $('reviewButton').hidden = !pending;
    $('backupButton').disabled = !history;
    $('connectionForm').hidden = connected;
    $('disconnectButton').hidden = !connected;
    if (!history) {
      $('completedCount').textContent = '—'; $('missedCount').textContent = '—';
      $('nextWorkout').textContent = '—'; $('cycleSubtitle').textContent = 'History not loaded';
      $('cycleCount').textContent = ''; $('cycleFill').style.width = '0%';
      $('consistencyMessage').hidden = true;
      $('content').innerHTML = '<p class="empty-history">Connect to your private GitHub history to see your workout.</p>';
      return;
    }
    const view = effective(), summary = H.summary(view,date());
    const workout = programs[summary.currentWorkoutIndex];
    const windowText = short(summary.windowStart) + '–' + short(H.addDays(summary.windowStart,1));
    $('yearLabel').textContent = 'Done ' + date().slice(0,4);
    $('completedCount').textContent = summary.done;
    $('missedCount').textContent = summary.misses;
    $('nextWorkout').textContent = summary.performance;
    $('nextWorkout').className = 'status-value performance-' + summary.performance.toLowerCase();
    $('cycleSubtitle').textContent = 'Window ' + windowText;
    $('cycleCount').textContent = workout.label + ' · due ' + short(H.addDays(summary.windowStart,1));
    $('cycleFill').style.width = Math.min(100,Math.round(summary.done / 104 * 100)) + '%';
    const streakText = summary.streak === 1 ? 'One down—keep going.' : summary.streak === 2 ? '2 in a row—building momentum.' : summary.streak >= 3 ? summary.streak + ' in a row!' : '';
    $('consistencyMessage').textContent = streakText;
    $('consistencyMessage').hidden = !streakText;
    const hidden = readLocal(HIDDEN) || {};
    const blocks = workout.blocks.map((block,index) => hidden[hiddenKey(summary,index)] ? '' :
      `<div class="block-card" data-block-index="${index}"><div class="block-header"><div class="block-badge badge-${block.block}">${block.block}</div><span class="block-label">Block ${block.block}</span><span class="block-sets">${block.sets} sets</span></div>${block.exercises.map(ex=>`<div class="exercise-row"><div class="ex-name">${ex.name}</div><div class="ex-chips"><span class="chip chip-weight">${ex.weight}</span><span class="chip chip-reps">${ex.reps}</span>${block.note?`<span class="chip chip-note">${block.note}</span>`:''}</div></div>`).join('')}</div>`).join('');
    const future = summary.windowStart > date();
    const events = H.reconcile(view,date()).history.events;
    let currentMisses = 0;
    for(let i=events.length-1;i>=0 && events[i].type==='miss';i--) currentMisses++;
    const badge = currentMisses ? `<span class="done-badge missed-badge">${currentMisses} MISSED</span>` : '';
    const label = pending ? 'Completion waiting to sync' : future ? 'Starts ' + short(summary.windowStart) : 'Mark workout complete';
    $('content').innerHTML = `<div class="day-heading">${workout.label} · ${windowText} ${badge}</div>${blocks}<div class="complete-area"><button id="completeButton" class="btn-complete${future || pending ? ' is-done':''}"${future || pending || busy ? ' disabled':''}>${label}</button></div>`;
    $('completeButton').addEventListener('click',complete);
    document.querySelectorAll('.block-card').forEach(card=>{
      let startX=0,startY=0;
      card.addEventListener('touchstart',event=>{startX=event.touches[0].clientX;startY=event.touches[0].clientY;},{passive:true});
      card.addEventListener('touchend',event=>{
        const dx=event.changedTouches[0].clientX-startX,dy=event.changedTouches[0].clientY-startY;
        if(dx < -80 && Math.abs(dx)>Math.abs(dy)) {
          const values=readLocal(HIDDEN)||{};values[hiddenKey(summary,Number(card.dataset.blockIndex))]=true;
          try {putLocal(HIDDEN,values);} catch {}
          card.remove();
        }
      },{passive:true});
    });
  }
  async function sync(initialize = null) {
    if (!store || busy) return;
    busy=true;message=pending?'Saving completion…':'Loading private history…';render();
    try {
      const result=await WorkoutSync.synchronize(store,{date:date(),intent:pending,initialize});
      history=result.history;
      // The cloud has acknowledged the operation before its local pending copy is cleared.
      try {putLocal(CACHE,history);} catch {}
      if(pending) {localStorage.removeItem(PENDING);pending=null;}
      message=result.alreadyRecorded?'Already recorded on another device · Saved to GitHub':'Saved to GitHub';
      $('startButton').hidden=true;
    } catch(error) {
      message=(pending?'Waiting to sync. ':'') + (error.name==='AbortError'?'GitHub did not respond. Try again when connected.':error.message || 'Connection unavailable.');
      if(!history && /No online history/.test(error.message)) $('startButton').hidden=false;
    } finally {busy=false;render();}
  }
  async function connect(token) {
    if(busy)return;
    busy=true;message='Checking private GitHub access…';render();
    try {
      const candidate=WorkoutGitHub.connect(token);
      await candidate.verify();
      store=candidate;connected=true;
      try{sessionStorage.setItem(ACCESS,token);}catch{}
      $('accessKey').value='';
    } catch(error) {store=null;connected=false;message=error.message;}
    busy=false;render();
    if(connected)await sync();
  }
  async function complete() {
    if(!history || pending || busy)return;
    const summary=H.summary(history,date());
    if(summary.windowStart>date())return;
    const intent={id:crypto.randomUUID(),historyId:history.id,workoutKey:programs[summary.currentWorkoutIndex].key,windowStart:summary.windowStart,completedAt:date()};
    try {putLocal(PENDING,intent);} catch {message='This browser cannot keep a pending completion. Enable website storage before recording it.';render();return;}
    pending=intent;message='Waiting to sync · This completion is currently saved only on this device.';render();
    if(connected)await sync();
  }
  $('connectionForm').addEventListener('submit',event=>{event.preventDefault();connect($('accessKey').value.trim());});
  $('syncButton').addEventListener('click',()=>sync());
  $('startButton').addEventListener('click',()=>sync(H.create('2026-09-11',crypto.randomUUID())));
  $('reviewButton').addEventListener('click',async()=>{
    if(!connected || busy){message='Connect before reviewing your pending completion.';render();return;}
    if(!confirm('Discard only this device’s unsaved completion and load the saved cloud history?'))return;
    localStorage.removeItem(PENDING);pending=null;await sync();
  });
  $('disconnectButton').addEventListener('click',()=>{
    if(busy)return;
    try{sessionStorage.removeItem(ACCESS);}catch{}
    store=null;connected=false;message='Disconnected · Showing this device’s saved copy.';render();
  });
  $('backupButton').addEventListener('click',()=>{
    if(!history)return;
    const file=new Blob([JSON.stringify({backupVersion:1,history,pending},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(file),a=document.createElement('a');
    a.href=url;a.download='workout-backup-'+date()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  window.addEventListener('online',()=>{if(connected)sync();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(connected)sync();else render();}});
  setInterval(()=>{if(!document.hidden && connected && !busy)sync();},60000);
  if(history)message=pending?'Waiting to sync · Reconnect to save this device’s pending completion.':'Showing this device’s saved copy · Connect to check for updates.';
  render();
  let token;try{token=sessionStorage.getItem(ACCESS);}catch{}
  if(token)connect(token);
})();
