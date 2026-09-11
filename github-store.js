(function (root) {
  'use strict';
  const OWNER = 'clonmacnoise';
  const REPO = 'workout-history';
  const FILE = 'history.json';
  function connect(token) {
    if (!token) throw new Error('Enter your restricted GitHub access key.');
    async function request(path, options = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch('https://api.github.com' + path, {
          ...options, cache: 'no-store', signal: controller.signal,
          headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token,
            'X-GitHub-Api-Version': '2022-11-28', ...(options.body ? {'Content-Type':'application/json'} : {}) }
        });
        if ([401,403].includes(response.status)) throw new Error('GitHub access was denied. Check the access key, its expiry, and its Contents read/write permission.');
        return response;
      } finally { clearTimeout(timeout); }
    }
    const base = '/repos/' + OWNER + '/' + REPO;
    async function verify() {
      const userResponse = await request('/user');
      if (!userResponse.ok || (await userResponse.json()).login !== OWNER) throw new Error('Connect using your clonmacnoise GitHub account.');
      const response = await request(base);
      if (!response.ok) throw new Error('Create the private workout-history repository and give this key access to it.');
      const repository = await response.json();
      if (repository.private !== true || repository.owner.login !== OWNER) throw new Error('History must be stored in your private workout-history repository. No data was saved.');
    }
    return {
      verify,
      async read() {
        const response = await request(base + '/contents/' + FILE);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Could not load the online history. Nothing was reset.');
        const file = await response.json();
        if (file.encoding !== 'base64' || !file.content || !file.sha) throw new Error('The online history file could not be read.');
        const bytes = Uint8Array.from(atob(file.content.replace(/\s/g,'')), c => c.charCodeAt(0));
        return { history: JSON.parse(new TextDecoder().decode(bytes)), revision: file.sha };
      },
      async write(history, revision) {
        // Recheck privacy before every write, including retries.
        const repoResponse = await request(base);
        if (!repoResponse.ok || (await repoResponse.json()).private !== true) throw new Error('The history repository must remain private. Nothing was saved.');
        const bytes = new TextEncoder().encode(JSON.stringify(history, null, 2) + '\n');
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        const body = { message: 'Save workout history', content: btoa(binary) };
        if (revision !== null) body.sha = revision;
        const response = await request(base + '/contents/' + FILE, {method:'PUT',body:JSON.stringify(body)});
        if (response.status === 409 || response.status === 422) throw Object.assign(new Error('History changed. Reloading before saving.'), {code:'CONFLICT'});
        if (!response.ok) throw new Error('GitHub has not confirmed the save. Your change is waiting to sync.');
      }
    };
  }
  root.WorkoutGitHub = { connect, owner: OWNER, repository: REPO };
})(window);
