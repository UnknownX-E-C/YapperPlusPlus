// YAP++
// the original yap++ was made by @salami on yapper.

// i did not make this
// Feel free to learn from the code.
// If you wish to make a fork of yap++ Then make sure to include this:
// <h1>This tool is built on top of Yapp++ made by @salami on yapper.</h1>

// I'm a kid so the plugin might be a little immature.

// here you can read the source code of a function which enables a plugin.

console.log("wait 5 sec for it's ui to load (might freeze for 1-2 sec)");
console.log("%cModified By @nintendo On Yapper", "color:#e27ed3;font-weight:bold;font-size:14px;");

(function() {
  function initYapPlusPlus() {
    const PluginHost = {
      plugins: [],
      listeners: [],
      register(plugin) {
        this.plugins.push(plugin);
        if (localStorage.getItem(`yapplus.plugin.${plugin.id}`) === '1') {
          try { plugin.start(); } catch (e) { console.error('[Yap++] start failed', plugin.id, e); }
        }
        this.listeners.forEach(fn => fn(plugin));
      },
      isEnabled(plugin) {
        return localStorage.getItem(`yapplus.plugin.${plugin.id}`) === '1';
      },
      setEnabled(plugin, on) {
        localStorage.setItem(`yapplus.plugin.${plugin.id}`, on ? '1' : '0');
        try {
          on ? plugin.start() : plugin.stop();
        } catch (e) { console.error('[Yap++] toggle failed', plugin.id, e); }
        this.listeners.forEach(fn => fn(plugin));
      },
      all() { return this.plugins.slice(); },
      onChange(fn) { this.listeners.push(fn); },
    };

    // You can read the plugins here allong with their source code:

    const SIXSEVEN = {
      id: 'SIXSEVEN',
      name: 'SIXSEVEN',
      description: 'HIHI S-S-SIXSEVENNs (makes every message you send have 67)',
      origFetch: null,
      start() {
        if (!this.origFetch) this.origFetch = window.fetch;
        const origFetch = this.origFetch;
        window.fetch = function (input, init) {
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          const isInsert = url.indexOf('/rest/v1/messages') !== -1
                        && init && init.method === 'POST';
          if (isInsert && init.body) {
            try {
              const body = JSON.parse(init.body);
              if (typeof body.content === 'string') {
                body.content = body.content + ' 67';
                init.body = JSON.stringify(body);
              }
            } catch (e) {}
          }
          return origFetch.call(this, input, init);
        };
      },
      stop() {
        if (this.origFetch) {
          window.fetch = this.origFetch;
          this.origFetch = null;
        }
      },
    };

    const imasigma = {
      id: 'imasigma',
      name: 'Im a sigma',
      description: "Let's every one of your messages know that you're a sigma",
      origFetch: null,
      start() {
        if (!this.origFetch) this.origFetch = window.fetch;
        const origFetch = this.origFetch;

        window.fetch = function (input, init) {
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          const isInsert = url.indexOf('/rest/v1/messages') !== -1
                        && init && init.method === 'POST';
          if (isInsert && init.body) {
            try {
              const body = JSON.parse(init.body);
              if (typeof body.content === 'string') {
                body.content = body.content + ` \n* (I'm a sigma)`;
                init.body = JSON.stringify(body);
              }
            } catch (e) {}
          }
          return origFetch.call(this, input, init);
        };
      },
      stop() {
        if (this.origFetch) {
          window.fetch = this.origFetch;
          this.origFetch = null;
        }
      },
    };

    const messagelogger = {
      id: 'messagelogger',
      name: 'MessageLogger',
      description: 'Keeps deleted messages visible in red. Work in progress.',
      origFetch: null,
      origAddEventListener: null,
      STORAGE_KEY: 'yapplus.messagelog',
      domObserver: null,
      renderTimer: null,

      start() {
        const self = this;

        const css = document.createElement('style');
        css.id = 'yapplus-ghost-css';
        css.textContent = `
          [data-yp-ghost] .msg-text,
          [data-yp-ghost] .msg-text * { color: #ff4b4b !important; }
          [data-yp-ghost] .msg-author { color: #ff4b4b !important; }
        `;
        (document.head || document.documentElement).appendChild(css);

        if (!this.origFetch) this.origFetch = window.fetch;
        const origFetch = this.origFetch;

        window.fetch = function (input, init) {
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          const method = (init && init.method) || 'GET';
          const isMessages = url.indexOf('/rest/v1/messages') !== -1;

          if (isMessages && method === 'POST' && init && init.body) {
            try {
              const body = JSON.parse(init.body);
              const tempKey = `local-${Date.now()}-${Math.random()}`;
              self.recordWithKey(tempKey, 'outgoing', {
                content: body.content,
                channel_id: body.channel_id,
                author_id: body.author_id,
                created_at: new Date().toISOString(),
              });
              const p = origFetch.call(this, input, init);
              p.then(r => {
                if (!r.ok) return;
                r.clone().json().then(row => {
                  if (row && row.id) self.rekey(tempKey, row.id);
                }).catch(() => {});
              }).catch(() => {});
              return p;
            } catch (e) {}
          }

          if (isMessages && method === 'DELETE') {
            const m = url.match(/id=eq\.([0-9a-f-]+)/i);
            if (m) self.markDeleted(m[1], true);
          }

          if (isMessages && method === 'PATCH' && init && init.body) {
            const m = url.match(/id=eq\.([0-9a-f-]+)/i);
            try {
              const body = JSON.parse(init.body);
              if (m && body.content) self.markEdited(m[1], body.content);
            } catch (e) {}
          }

          if (isMessages && method === 'GET') {
            return origFetch.call(this, input, init).then(async (res) => {
              if (!res.ok) return res;
              try {
                const text = await res.text();
                const rows = JSON.parse(text);
                if (!Array.isArray(rows)) return new Response(text, res);
                const channelMatch = url.match(/channel_id=eq\.([0-9a-f-]+)/i);
                const channelId = channelMatch ? channelMatch[1] : null;
                if (channelId) {
                  const log = self.load();
                  const extras = Object.values(log).filter(r =>
                    r && r.deleted && r.channel_id === channelId
                  );
                  for (const r of extras) {
                    if (!rows.find(x => x.id === r.id)) {
                      rows.push(self.toSupabaseRow(r));
                    }
                  }
                  rows.sort((a, b) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  );
                }
                return new Response(JSON.stringify(rows), {
                  status: res.status,
                  statusText: res.statusText,
                  headers: res.headers,
                });
              } catch (e) {
                return res;
              }
            });
          }

          if (url.indexOf('/rest/v1/profiles') !== -1 ||
              url.indexOf('/rest/v1/users') !== -1 ||
              url.indexOf('who_online') !== -1) {
            return origFetch.call(this, input, init).then(res => {
              res.clone().json().then(rows => {
                if (Array.isArray(rows)) self.cacheAuthors(rows);
                else if (rows && typeof rows === 'object') self.cacheAuthors([rows]);
              }).catch(() => {});
              return res;
            });
          }

          return origFetch.call(this, input, init);
        };

        if (!this.origAddEventListener) {
          this.origAddEventListener = WebSocket.prototype.addEventListener;
        }
        const origAddEL = this.origAddEventListener;

        WebSocket.prototype.addEventListener = function (type, listener, options) {
          if (type !== 'message') return origAddEL.call(this, type, listener, options);
          const wrapped = function (ev) {
            try {
              const frame = JSON.parse(ev.data);
              const data = frame && frame.payload && frame.payload.data;
              if (data && data.table === 'messages') {
                const t = data.type || frame.event;
                if (t === 'INSERT') {
                  self.record('incoming', data.record);
                  self.scheduleGhostPaint();
                } else if (t === 'UPDATE') {
                  self.markEdited(data.record.id, data.record.content);
                } else if (t === 'DELETE') {
                  const old = data.old_record || data.old;
                  if (old && old.id) self.markDeleted(old.id, true);
                }
              }
            } catch (e) {}
            return listener.call(this, ev);
          };
          return origAddEL.call(this, type, wrapped, options);
        };

        this.installGhostStrip();
        this.scheduleGhostPaint();
        console.log('[Messagelogger] armed');
      },

      stop() {
        if (this.origFetch) { window.fetch = this.origFetch; this.origFetch = null; }
        if (this.origAddEventListener) {
          WebSocket.prototype.addEventListener = this.origAddEventListener;
          this.origAddEventListener = null;
        }
        if (this.domObserver) { this.domObserver.disconnect(); this.domObserver = null; }
        if (this.renderTimer) { clearInterval(this.renderTimer); this.renderTimer = null; }
        clearTimeout(this._paintDebounce);
        clearTimeout(this._paintDebounce2);
        clearTimeout(this._paintDebounce3);
        const strip = document.getElementById('yapplus-ghost-strip');
        if (strip) strip.remove();
        const css = document.getElementById('yapplus-ghost-css');
        if (css) css.remove();
        console.log('[Messagelogger] disarmed');
      },

      load() {
        try { return JSON.parse(sessionStorage.getItem(this.STORAGE_KEY) || '{}'); }
        catch (e) { return {}; }
      },

      save(data) {
        let arr = Object.values(data).filter(r => r && r.created_at);
        while (arr.length > 500) {
          const oldest = arr.reduce((a, b) => a.created_at < b.created_at ? a : b);
          const key = Object.keys(data).find(k => data[k] === oldest);
          if (key) delete data[key];
          arr = arr.filter(r => r !== oldest);
        }
        try { sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(data)); }
        catch (e) {}
      },

      cacheAuthors(rows) {
        const data = this.load();
        let changed = false;
        for (const r of rows) {
          if (!r || typeof r !== 'object') continue;
          const id = r.id || r.user_id || r.author_id;
          if (!id) continue;
          const username = r.username || r.display_name || r.name || r.handle;
          const avatar = r.avatar_url || r.avatar || r.profile_picture || r.pfp;
          if (!username && !avatar) continue;
          data['author' + id] = { id, username, avatar };
          changed = true;
        }
        if (changed) this.save(data);
      },

      getAuthor(id) {
        const data = this.load();
        return data['author' + id] || null;
      },

      record(direction, row) {
        const key = row.id || `local-${Date.now()}-${Math.random()}`;
        this.recordWithKey(key, direction, row);
      },

      recordWithKey(key, direction, row) {
        const data = this.load();
        data[key] = {
          id: row.id || null,
          direction,
          content: row.content,
          channel_id: row.channel_id,
          author_id: row.author_id,
          created_at: row.created_at || new Date().toISOString(),
          deleted: false,
          edited: false,
        };
        if (row.author_id) {
          const cached = data['author' + row.author_id];
          if (cached) {
            data[key].author_username = cached.username;
            data[key].author_avatar = cached.avatar;
            data[key].author_avatar_style = cached.avatar_style;
          }
        }
        this.save(data);
      },

      rekey(oldKey, newId) {
        const data = this.load();
        if (!data[oldKey]) return;
        data[oldKey].id = newId;
        data[newId] = data[oldKey];
        delete data[oldKey];
        this.save(data);
      },

      markDeleted(id, toast) {
        const data = this.load();
        if (!data[id]) return false;
        if (data[id].deleted) return true;
        data[id].deleted = true;
        data[id].deleted_at = new Date().toISOString();
        this.save(data);
        if (toast) this.showToast(data[id]);
        this.scheduleGhostPaint();
        return true;
      },

      markEdited(id, newContent) {
        const data = this.load();
        if (!data[id]) return;
        if (!data[id].edits) data[id].edits = [];
        data[id].edits.push({ at: new Date().toISOString(), content: newContent });
        data[id].edited = true;
        this.save(data);
      },

      toSupabaseRow(r) {
        return {
          id: r.id,
          channel_id: r.channel_id,
          author_id: r.author_id,
          content: r.content,
          created_at: r.created_at,
          edited_at: null,
          attachment_path: null,
          attachment_width: null,
          attachment_height: null,
          reply_to_id: null,
          pinned_at: null,
          pinned_by: null,
        };
      },

      currentChannelId() {
        try {
          const url = location.href;
          const m = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
          if (m) return m[1];
        } catch (e) {}
        try {
          const p = JSON.parse(localStorage.getItem('yapper:place') || '{}');
          return p.c || null;
        } catch (e) { return null; }
      },

      scheduleGhostPaint() {
        const self = this;
        clearTimeout(this._paintDebounce);
        clearTimeout(this._paintDebounce2);
        clearTimeout(this._paintDebounce3);
        this._paintDebounce = setTimeout(() => self.paintGhosts(), 60);
        this._paintDebounce2 = setTimeout(() => self.paintGhosts(), 250);
        this._paintDebounce3 = setTimeout(() => self.paintGhosts(), 800);
      },

      paintGhosts() {
        const list = document.querySelector('.messages');
        if (!list) return;
        const channelId = this.currentChannelId();
        if (!channelId) return;

        const log = this.load();
        const ghosts = Object.values(log).filter(r =>
          r && r.deleted && r.channel_id === channelId
        );

        list.querySelectorAll('[data-yp-ghost]').forEach(el => {
          const gid = el.getAttribute('data-message-id');
          if (!ghosts.find(g => g.id === gid)) el.remove();
        });

        for (const g of ghosts) {
          if (list.querySelector(`.msg[data-message-id="${g.id}"]`)) continue;
          const el = this.buildGhostEl(g);
          if (!el) continue;
          const realMsgs = [...list.querySelectorAll('.msg[data-message-id]')];
          let insertBefore = null;
          for (const real of realMsgs) {
            const id = real.getAttribute('data-message-id');
            const row = Object.values(log).find(r => r && r.id === id);
            if (row && row.created_at > g.created_at) { insertBefore = real; break; }
          }
          if (insertBefore && insertBefore.parentNode === list) {
            list.insertBefore(el, insertBefore);
          } else {
            list.appendChild(el);
          }
        }

        let dirty = false;
        const log2 = this.load();
        for (const g of ghosts) {
          if (g.author_username && g.author_avatar && g.author_avatar_style) continue;
          const real = list.querySelector(`.msg[data-message-id="${g.id}"]`);
          if (!real) continue;
          const authorEl = real.querySelector('.msg-author');
          const img = real.querySelector('.avatar img');
          if (authorEl && !g.author_username) {
            g.author_username = authorEl.textContent.trim();
            dirty = true;
          }
          if (img && !g.author_avatar) {
            g.author_avatar = img.getAttribute('src');
            g.author_avatar_style = img.getAttribute('style') || '';
            dirty = true;
          }
          if (g.author_id && (g.author_username || g.author_avatar)) {
            log2['__author__' + g.author_id] = {
              id: g.author_id,
              username: g.author_username,
              avatar: g.author_avatar,
              avatar_style: g.author_avatar_style,
            };
          }
          if (dirty) log2[g.id] = g;
        }
        if (dirty) this.save(log2);

        try {
          document.querySelectorAll('.msg[data-message-id]').forEach(el => {
            const id = el.getAttribute('data-message-id');
            const l = this.load();
            if (l[id] && l[id].deleted) {
              el.querySelectorAll('.msg-text, .msg-text *').forEach(n =>
                n.style.setProperty('color', '#ff4b4b', 'important'));
            }
          });
        } catch (e) {}
      },

      buildGhostEl(g) {
        const data = this.load();
        const cached = data['author' + g.author_id] || {};
        const username = (g.author_username || cached.username || 'deleted user') + ' (deleted)';
        const avatar = g.author_avatar || cached.avatar || null;
        const avatarStyle = g.author_avatar_style || cached.avatar_style || 'object-fit:cover;';

        const el = document.createElement('div');
        el.className = 'msg';
        el.setAttribute('data-yp-ghost', '1');
        el.setAttribute('data-message-id', g.id);
        el.style.background = 'transparent';

        const avatarHtml = avatar
          ? `<span class="avatar-clip" style="position:absolute;inset:0;border-radius:50%;overflow:hidden;"><img alt="" draggable="false" src="${this.escapeHtml(avatar)}" style="${this.escapeHtml(avatarStyle)}"></span>`
          : `<div style="width:40px;height:40px;border-radius:50%;background:#ff4b4b;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;">?</div>`;

        el.innerHTML =
          `<div class="msg-gutter">` +
            `<button type="button" class="avatar" style="position:relative;width:40px;height:40px;background:transparent;padding:0;border:none;cursor:default;">${avatarHtml}</button>` +
          `</div>` +
          `<div class="msg-body">` +
            `<div class="msg-head">` +
              `<button class="msg-author" style="color:#ff4b4b;cursor:default;">${this.escapeHtml(username)}</button>` +
              `<span class="msg-time">${new Date(g.created_at).toLocaleTimeString()}</span>` +
            `</div>` +
            `<div class="msg-text" style="color:#ff4b4b !important;">${this.escapeHtml(g.content)}</div>` +
          `</div>` +
          `<div class="msg-actions"></div>`;
        return el;
      },

      escapeHtml(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      },

      installGhostStrip() {
        if (document.getElementById('yapplus-ghost-strip')) return;
        const self = this;

        const strip = document.createElement('div');
        strip.id = 'yapplus-ghost-strip';
        strip.style.cssText = 'padding:6px 16px;font-size:12px;color:#ff4b4b;background:rgba(255,75,75,0.08);border-top:1px solid rgba(255,75,75,0.2);cursor:pointer;display:none;user-select:none;';
        strip.addEventListener('click', () => {
          const l = document.getElementById('yapplus-ghost-list');
          if (l) l.style.display = l.style.display === 'none' ? 'block' : 'none';
        });

        const list = document.createElement('div');
        list.id = 'yapplus-ghost-list';
        list.style.cssText = 'display:none;max-height:200px;overflow-y:auto;padding:8px 16px;font-size:12px;background:rgba(255,75,75,0.04);border-top:1px solid rgba(255,75,75,0.15);color:#ffb3b3;';

        const attach = () => {
          const composer = document.querySelector('.composer');
          if (!composer || !composer.parentNode) return false;
          if (!document.getElementById('yapplus-ghost-strip')) {
            composer.parentNode.insertBefore(list, composer);
            composer.parentNode.insertBefore(strip, list);
          }
          return true;
        };

        if (!attach()) {
          const obs = new MutationObserver(() => {
            if (attach()) obs.disconnect();
          });
          obs.observe(document.body, { childList: true, subtree: true });
        }

        this.renderTimer = setInterval(() => {
          const log = self.load();
          const channelId = self.currentChannelId();
          const items = Object.values(log).filter(r =>
            r && r.deleted && r.channel_id === channelId
          );
          if (items.length === 0) {
            strip.style.display = 'none';
            list.style.display = 'none';
            list.innerHTML = '';
            return;
          }
          strip.style.display = 'block';
          strip.textContent = `${items.length} deleted message${items.length === 1 ? '' : 's'} in this channel — click to view`;
          list.innerHTML = items
            .sort((a, b) => a.created_at < b.created_at ? 1 : -1)
            .map(r => {
              const cached = log['__author__' + r.author_id] || {};
              const name = r.author_username || cached.username || 'deleted user';
              return `<div style="margin-bottom:6px;"><span style="color:#ff8a8a;">${new Date(r.created_at).toLocaleString()}</span> &nbsp;·&nbsp; <b style="color:#ff6b6b;">${self.escapeHtml(name)}</b>: <span style="color:#ff4b4b;">${self.escapeHtml(r.content)}</span></div>`;
            })
            .join('');
        }, 1000);
      },

      showToast(row) {
        const t = document.createElement('div');
        t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1e1f22;border:1px solid rgba(255,75,75,0.4);border-left:3px solid #ff4b4b;color:#dbdee1;padding:10px 14px;border-radius:8px;font-size:13px;z-index:2147483647;max-width:320px;box-shadow:0 8px 24px rgba(0,0,0,.5);';
        t.innerHTML = `<div style="color:#ff4b4b;font-weight:700;margin-bottom:4px;">message deleted</div><div style="color:#b5bac1;font-size:12px;margin-bottom:6px;">${new Date().toLocaleTimeString()}</div><div style="color:#ff4b4b;">${this.escapeHtml(row.content)}</div>`;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 8000);
      },
    };

    const CommandBot = {
  id: 'commandbot',
  name: 'Command Bot',
  description: 'Customizable command bot. Polls channels via REST; channels do not need to be open.',

  config: null,
  baseUrl: null,
  apikey: null,
  accessToken: null,
  userId: null,
  isReady: false,
  lastSeen: {},
  processed: new Set(),
  userCache: {},
  pollTimer: null,
  spamTimer: null,
  spamUiTimer: null,
  origFetch: null,

  panel: null,
  statusEl: null,
  tabBar: null,
  contentEl: null,
  logEl: null,
  currentTab: 'channels',
  editingCommand: null,
  customDraft: null,
  spamDraft: null,
  editingSpamId: null,

  STORAGE_KEY: 'yapplus.commandbot.config.v2',
  POLL_MS: 3000,
  MAX_LOG_LINES: 400,
  MIN_SPAM_MS: 60000,

  DEFAULT_8BALL: [
    "It is certain.","It is decidedly so.","Without a doubt.",
    "Yes definitely.","You may rely on it.","As I see it, yes.",
    "Most likely.","Outlook good.","Yes.","Signs point to yes.",
    "Reply hazy, try again.","Ask again later.",
    "Better not tell you now.","Cannot predict now.",
    "Concentrate and ask again.","Don't count on it.",
    "My reply is no.","My sources say no.",
    "Outlook not so good.","Very doubtful."
  ],

  // -------------------- built-in command definitions --------------------
  getBuiltins() {
    return {
      ping: { help: 'Replies with a customizable text.', fields: [{ key: 'reply', type: 'text', label: 'Reply text', def: 'pong 🏓' }], run: ({ cfg }) => cfg.reply || 'pong 🏓' },
      '8ball': {
        help: 'Magic 8-ball — picks a random answer from your list.',
        fields: [{ key: 'answers', type: 'textarea', label: 'Answers (one per line)', def: this.DEFAULT_8BALL.join('\n') }],
        run: ({ cfg }) => { const list = String(cfg.answers || '').split('\n').map(s => s.trim()).filter(Boolean); if (!list.length) return 'No answers configured.'; return list[Math.floor(Math.random() * list.length)]; }
      },
      roll: {
        help: 'Random integer. Usage: !roll [min] [max]',
        fields: [{ key: 'min', type: 'number', label: 'Default min', def: 1 }, { key: 'max', type: 'number', label: 'Default max', def: 100 }, { key: 'template', type: 'text', label: 'Reply template ({result}, {min}, {max})', def: '🎲 {result}  (range {min}-{max})' }],
        run: ({ args, cfg }) => {
          let min = parseInt(args[0], 10); if (isNaN(min)) min = Number(cfg.min); let max = parseInt(args[1], 10); if (isNaN(max)) max = Number(cfg.max);
          if (isNaN(min)) min = 1; if (isNaN(max)) max = 100; if (min > max) { const t = min; min = max; max = t; }
          const result = Math.floor(Math.random() * (max - min + 1)) + min;
          return String(cfg.template || '🎲 {result} (range {min}-{max})').replace(/{result}/g, result).replace(/{min}/g, min).replace(/{max}/g, max);
        }
      },
      flip: { help: 'Flip a coin.', fields: [{ key: 'heads', type: 'text', label: 'Heads text', def: '🪙 Heads' }, { key: 'tails', type: 'text', label: 'Tails text', def: '🪙 Tails' }], run: ({ cfg }) => Math.random() < 0.5 ? (cfg.heads || 'Heads') : (cfg.tails || 'Tails') },
      dice: { help: 'Roll a die. Usage: !dice [sides]', fields: [{ key: 'sides', type: 'number', label: 'Default sides', def: 6 }, { key: 'template', type: 'text', label: 'Template ({result})', def: '🎲 {result}' }], run: ({ args, cfg }) => { let sides = parseInt(args[0], 10); if (isNaN(sides)) sides = Number(cfg.sides) || 6; if (sides < 2) sides = 2; const r = Math.floor(Math.random() * sides) + 1; return String(cfg.template || '🎲 {result}').replace(/{result}/g, r); } },
      choose: { help: 'Pick one of comma-separated options.', fields: [{ key: 'template', type: 'text', label: 'Template ({choice})', def: '🤔 I choose: {choice}' }], run: ({ raw, cfg }) => { const text = String(raw || '').replace(/^!\w+\s*/, ''); const opts = text.split(/[,|]/).map(s => s.trim()).filter(Boolean); if (opts.length < 2) return 'Provide at least 2 options separated by commas.'; const pick = opts[Math.floor(Math.random() * opts.length)]; return String(cfg.template || '🤔 I choose: {choice}').replace(/{choice}/g, pick); } },
      rps: { help: 'Rock, paper, scissors.', fields: [{ key: 'options', type: 'text', label: 'Options (comma-separated)', def: '🪨 rock,📄 paper,✂️ scissors' }], run: ({ cfg }) => { const opts = String(cfg.options || '').split(',').map(s => s.trim()).filter(Boolean); if (!opts.length) return 'No options configured.'; return opts[Math.floor(Math.random() * opts.length)]; } },
      echo: { help: 'Repeats your text.', fields: [{ key: 'prefix', type: 'text', label: 'Prefix', def: '' }, { key: 'suffix', type: 'text', label: 'Suffix', def: '' }], run: ({ raw, cfg }) => { const body = String(raw || '').replace(/^!echo\s*/i, ''); return String(cfg.prefix || '') + body + String(cfg.suffix || ''); } },
      help: { help: 'Lists available commands.', fields: [{ key: 'header', type: 'text', label: 'Header text', def: 'Commands:' }], run: ({ cfg }) => { const all = CommandBot.allCommands(); const lines = Object.entries(all).filter(([_, v]) => v.enabled).map(([k, v]) => '!' + k + ' — ' + (v.help || '')); return (cfg.header || 'Commands:') + '\n' + lines.join('\n'); } },
      about: { help: 'Bot info.', fields: [{ key: 'text', type: 'textarea', label: 'Text', def: 'Command Bot — powered by Yap++' }], run: ({ cfg }) => cfg.text || 'Command Bot' }
    };
  },

  allCommands() {
    const out = {};
    const builtins = this.getBuiltins();
    for (const [k, def] of Object.entries(builtins)) {
      if (!this.config.commands[k]) this.config.commands[k] = { builtin: true, enabled: true, settings: {} };
      const cfg = this.config.commands[k]; cfg.builtin = true;
      const settings = Object.assign({}, cfg.settings || {});
      for (const f of def.fields) if (settings[f.key] === undefined) settings[f.key] = f.def;
      cfg.settings = settings;
      out[k] = { builtin: true, enabled: cfg.enabled !== false, help: def.help, fields: def.fields, run: def.run, settings };
    }
    for (const [k, cfg] of Object.entries(this.config.commands)) {
      if (cfg.builtin) continue;
      out[k] = { builtin: false, enabled: cfg.enabled !== false, help: 'custom' + (cfg.isRegex ? ' (regex)' : ''), custom: cfg };
    }
    return out;
  },

  renderTemplate(tpl, ctx) {
    return String(tpl)
      .replace(/\{args\}/g, ctx.args || '').replace(/\{raw\}/g, ctx.raw || '').replace(/\{user\}/g, ctx.user || '').replace(/\{channel\}/g, ctx.channel || '')
      .replace(/\{arg(\d+)\}/g, (_, n) => (ctx.argv || [])[+n - 1] || '')
      .replace(/\{random:([^}]+)\}/g, (_, opts) => { const list = opts.split('|').map(s => s.trim()); return list[Math.floor(Math.random() * list.length)] || ''; })
      .replace(/\{num:(-?\d+)-(-?\d+)\}/g, (_, a, b) => { const lo = Math.min(+a, +b), hi = Math.max(+a, +b); return String(Math.floor(Math.random() * (hi - lo + 1)) + lo); })
      .replace(/\{(\d+)\}/g, (_, n) => (ctx.groups && ctx.groups[+n]) || '');
  },

  log(msg, type = 'info') {
    const stamp = new Date().toLocaleTimeString();
    const color = { info:'#8ab4f8', ok:'#6ddc8a', warn:'#ffcc66', err:'#ff6b6b', msg:'#e27ed3' }[type] || '#dbdee1';
    console.log(`[CommandBot][${type}] ${msg}`);
    if (this.logEl) {
      const line = document.createElement('div');
      line.style.cssText = `color:${color};margin-bottom:1px;white-space:pre-wrap;word-break:break-word;`;
      line.textContent = `[${stamp}] ${msg}`;
      this.logEl.appendChild(line); this.logEl.scrollTop = this.logEl.scrollHeight;
      while (this.logEl.childNodes.length > this.MAX_LOG_LINES) this.logEl.removeChild(this.logEl.firstChild);
    }
  },
  setStatus(text, color = '#8ab4f8') { if (this.statusEl) { this.statusEl.textContent = text; this.statusEl.style.color = color; } },
  escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); },

  start() {
    this.loadConfig(); this.buildPanel(); this.hookFetch(); this.initFromStorage();
    this.log('started', 'ok'); this.setStatus('waiting for auth…', '#ffcc66');
    this.pollTimer = setInterval(() => { if (this.isReady) this.poll(); this.updateStatus(); }, this.POLL_MS);
    this.spamTimer = setInterval(() => this.tickSpam(), 15000);
    this.spamUiTimer = setInterval(() => this.updateSpamUi(), 1000);
    this.tickSpam();
  },

  stop() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.spamTimer) { clearInterval(this.spamTimer); this.spamTimer = null; }
    if (this.spamUiTimer) { clearInterval(this.spamUiTimer); this.spamUiTimer = null; }
    if (this.origFetch) { window.fetch = this.origFetch; this.origFetch = null; }
    if (this.panel) { this.panel.remove(); this.panel = null; }
    this.logEl = null; this.statusEl = null; this.contentEl = null; this.tabBar = null;
    this.log('stopped', 'warn');
  },

  loadConfig() {
    let cfg = null; try { cfg = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null'); } catch (e) {}
    this.config = Object.assign({
      channels: [], servers: [], discoveredChannels: [], selectedServer: null,
      commands: {}, allowedUsers: [], debugMode: false,
      spamJobs: []
    }, cfg || {});
    if (!this.config.commands || typeof this.config.commands !== 'object') this.config.commands = {};
    if (!Array.isArray(this.config.allowedUsers)) this.config.allowedUsers = [];
    if (!Array.isArray(this.config.spamJobs)) this.config.spamJobs = [];
  },
  saveConfig() { try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config)); } catch (e) {} },

  hookFetch() {
    if (this.origFetch) return; this.origFetch = window.fetch;
    const origFetch = this.origFetch; const self = this;
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf('/rest/v1/') !== -1) { try { self.captureFromRequest(url, init); } catch (e) {} }
      return origFetch.call(this, input, init);
    };
  },

  captureFromRequest(url, init) {
    if (!this.baseUrl) { try { this.baseUrl = new URL(url, location.href).origin; } catch (e) {} }
    if (!init || !init.headers) { this.checkReady(); return; }
    const get = (name) => {
      const h = init.headers;
      if (h instanceof Headers) return h.get(name);
      if (Array.isArray(h)) { const f = h.find(([k]) => String(k).toLowerCase() === name.toLowerCase()); return f && f[1]; }
      for (const k of Object.keys(h)) if (k.toLowerCase() === name.toLowerCase()) return h[k];
      return null;
    };
    const apikey = get('apikey'); if (apikey) this.apikey = apikey;
    const auth = get('authorization') || get('Authorization');
    if (auth && auth.indexOf('Bearer ') === 0) {
      this.accessToken = auth.slice(7);
      const payload = this.parseJwt(this.accessToken); if (payload && payload.sub) this.userId = payload.sub;
    }
    this.checkReady();
  },

  initFromStorage() {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i); if (!key) continue;
      if (key.indexOf('auth-token') !== -1) {
        try {
          const v = JSON.parse(localStorage.getItem(key));
          if (v && v.access_token) {
            this.accessToken = v.access_token;
            const payload = this.parseJwt(v.access_token); if (payload && payload.sub) this.userId = payload.sub;
            this.log('loaded token from localStorage', 'ok'); break;
          }
        } catch (e) {}
      }
    }
    this.checkReady();
  },

  parseJwt(token) { try { const p = token.split('.')[1]; return JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return null; } },

  checkReady() {
    const ready = !!(this.baseUrl && this.apikey && this.accessToken && this.userId);
    if (ready && !this.isReady) {
      this.isReady = true; this.log(`✅ ready (bot user ${String(this.userId).slice(0, 8)}…)`, 'ok');
      this.setStatus('ready — polling', '#6ddc8a'); this.poll();
    }
  },

  updateStatus() {
    if (this.isReady) {
      const spamActive = this.config.spamJobs.filter(j => j.enabled).length;
      this.setStatus(`ready — ${this.config.channels.length} channel(s), ${spamActive} spam job(s)`, '#6ddc8a');
    } else {
      const missing = []; if (!this.baseUrl) missing.push('url'); if (!this.apikey) missing.push('apikey'); if (!this.accessToken) missing.push('token'); if (!this.userId) missing.push('user');
      this.setStatus('waiting: ' + missing.join(', '), '#ffcc66');
    }
  },

  headers() { return { 'apikey': this.apikey, 'Authorization': 'Bearer ' + this.accessToken, 'Accept': 'application/json', 'Content-Type': 'application/json' }; },
  api(method, path, body) {
    const opts = { method, headers: Object.assign({}, this.headers(), { 'Prefer': 'return=representation' }) };
    if (body) opts.body = JSON.stringify(body);
    return this.origFetch.call(window, this.baseUrl + path, opts);
  },

  async poll() {
    if (!this.isReady || !this.config.channels.length) return;
    for (const ch of this.config.channels) { try { await this.pollChannel(ch.id); } catch (e) { this.log(`poll ${ch.name || ch.id}: ${e.message}`, 'err'); } }
  },

  async pollChannel(channelId) {
    const since = this.lastSeen[channelId] || new Date(Date.now() - 60000).toISOString();
    const path = `/rest/v1/messages?channel_id=eq.${channelId}&created_at=gt.${encodeURIComponent(since)}&order=created_at.asc&limit=50`;
    const res = await this.api('GET', path);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) this.log(`auth ${res.status} on ${channelId.slice(0,8)} — bot not in channel?`, 'err');
      else this.log(`GET ${res.status} on ${channelId.slice(0,8)}`, 'warn');
      return;
    }
    let rows; try { rows = await res.json(); } catch (e) { return; }
    if (!Array.isArray(rows) || !rows.length) return;
    this.lastSeen[channelId] = rows[rows.length - 1].created_at;
    for (const row of rows) await this.handleIncoming(row);
  },

  async getUsername(authorId) {
    if (this.userCache[authorId]) return this.userCache[authorId];
    for (const table of ['profiles', 'users']) {
      try {
        const res = await this.api('GET', `/rest/v1/${table}?id=eq.${authorId}&select=*&limit=1`);
        if (this.config.debugMode) this.log(`lookup ${table} → ${res.status}`, 'info');
        if (res.ok) {
          const rows = await res.json();
          if (this.config.debugMode) this.log(`  rows: ${JSON.stringify(rows).slice(0,200)}`, 'info');
          if (rows && rows[0]) {
            const name = rows[0].username || rows[0].display_name || rows[0].name || rows[0].handle;
            if (name) { this.userCache[authorId] = name; return name; }
          }
        }
      } catch (e) {
        if (this.config.debugMode) this.log(`  ${table} err: ${e.message}`, 'warn');
      }
    }
    return null;
  },

  async handleIncoming(row) {
    if (!row || !row.content) return;
    if (this.processed.has(row.id)) return;
    this.processed.add(row.id);
    if (this.processed.size > 5000) this.processed = new Set([...this.processed].slice(-2500));

    if (row.author_id === this.userId) return;

    const isOpenToEveryone = !this.config.allowedUsers || this.config.allowedUsers.length === 0 ||
                             this.config.allowedUsers.some(u => u.toLowerCase() === 'none');

    if (!isOpenToEveryone) {
      const fullId = row.author_id;
      const shortId = String(fullId).slice(0, 8);

      const uuidMatch = this.config.allowedUsers.some(u =>
        /^[0-9a-f-]{8,}$/i.test(u) && String(fullId).toLowerCase().startsWith(u.toLowerCase())
      );

      if (!uuidMatch) {
        const username = await this.getUsername(fullId);
        if (!username) {
          this.log(`Ignored from author_id=${fullId} (${shortId}…) — add this id to Filters to allow`, 'warn');
          return;
        }
        const cleanName = String(username).replace(/^@/, '').toLowerCase();
        const isAllowed = this.config.allowedUsers.some(u =>
          !/^[0-9a-f-]{8,}$/i.test(u) && u.replace(/^@/, '').toLowerCase() === cleanName
        );
        if (!isAllowed) {
          this.log(`Ignored @${username} (${shortId}…)`, 'warn');
          return;
        }
      }
    }

    const content = String(row.content).trim();
    if (content[0] !== '!') return;

    if (this.config.debugMode) {
      this.log(`Incoming: "${content.slice(0,80)}" from ${row.author_id.slice(0,8)}…`, 'msg');
    }

    const all = this.allCommands();
    const m = content.match(/^!([\w-]+)(?:\s+([\s\S]*))?$/);

    if (m) {
      const name = m[1].toLowerCase();
      const rest = m[2] || '';
      const entry = all[name];

      if (entry && entry.enabled) {
        let reply;
        const ctx = { args: rest, argv: rest ? rest.split(/\s+/) : [], raw: content, cfg: entry.settings || {}, message: row };
        try {
          if (entry.builtin) reply = entry.run(ctx);
          else reply = this.runCustom(entry.custom, ctx);
        } catch (e) { reply = 'error: ' + e.message; }

        this.log(`!${name} → ${String(reply).split('\n')[0].slice(0,80)}`, 'ok');
        if (reply) await this.sendMessage(row.channel_id, String(reply));
        return;
      }
    }

    for (const [k, entry] of Object.entries(all)) {
      if (!entry.custom || !entry.custom.isRegex || !entry.enabled) continue;
      try {
        const re = new RegExp(entry.custom.trigger, 'i');
        const mm = content.match(re);
        if (mm) {
          const ctx = { args: mm[0], argv: mm.slice(1), raw: content, cfg: entry.custom, groups: mm, message: row };
          const reply = this.runCustom(entry.custom, ctx);
          this.log(`regex ${k} → ${String(reply).slice(0,80)}`, 'ok');
          if (reply) await this.sendMessage(row.channel_id, String(reply));
          return;
        }
      } catch (e) {}
    }
  },

  runCustom(custom, ctx) {
    return this.renderTemplate(custom.response || '', {
      args: ctx.args, argv: ctx.argv, raw: ctx.raw,
      user: String(ctx.message && ctx.message.author_id || '').slice(0, 8),
      channel: ctx.message && ctx.message.channel_id, groups: ctx.groups
    });
  },

  async sendMessage(channelId, content) {
    try {
      const res = await this.api('POST', '/rest/v1/messages', { content, channel_id: channelId, author_id: this.userId });
      if (!res.ok) { const t = await res.text().catch(() => ''); this.log(`send failed ${res.status} ${t.slice(0,120)}`, 'err'); return false; }
      return true;
    } catch (e) { this.log('send error: ' + e.message, 'err'); return false; }
  },

  async discoverServers() {
    if (!this.isReady) return this.log('not ready yet', 'warn');
    this.log('discovering servers…', 'info');
    for (const ep of ['servers', 'spaces', 'guilds', 'communities']) {
      try {
        const res = await this.api('GET', `/rest/v1/${ep}?select=*&limit=200`);
        if (!res.ok) { this.log(`${ep} → ${res.status}`, 'warn'); continue; }
        const rows = await res.json();
        if (!Array.isArray(rows) || !rows.length) { this.log(`${ep} → empty`, 'warn'); continue; }
        const sample = rows[0];
        const nameField = ['name','title','display_name','label'].find(f => sample[f] != null) || 'id';
        this.config.servers = rows.map(r => ({ id: r.id, name: r[nameField] || r.id }));
        this.saveConfig(); this.log(`✓ ${rows.length} servers via ${ep}`, 'ok'); this.renderContent(); return;
      } catch (e) { this.log(`${ep}: ${e.message}`, 'warn'); }
    }
    this.log('no servers found — add channel ids manually', 'err');
  },

  async discoverChannels(serverId) {
    if (!this.isReady) return;
    this.log(`channels for ${serverId.slice(0,8)}…`, 'info');
    const attempts = [ `channels?server_id=eq.${serverId}`, `channels?space_id=eq.${serverId}`, `channels?guild_id=eq.${serverId}`, `channels?community_id=eq.${serverId}` ];
    for (const q of attempts) {
      try {
        const res = await this.api('GET', `/rest/v1/${q}&select=*&limit=500`);
        if (!res.ok) continue;
        const rows = await res.json();
        if (!Array.isArray(rows) || !rows.length) continue;
        const sample = rows[0];
        const nameField = ['name','title','display_name','channel_name','label'].find(f => sample[f] != null) || 'id';
        this.config.discoveredChannels = rows.map(r => ({ id: r.id, name: r[nameField] || r.id }));
        this.saveConfig(); this.log(`✓ ${rows.length} channels`, 'ok'); this.renderContent(); return;
      } catch (e) {}
    }
    this.log('could not list channels — use manual id', 'warn');
  },

  buildPanel() {
    if (document.getElementById('yp-cb-panel')) { this.panel = document.getElementById('yp-cb-panel'); return; }
    const self = this;
    const panel = document.createElement('div');
    panel.id = 'yp-cb-panel';
    panel.style.cssText = `position:fixed; bottom:10px; right:10px; width:600px; height:760px; background:#0f1115; color:#dbdee1; border:1px solid #2b2d31; border-radius:10px; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12px; z-index:2147483647; display:flex; flex-direction:column; box-shadow:0 12px 40px rgba(0,0,0,.65); overflow:hidden; resize:both; min-width:420px; min-height:400px;`;
    const header = document.createElement('div');
    header.style.cssText = `padding:8px 12px; background:#1a1d23; border-bottom:1px solid #2b2d31; display:flex; justify-content:space-between; align-items:center; font-weight:700; color:#e27ed3; cursor:move; flex-shrink:0; user-select:none;`;
    header.textContent = 'Command Bot';
    const hb = document.createElement('div');
    const mkBtn = (label, onClick, bg='#2b2d31') => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = `background:${bg}; color:#dbdee1; border:none; border-radius:4px; padding:2px 8px; margin-left:4px; cursor:pointer; font-size:11px;`; b.onclick = onClick; return b; };
    hb.appendChild(mkBtn('min', () => { if (panel.dataset.min === '1') { panel.dataset.min = '0'; panel.style.height = '760px'; } else { panel.dataset.min = '1'; panel.style.height = 'auto'; } }));
    hb.appendChild(mkBtn('×', () => panel.remove()));
    header.appendChild(hb); panel.appendChild(header);

    (() => { let dragging = false, sx, sy, ox, oy; header.addEventListener('mousedown', (e) => { if (e.target.tagName === 'BUTTON') return; dragging = true; sx = e.clientX; sy = e.clientY; const r = panel.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault(); }); window.addEventListener('mousemove', (e) => { if (!dragging) return; panel.style.left = (ox + e.clientX - sx) + 'px'; panel.style.top = (oy + e.clientY - sy) + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto'; }); window.addEventListener('mouseup', () => dragging = false); })();

    const status = document.createElement('div'); status.style.cssText = 'padding:6px 12px; background:#141821; border-bottom:1px solid #2b2d31; color:#8ab4f8; flex-shrink:0;'; status.textContent = 'starting…'; panel.appendChild(status);
    const tabBar = document.createElement('div'); tabBar.style.cssText = 'display:flex; background:#141821; border-bottom:1px solid #2b2d31; flex-shrink:0;'; panel.appendChild(tabBar);
    const content = document.createElement('div'); content.style.cssText = 'flex:1; overflow-y:auto; padding:0;'; panel.appendChild(content);
    const logWrap = document.createElement('div'); logWrap.style.cssText = 'height:150px; border-top:1px solid #2b2d31; background:#0b0d11; display:flex; flex-direction:column; flex-shrink:0;';
    const logHdr = document.createElement('div'); logHdr.style.cssText = 'padding:4px 12px; background:#141821; border-bottom:1px solid #2b2d31; color:#b5bac1; font-size:10px; display:flex; justify-content:space-between;'; logHdr.innerHTML = '<span>LOG</span>';
    const clearLog = document.createElement('button'); clearLog.textContent = 'clear'; clearLog.style.cssText = 'background:none; border:none; color:#8ab4f8; cursor:pointer; font-size:10px; padding:0;'; clearLog.onclick = () => { if (self.logEl) self.logEl.innerHTML = ''; }; logHdr.appendChild(clearLog); logWrap.appendChild(logHdr);
    const logBody = document.createElement('div'); logBody.style.cssText = 'flex:1; overflow-y:auto; padding:6px 12px; font-size:10px; color:#b5bac1;'; logWrap.appendChild(logBody); panel.appendChild(logWrap);
    document.body.appendChild(panel); this.panel = panel; this.statusEl = status; this.tabBar = tabBar; this.contentEl = content; this.logEl = logBody;
    this.renderTabs(); this.renderContent();
  },

  renderTabs() {
    const tabs = [
      { id: 'channels', label: 'Channels' },
      { id: 'commands', label: 'Commands' },
      { id: 'custom',   label: 'Custom'   },
      { id: 'filters',  label: 'Filters'  },
      { id: 'spam',     label: 'Spam'     }
    ];
    this.tabBar.innerHTML = '';
    for (const t of tabs) {
      const b = document.createElement('button'); b.textContent = t.label; const active = this.currentTab === t.id;
      b.style.cssText = `flex:1; padding:8px 12px; background:${active ? '#1a1d23' : 'transparent'}; color:${active ? '#e27ed3' : '#b5bac1'}; border:none; border-bottom:2px solid ${active ? '#e27ed3' : 'transparent'}; cursor:pointer; font-family:inherit; font-size:12px; font-weight:600;`;
      b.onclick = () => { this.currentTab = t.id; this.editingCommand = null; this.customDraft = null; this.editingSpamId = null; this.renderTabs(); this.renderContent(); };
      this.tabBar.appendChild(b);
    }
  },

  renderContent() {
    if (!this.contentEl) return; this.contentEl.innerHTML = '';
    if (this.currentTab === 'channels') this.renderChannelsTab();
    else if (this.currentTab === 'commands') this.renderCommandsTab();
    else if (this.currentTab === 'custom') this.renderCustomTab();
    else if (this.currentTab === 'filters') this.renderFiltersTab();
    else if (this.currentTab === 'spam') this.renderSpamTab();
  },

  mkBtn(label, onClick, bg = '#2b2d31') { const b = document.createElement('button'); b.textContent = label; b.style.cssText = `background:${bg}; color:#dbdee1; border:1px solid #3a3d44; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:11px; font-family:inherit;`; b.onclick = onClick; return b; },
  mkRow() { const r = document.createElement('div'); r.style.cssText = 'display:flex; gap:6px; margin-bottom:6px; align-items:center;'; return r; },
  mkInput(value = '', ph = '') { const i = document.createElement('input'); i.value = value; i.placeholder = ph; i.style.cssText = 'flex:1; background:#1a1d23; color:#dbdee1; border:1px solid #3a3d44; border-radius:4px; padding:4px 6px; font-size:11px; font-family:inherit;'; return i; },
  mkSelect() { const s = document.createElement('select'); s.style.cssText = 'flex:1; background:#1a1d23; color:#dbdee1; border:1px solid #3a3d44; border-radius:4px; padding:4px 6px; font-size:11px; font-family:inherit;'; return s; },
  mkTextarea(value = '', rows = 5, ph = '') { const t = document.createElement('textarea'); t.value = value; t.rows = rows; t.placeholder = ph; t.style.cssText = 'width:100%; background:#1a1d23; color:#dbdee1; border:1px solid #3a3d44; border-radius:4px; padding:6px; font-size:11px; font-family:inherit; resize:vertical; box-sizing:border-box;'; return t; },
  mkSection(title) { const s = document.createElement('div'); s.style.cssText = 'padding:12px; border-bottom:1px solid #2b2d31;'; if (title) { const h = document.createElement('div'); h.textContent = title; h.style.cssText = 'font-weight:700; color:#e27ed3; margin-bottom:8px; font-size:11px; text-transform:uppercase; letter-spacing:.05em;'; s.appendChild(h); } this.contentEl.appendChild(s); return s; },
  mkLabel(text) { const l = document.createElement('div'); l.textContent = text; l.style.cssText = 'color:#b5bac1; font-size:10px; margin:4px 0 2px;'; return l; },
  mkCheckbox(checked, label, onChange) { const l = document.createElement('label'); l.style.cssText = 'display:flex; align-items:center; gap:6px; cursor:pointer; user-select:none;'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = checked; cb.onchange = () => onChange(cb.checked); l.appendChild(cb); l.appendChild(document.createTextNode(label)); return l; },
  mkNumInput(value, min, max, width = 60) { const i = document.createElement('input'); i.type = 'number'; i.value = value; if (min != null) i.min = min; if (max != null) i.max = max; i.style.cssText = `width:${width}px; background:#1a1d23; color:#dbdee1; border:1px solid #3a3d44; border-radius:4px; padding:4px 6px; font-size:11px; font-family:inherit;`; return i; },

  renderChannelsTab() {
    const s1 = this.mkSection('Discover');
    { const r1 = this.mkRow(); r1.appendChild(this.mkBtn('🔍 Discover servers', () => this.discoverServers())); s1.appendChild(r1);
      s1.appendChild(this.mkLabel('Server')); const rs = this.mkRow(); const ss = this.mkSelect();
      ss.innerHTML = '<option value="">— select a server —</option>' + this.config.servers.map(sv => `<option value="${this.escape(sv.id)}"${sv.id === this.config.selectedServer ? ' selected' : ''}>${this.escape(sv.name)}</option>`).join('');
      ss.onchange = () => { this.config.selectedServer = ss.value || null; this.saveConfig(); if (ss.value) this.discoverChannels(ss.value); else this.renderContent(); }; rs.appendChild(ss); s1.appendChild(rs);
      s1.appendChild(this.mkLabel('Channel')); const rc = this.mkRow(); const cs = this.mkSelect();
      cs.innerHTML = '<option value="">— select a channel —</option>' + (this.config.discoveredChannels || []).map(c => `<option value="${this.escape(c.id)}">${this.escape(c.name)}</option>`).join('');
      rc.appendChild(cs); rc.appendChild(this.mkBtn('+ Add', () => { const id = cs.value; if (!id) return; if (this.config.channels.find(x => x.id === id)) return; const found = (this.config.discoveredChannels || []).find(x => x.id === id); this.config.channels.push({ id, name: found ? found.name : id, serverId: this.config.selectedServer }); this.saveConfig(); this.renderContent(); }, '#2d4a2d')); s1.appendChild(rc);
      s1.appendChild(this.mkLabel('Or paste a channel id manually')); const rm = this.mkRow(); const mi = this.mkInput('', 'e.g. 0a1b2c3d-…'); rm.appendChild(mi);
      rm.appendChild(this.mkBtn('+ Add ID', () => { const id = mi.value.trim(); if (!id) return; if (this.config.channels.find(x => x.id === id)) return; this.config.channels.push({ id, name: id, serverId: null }); this.saveConfig(); this.renderContent(); }, '#2d4a2d')); s1.appendChild(rm);
    }
    const s2 = this.mkSection(`Watched channels (${this.config.channels.length})`);
    if (!this.config.channels.length) { const em = document.createElement('div'); em.textContent = '(none — add one above)'; em.style.cssText = 'color:#888; font-style:italic; font-size:11px;'; s2.appendChild(em); }
    else { this.config.channels.forEach(ch => { const r = this.mkRow(); const nm = document.createElement('span'); nm.textContent = ch.name || ch.id; nm.style.cssText = 'flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px;'; r.appendChild(nm); const idspan = document.createElement('span'); idspan.textContent = ch.id.slice(0, 8); idspan.style.cssText = 'color:#666; font-size:10px; font-family:monospace;'; r.appendChild(idspan); r.appendChild(this.mkBtn('×', () => { this.config.channels = this.config.channels.filter(x => x.id !== ch.id); delete this.lastSeen[ch.id]; this.saveConfig(); this.renderContent(); }, '#4a2d2d')); s2.appendChild(r); }); }
  },

  renderCommandsTab() {
    const all = this.allCommands();
    const builtinKeys = Object.keys(this.getBuiltins());
    const s = this.mkSection('Built-in commands');
    for (const key of builtinKeys) {
      const entry = all[key];
      const card = document.createElement('div'); card.style.cssText = 'border:1px solid #2b2d31; border-radius:6px; margin-bottom:6px; overflow:hidden;';
      const head = document.createElement('div'); head.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 10px; background:#141821;';
      head.appendChild(this.mkCheckbox(entry.enabled, '', (v) => { this.config.commands[key].enabled = v; this.saveConfig(); }));
      const title = document.createElement('div'); title.style.cssText = 'flex:1;'; title.innerHTML = `<div style="font-weight:700; color:#dbdee1;">!${this.escape(key)}</div><div style="color:#949ba4; font-size:10px;">${this.escape(entry.help)}</div>`; head.appendChild(title);
      head.appendChild(this.mkBtn(this.editingCommand === key ? 'close' : 'edit', () => { this.editingCommand = this.editingCommand === key ? null : key; this.renderContent(); }, '#3a3d44'));
      card.appendChild(head);
      if (this.editingCommand === key) {
        const form = document.createElement('div'); form.style.cssText = 'padding:10px; border-top:1px solid #2b2d31; background:#0f1115;';
        for (const f of entry.fields) {
          form.appendChild(this.mkLabel(f.label)); const cur = entry.settings[f.key]; let input;
          if (f.type === 'textarea') input = this.mkTextarea(cur == null ? '' : cur, 6);
          else if (f.type === 'number') { input = this.mkInput(cur == null ? '' : String(cur), ''); input.type = 'number'; }
          else input = this.mkInput(cur == null ? '' : String(cur), '');
          input.addEventListener('input', () => { let v = input.value; if (f.type === 'number') v = v === '' ? '' : Number(v); this.config.commands[key].settings[f.key] = v; this.saveConfig(); });
          form.appendChild(input);
        }
        const r = this.mkRow(); r.appendChild(this.mkBtn('reset to defaults', () => { this.config.commands[key].settings = {}; for (const f of entry.fields) this.config.commands[key].settings[f.key] = f.def; this.saveConfig(); this.renderContent(); }, '#4a3a2d')); form.appendChild(r); card.appendChild(form);
      }
      s.appendChild(card);
    }
  },

  renderCustomTab() {
    const s1 = this.mkSection('Custom commands');
    const addBtn = this.mkBtn('+ New custom command', () => { this.customDraft = this.customDraft ? null : { editingKey: null, trigger: '', isRegex: false, response: 'Hello, {user}!' }; this.renderContent(); }, '#2d4a2d'); s1.appendChild(addBtn);
    if (this.customDraft) s1.appendChild(this.renderCustomForm());
    const customKeys = Object.keys(this.config.commands).filter(k => !this.config.commands[k].builtin);
    if (!customKeys.length) { const em = document.createElement('div'); em.textContent = '(no custom commands yet)'; em.style.cssText = 'color:#888; font-style:italic; font-size:11px; margin-top:8px;'; s1.appendChild(em); return; }
    for (const key of customKeys) {
      const cfg = this.config.commands[key];
      const card = document.createElement('div'); card.style.cssText = 'border:1px solid #2b2d31; border-radius:6px; margin-top:6px; overflow:hidden;';
      const head = document.createElement('div'); head.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 10px; background:#141821;';
      head.appendChild(this.mkCheckbox(cfg.enabled !== false, '', (v) => { cfg.enabled = v; this.saveConfig(); }));
      const title = document.createElement('div'); title.style.cssText = 'flex:1;'; title.innerHTML = `<div style="font-weight:700; color:#dbdee1;">${cfg.isRegex ? '/' + this.escape(cfg.trigger) + '/' : '!' + this.escape(cfg.trigger)}</div><div style="color:#949ba4; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">→ ${this.escape(String(cfg.response).slice(0,60))}</div>`; head.appendChild(title);
      head.appendChild(this.mkBtn('edit', () => { this.customDraft = { editingKey: key, trigger: cfg.trigger, isRegex: !!cfg.isRegex, response: cfg.response || '' }; this.renderContent(); }, '#3a3d44'));
      head.appendChild(this.mkBtn('del', () => { delete this.config.commands[key]; this.saveConfig(); this.renderContent(); }, '#4a2d2d'));
      card.appendChild(head); s1.appendChild(card);
    }
    const s2 = this.mkSection('Template placeholders (for custom command responses)');
    const help = document.createElement('div'); help.style.cssText = 'font-size:10px; color:#b5bac1; line-height:1.7; font-family:monospace;';
    help.innerHTML = `<div><b style="color:#e27ed3;">{args}</b> — everything after the command</div><div><b style="color:#e27ed3;">{arg1}</b>, <b style="color:#e27ed3;">{arg2}</b>… — individual words</div><div><b style="color:#e27ed3;">{raw}</b> — the full message content</div><div><b style="color:#e27ed3;">{user}</b> — short id of the author</div><div><b style="color:#e27ed3;">{channel}</b> — channel id</div><div><b style="color:#e27ed3;">{random:a|b|c}</b> — picks one at random</div><div><b style="color:#e27ed3;">{num:1-100}</b> — random integer</div><div><b style="color:#e27ed3;">{1}</b>, <b style="color:#e27ed3;">{2}</b>… — regex capture groups</div><div style="color:#888; margin-top:6px;">Regex mode: trigger is a JS regex (no leading/trailing slash) matched against the full message.</div>`;
    s2.appendChild(help);
  },

  renderCustomForm() {
    const d = this.customDraft;
    const wrap = document.createElement('div'); wrap.style.cssText = 'border:1px solid #3a3d44; border-radius:6px; padding:10px; margin-top:8px; background:#141821;';
    const head = document.createElement('div'); head.textContent = d.editingKey ? 'Edit custom command' : 'New custom command'; head.style.cssText = 'font-weight:700; color:#e27ed3; margin-bottom:8px;'; wrap.appendChild(head);
    wrap.appendChild(this.mkLabel('Trigger (without !) — letters, numbers, dashes, underscores')); const trig = this.mkInput(d.trigger, 'e.g. hello'); trig.addEventListener('input', () => { d.trigger = trig.value; }); wrap.appendChild(trig);
    wrap.appendChild(this.mkLabel('Mode')); const modeRow = this.mkRow(); const modeLabel = document.createElement('label'); modeLabel.style.cssText = 'display:flex; align-items:center; gap:6px; cursor:pointer;';
    const cbRegex = document.createElement('input'); cbRegex.type = 'checkbox'; cbRegex.checked = d.isRegex; cbRegex.onchange = () => { d.isRegex = cbRegex.checked; }; modeLabel.appendChild(cbRegex); modeLabel.appendChild(document.createTextNode('Treat trigger as a regular expression')); modeRow.appendChild(modeLabel); wrap.appendChild(modeRow);
    wrap.appendChild(this.mkLabel('Response (supports templates)')); const resp = this.mkTextarea(d.response, 5); resp.addEventListener('input', () => { d.response = resp.value; }); wrap.appendChild(resp);
    const btnRow = this.mkRow();
    btnRow.appendChild(this.mkBtn(d.editingKey ? 'save changes' : 'create', () => {
      const trigger = String(d.trigger || '').trim(); if (!trigger) { alert('Trigger cannot be empty'); return; }
      if (!d.isRegex && !/^[\w-]+$/.test(trigger)) { alert('Trigger must be letters/numbers/dashes/underscores only'); return; }
      if (d.isRegex) { try { new RegExp(trigger); } catch (e) { alert('Invalid regex: ' + e.message); return; } }
      const key = d.isRegex ? ('re_' + Date.now()) : trigger.toLowerCase();
      if (!d.isRegex && this.getBuiltins()[key]) { alert('"' + key + '" collides with a built-in command.'); return; }
      if (d.editingKey) { if (d.editingKey !== key) delete this.config.commands[d.editingKey]; }
      const existing = this.config.commands[key] || {};
      this.config.commands[key] = Object.assign({}, existing, { builtin: false, enabled: existing.enabled !== false, trigger, isRegex: !!d.isRegex, response: String(d.response || '') });
      this.saveConfig(); this.customDraft = null; this.log('saved custom command "' + key + '"', 'ok'); this.renderContent();
    }, '#2d4a2d'));
    btnRow.appendChild(this.mkBtn('cancel', () => { this.customDraft = null; this.renderContent(); }));
    if (d.editingKey) { btnRow.appendChild(this.mkBtn('delete', () => { if (!confirm('Delete this custom command?')) return; delete this.config.commands[d.editingKey]; this.saveConfig(); this.customDraft = null; this.renderContent(); }, '#4a2d2d')); }
    wrap.appendChild(btnRow); return wrap;
  },

  renderFiltersTab() {
    const s1 = this.mkSection('Allowed authors (only reply to these)');

    const isOpen = this.config.allowedUsers.length === 0 || this.config.allowedUsers.some(u => u.toLowerCase() === 'none');

    const listWrap = document.createElement('div');
    listWrap.style.cssText = 'margin-bottom: 10px;';

    if (isOpen) {
      const em = document.createElement('div');
      em.textContent = '(open to everyone)';
      em.style.cssText = 'color:#6ddc8a; font-style:italic; font-size:11px; margin-bottom:8px;';
      listWrap.appendChild(em);
    } else {
      this.config.allowedUsers.forEach((user, idx) => {
        const r = this.mkRow();
        const nm = document.createElement('span');
        nm.textContent = user;
        nm.style.cssText = 'flex:1; font-size:11px; font-family:monospace;';
        r.appendChild(nm);
        r.appendChild(this.mkBtn('×', () => {
          this.config.allowedUsers.splice(idx, 1);
          this.saveConfig();
          this.renderContent();
        }, '#4a2d2d'));
        listWrap.appendChild(r);
      });
    }
    s1.appendChild(listWrap);

    s1.appendChild(this.mkLabel('Add new allowed author (UUID or username)'));
    const addRow = this.mkRow();
    const addInput = this.mkInput('', 'e.g. c5ccf056 or @UNKNOWNGGBOG');
    addRow.appendChild(addInput);
    addRow.appendChild(this.mkBtn('+ Add', () => {
      const val = addInput.value.trim();
      if (!val) return;
      if (this.config.allowedUsers.some(u => u.toLowerCase() === 'none')) {
        this.config.allowedUsers = [];
      }
      if (this.config.allowedUsers.some(u => u.toLowerCase() === val.toLowerCase())) return;
      this.config.allowedUsers.push(val);
      this.saveConfig();
      this.renderContent();
    }, '#2d4a2d'));
    s1.appendChild(addRow);

    const r2 = this.mkRow();
    r2.appendChild(this.mkBtn('Allow Everyone (open to all)', () => {
      this.config.allowedUsers = ['none'];
      this.saveConfig();
      this.renderContent();
    }, '#4a3a2d'));
    s1.appendChild(r2);

    const help = document.createElement('div');
    help.style.cssText = 'color:#949ba4; font-size:10px; line-height:1.7; margin-top:6px;';
    help.innerHTML = `
      • <b>UUID</b> (recommended): paste any part of the author's UUID — always works without a lookup.<br>
      • <b>Username</b>: requires the bot to be able to read the <code>profiles</code>/<code>users</code> table. If the log shows "unknown user", use a UUID instead.<br>
      • If the list is empty or contains <code>"none"</code>, the bot replies to everyone.
    `;
    s1.appendChild(help);

    const s2 = this.mkSection('Debug');
    const dbg = this.mkCheckbox(!!this.config.debugMode, 'Verbose log (print every incoming message + lookup results)', (v) => {
      this.config.debugMode = v;
      this.saveConfig();
    });
    s2.appendChild(dbg);

    const tip = document.createElement('div');
    tip.style.cssText = 'color:#949ba4; font-size:10px; line-height:1.7; margin-top:6px;';
    tip.innerHTML = `Not sure which UUID belongs to <b>@UNKNOWNGGBOG</b>? Enable verbose log, then have that account send one message. You'll see a log line like <code>Ignored from author_id=c5ccf056-...</code> with the full UUID. Paste the first 8 chars into the list above.`;
    s2.appendChild(tip);
  },

  // ============================================================
  // SPAM TAB
  // ============================================================

  formatDuration(ms) {
    if (ms < 0) ms = 0;
    const totalS = Math.floor(ms / 1000);
    const d = Math.floor(totalS / 86400);
    const h = Math.floor((totalS % 86400) / 3600);
    const m = Math.floor((totalS % 3600) / 60);
    const s = totalS % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  },

  // Check if current time falls within a job's active window
  isJobActiveNow(job) {
    // Day-of-week check (0 = Sun ... 6 = Sat)
    if (Array.isArray(job.days) && job.days.length > 0 && job.days.length < 7) {
      const today = new Date().getDay();
      if (!job.days.includes(today)) return { active: false, reason: 'outside active days' };
    }
    // Hour window
    if (job.activeStart && job.activeEnd) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const [sH, sM] = job.activeStart.split(':').map(Number);
      const [eH, eM] = job.activeEnd.split(':').map(Number);
      const startMin = sH * 60 + sM;
      const endMin = eH * 60 + eM;
      if (startMin <= endMin) {
        if (nowMin < startMin || nowMin > endMin) return { active: false, reason: 'outside active hours' };
      } else {
        // wraps midnight
        if (nowMin < startMin && nowMin > endMin) return { active: false, reason: 'outside active hours' };
      }
    }
    return { active: true };
  },

  // Returns the effective interval for a job, including jitter for this fire
  nextIntervalMs(job) {
    const base = Math.max(this.MIN_SPAM_MS, Number(job.intervalMs) || this.MIN_SPAM_MS);
    const jitter = Math.max(0, Number(job.jitterMs) || 0);
    if (jitter === 0) return base;
    // symmetric jitter: base ± jitter
    const delta = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
    return Math.max(this.MIN_SPAM_MS, base + delta);
  },

  async tickSpam() {
    if (!this.isReady) return;
    const now = Date.now();
    let changed = false;

    for (const job of this.config.spamJobs) {
      if (!job.enabled) continue;
      if (!job.message || !job.channelId) continue;

      // Max sends reached?
      if (job.maxSends > 0 && (job.sentCount || 0) >= job.maxSends) {
        if (!job.completedAt) {
          job.completedAt = now;
          job.enabled = false;
          this.log(`✅ spam job ${job.channelName || job.channelId.slice(0,8)} completed (${job.sentCount}/${job.maxSends})`, 'ok');
          changed = true;
        }
        continue;
      }

      // Startup delay after creation
      if (job.startAt && now < job.startAt) continue;

      // Active hours/days check
      const act = this.isJobActiveNow(job);
      if (!act.active) continue;

      // Interval check
      const interval = job._nextInterval || Math.max(this.MIN_SPAM_MS, Number(job.intervalMs) || this.MIN_SPAM_MS);
      const last = job.lastSent || 0;
      if (now - last < interval) continue;

      // Fire
      const ok = await this.sendMessage(job.channelId, job.message);
      job.lastSent = now;
      job.sentCount = (job.sentCount || 0) + 1;
      // compute next interval with jitter
      job._nextInterval = this.nextIntervalMs(job);
      changed = true;

      if (ok) {
        this.log(`📣 spam sent #${job.sentCount}${job.maxSends > 0 ? '/' + job.maxSends : ''} → ${job.channelName || job.channelId.slice(0,8)}: "${String(job.message).slice(0,40)}"`, 'msg');
      } else {
        this.log(`📣 spam FAILED #${job.sentCount} → ${job.channelName || job.channelId.slice(0,8)}`, 'err');
      }
    }
    if (changed) this.saveConfig();
  },

  updateSpamUi() {
    if (!this.contentEl || this.currentTab !== 'spam') return;
    const els = this.contentEl.querySelectorAll('[data-spam-countdown]');
    els.forEach(el => {
      const id = el.getAttribute('data-spam-countdown');
      const job = this.config.spamJobs.find(j => j.id === id);
      if (!job) { el.textContent = ''; return; }
      if (!job.enabled) { el.textContent = 'paused'; el.style.color = '#ffcc66'; return; }
      if (job.maxSends > 0 && (job.sentCount || 0) >= job.maxSends) {
        el.textContent = `done (${job.sentCount}/${job.maxSends})`; el.style.color = '#6ddc8a'; return;
      }
      const act = this.isJobActiveNow(job);
      if (!act.active) {
        el.textContent = act.reason; el.style.color = '#ffcc66'; return;
      }
      if (job.startAt && Date.now() < job.startAt) {
        el.textContent = 'starts in ' + this.formatDuration(job.startAt - Date.now());
        el.style.color = '#8ab4f8'; return;
      }
      const interval = job._nextInterval || Math.max(this.MIN_SPAM_MS, Number(job.intervalMs) || this.MIN_SPAM_MS);
      const next = (job.lastSent || 0) + interval;
      const remain = next - Date.now();
      if (remain <= 0) {
        el.textContent = 'sending…';
        el.style.color = '#6ddc8a';
      } else {
        el.textContent = 'next in ' + this.formatDuration(remain);
        el.style.color = '#8ab4f8';
      }
    });
  },

  renderSpamTab() {
    const self = this;

    // Warning banner
    const warn = document.createElement('div');
    warn.style.cssText = 'padding:8px 12px; background:rgba(255,204,102,0.08); border-bottom:1px solid rgba(255,204,102,0.25); color:#ffcc66; font-size:10px; line-height:1.5;';
    warn.innerHTML = `⚠️ <b>Auto-posting.</b> Minimum interval is <b>1 minute</b>. Bot must be a member of the target channel. Repetitive posting may violate Yapper's ToS — use responsibly.`;
    this.contentEl.appendChild(warn);

    // ---------- New job form ----------
    const s1 = this.mkSection('Create a new job');

    // channel picker
    s1.appendChild(this.mkLabel('Channel (pick discovered, or paste an id)'));
    const chanRow = this.mkRow();
    const chanSel = this.mkSelect();
    chanSel.innerHTML = '<option value="">— discovered channels —</option>' +
      (this.config.discoveredChannels || []).map(c =>
        `<option value="${this.escape(c.id)}">${this.escape(c.name)}</option>`).join('') +
      (this.config.channels || []).map(c =>
        `<option value="${this.escape(c.id)}">${this.escape(c.name)} (watched)</option>`).join('');
    const chanIn = this.mkInput('', 'or paste channel id');
    chanSel.onchange = () => { if (chanSel.value) chanIn.value = chanSel.value; };
    chanRow.appendChild(chanSel);
    s1.appendChild(chanRow);
    s1.appendChild(chanIn);

    // message
    s1.appendChild(this.mkLabel('Message (supports {random:a|b|c} and {num:1-100})'));
    const msgIn = this.mkTextarea('', 3, 'the message to post on a schedule');
    s1.appendChild(msgIn);

    // interval
    s1.appendChild(this.mkLabel('Interval'));
    const intRow = this.mkRow();
    const intVal = this.mkNumInput(5, 1, 1440, 70);
    intRow.appendChild(intVal);
    const intUnit = this.mkSelect();
    intUnit.style.maxWidth = '100px';
    intUnit.innerHTML = '<option value="60000">minutes</option><option value="3600000">hours</option><option value="1000">seconds (min 60)</option>';
    intRow.appendChild(intUnit);
    intRow.appendChild(document.createTextNode('between posts'));
    s1.appendChild(intRow);

    // jitter
    s1.appendChild(this.mkLabel('Random jitter (±) — makes posts look more human'));
    const jitRow = this.mkRow();
    const jitVal = this.mkNumInput(0, 0, 600000, 80);
    jitRow.appendChild(jitVal);
    jitRow.appendChild(document.createTextNode('seconds of randomness'));
    s1.appendChild(jitRow);

    // max sends
    s1.appendChild(this.mkLabel('Max sends (0 = unlimited)'));
    const maxRow = this.mkRow();
    const maxVal = this.mkNumInput(0, 0, 100000, 80);
    maxRow.appendChild(maxVal);
    maxRow.appendChild(document.createTextNode('total posts before auto-stop'));
    s1.appendChild(maxRow);

    // start delay
    s1.appendChild(this.mkLabel('Start delay (0 = start immediately)'));
    const delayRow = this.mkRow();
    const delayVal = this.mkNumInput(0, 0, 100000, 80);
    delayRow.appendChild(delayVal);
    delayRow.appendChild(document.createTextNode('seconds before first post'));
    s1.appendChild(delayRow);

    // active hours
    s1.appendChild(this.mkLabel('Active hours (leave blank to run 24/7)'));
    const hoursRow = this.mkRow();
    const startIn = this.mkInput('', 'HH:MM');
    startIn.style.maxWidth = '80px';
    const endIn = this.mkInput('', 'HH:MM');
    endIn.style.maxWidth = '80px';
    hoursRow.appendChild(document.createTextNode('from'));
    hoursRow.appendChild(startIn);
    hoursRow.appendChild(document.createTextNode('to'));
    hoursRow.appendChild(endIn);
    s1.appendChild(hoursRow);

    // active days
    s1.appendChild(this.mkLabel('Active days'));
    const daysRow = document.createElement('div');
    daysRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px;';
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dayChecks = dayNames.map((n, i) => {
      const l = document.createElement('label');
      l.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:11px; cursor:pointer;';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true; // default all days
      l.appendChild(cb);
      l.appendChild(document.createTextNode(n));
      daysRow.appendChild(l);
      return cb;
    });
    s1.appendChild(daysRow);

    // add button
    const addRow = this.mkRow();
    addRow.appendChild(this.mkBtn('+ Create job', () => {
      const channelId = (chanIn.value || '').trim();
      const message = (msgIn.value || '').trim();
      if (!channelId) { alert('Pick or paste a channel id.'); return; }
      if (!message)   { alert('Message cannot be empty.'); return; }

      let intervalMs = parseInt(intVal.value, 10) * parseInt(intUnit.value, 10);
      if (isNaN(intervalMs)) intervalMs = 5 * 60000;
      if (intervalMs < this.MIN_SPAM_MS) intervalMs = this.MIN_SPAM_MS;

      let jitterMs = parseInt(jitVal.value, 10) * 1000;
      if (isNaN(jitterMs) || jitterMs < 0) jitterMs = 0;

      let maxSends = parseInt(maxVal.value, 10);
      if (isNaN(maxSends) || maxSends < 0) maxSends = 0;

      let startDelayMs = parseInt(delayVal.value, 10) * 1000;
      if (isNaN(startDelayMs) || startDelayMs < 0) startDelayMs = 0;

      const days = dayChecks.map((cb, i) => cb.checked ? i : -1).filter(i => i >= 0);

      const found = (this.config.discoveredChannels || []).find(c => c.id === channelId)
                 || (this.config.channels || []).find(c => c.id === channelId);

      this.config.spamJobs.push({
        id: 'job_' + Date.now(),
        channelId,
        channelName: found ? found.name : channelId.slice(0, 8),
        message,
        intervalMs,
        jitterMs,
        maxSends,
        sentCount: 0,
        startAt: startDelayMs > 0 ? Date.now() + startDelayMs : 0,
        activeStart: startIn.value.trim() || null,
        activeEnd: endIn.value.trim() || null,
        days: days.length === 7 ? [] : days, // empty array = all days
        lastSent: 0,
        enabled: true,
        createdAt: Date.now()
      });
      this.saveConfig();
      this.log('created spam job for ' + channelId.slice(0,8), 'ok');
      this.renderContent();
    }, '#2d4a2d'));
    s1.appendChild(addRow);

    // ---------- Existing jobs ----------
    const s2 = this.mkSection(`Jobs (${this.config.spamJobs.length})`);
    if (!this.config.spamJobs.length) {
      const em = document.createElement('div');
      em.textContent = '(no jobs yet — create one above)';
      em.style.cssText = 'color:#888; font-style:italic; font-size:11px;';
      s2.appendChild(em);
      return;
    }

    for (const job of this.config.spamJobs) {
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #2b2d31; border-radius:6px; margin-bottom:8px; overflow:hidden;';

      // header row
      const head = document.createElement('div');
      head.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 10px; background:#141821;';

      head.appendChild(this.mkCheckbox(job.enabled, '', (v) => {
        job.enabled = v;
        if (v) { job._nextInterval = null; }
        this.saveConfig();
        this.renderContent();
      }));

      const title = document.createElement('div');
      title.style.cssText = 'flex:1; min-width:0;';
      const intervalStr = this.formatDuration(Math.max(this.MIN_SPAM_MS, job.intervalMs));
      title.innerHTML = `
        <div style="font-weight:700; color:#dbdee1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${this.escape(job.channelName || job.channelId.slice(0,8))} · every ${intervalStr}
          ${job.maxSends > 0 ? ` · ${job.sentCount||0}/${job.maxSends}` : (job.sentCount > 0 ? ` · sent ${job.sentCount}` : '')}
        </div>
        <div style="color:#949ba4; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          → ${this.escape(String(job.message).slice(0,80))}
        </div>`;
      head.appendChild(title);

      const cd = document.createElement('span');
      cd.setAttribute('data-spam-countdown', job.id);
      cd.style.cssText = 'color:#8ab4f8; font-size:10px; white-space:nowrap;';
      cd.textContent = '…';
      head.appendChild(cd);

      head.appendChild(this.mkBtn('×', () => {
        if (!confirm('Delete this job?')) return;
        this.config.spamJobs = this.config.spamJobs.filter(j => j.id !== job.id);
        this.saveConfig();
        this.renderContent();
      }, '#4a2d2d'));

      card.appendChild(head);

      // Detail panel (expandable)
      if (this.editingSpamId === job.id) {
        const form = document.createElement('div');
        form.style.cssText = 'padding:10px; border-top:1px solid #2b2d31; background:#0f1115;';

        // channel (read-only text + jump)
        form.appendChild(this.mkLabel('Channel'));
        const chanDisplay = this.mkInput(job.channelId);
        chanDisplay.readOnly = true;
        form.appendChild(chanDisplay);

        // message edit
        form.appendChild(this.mkLabel('Message'));
        const msgEdit = this.mkTextarea(job.message, 3);
        msgEdit.addEventListener('input', () => { job.message = msgEdit.value; this.saveConfig(); });
        form.appendChild(msgEdit);

        // interval edit
        form.appendChild(this.mkLabel('Interval (minutes, min 1)'));
        const intEditRow = this.mkRow();
        const intEdit = this.mkNumInput(Math.max(1, Math.round(job.intervalMs / 60000)), 1, 1440, 70);
        intEdit.addEventListener('input', () => {
          let m = parseInt(intEdit.value, 10);
          if (isNaN(m) || m < 1) m = 1;
          job.intervalMs = m * 60000;
          job._nextInterval = null;
          this.saveConfig();
        });
        intEditRow.appendChild(intEdit);
        intEditRow.appendChild(document.createTextNode('min'));
        form.appendChild(intEditRow);

        // jitter edit
        form.appendChild(this.mkLabel('Jitter (± seconds)'));
        const jitEditRow = this.mkRow();
        const jitEdit = this.mkNumInput(Math.round((job.jitterMs||0)/1000), 0, 600, 70);
        jitEdit.addEventListener('input', () => {
          let s = parseInt(jitEdit.value, 10);
          if (isNaN(s) || s < 0) s = 0;
          job.jitterMs = s * 1000;
          job._nextInterval = null;
          this.saveConfig();
        });
        jitEditRow.appendChild(jitEdit);
        form.appendChild(jitEditRow);

        // max sends edit
        form.appendChild(this.mkLabel('Max sends (0 = unlimited)'));
        const maxEditRow = this.mkRow();
        const maxEdit = this.mkNumInput(job.maxSends || 0, 0, 100000, 80);
        maxEdit.addEventListener('input', () => {
          let n = parseInt(maxEdit.value, 10);
          if (isNaN(n) || n < 0) n = 0;
          job.maxSends = n;
          this.saveConfig();
        });
        maxEditRow.appendChild(maxEdit);
        maxEditRow.appendChild(document.createTextNode(`sent so far: ${job.sentCount||0}`));
        form.appendChild(maxEditRow);

        // active hours edit
        form.appendChild(this.mkLabel('Active hours (blank = 24/7)'));
        const hoursEditRow = this.mkRow();
        const startEdit = this.mkInput(job.activeStart || '', 'HH:MM');
        startEdit.style.maxWidth = '80px';
        const endEdit = this.mkInput(job.activeEnd || '', 'HH:MM');
        endEdit.style.maxWidth = '80px';
        startEdit.addEventListener('input', () => { job.activeStart = startEdit.value.trim() || null; this.saveConfig(); });
        endEdit.addEventListener('input', () => { job.activeEnd = endEdit.value.trim() || null; this.saveConfig(); });
        hoursEditRow.appendChild(document.createTextNode('from'));
        hoursEditRow.appendChild(startEdit);
        hoursEditRow.appendChild(document.createTextNode('to'));
        hoursEditRow.appendChild(endEdit);
        form.appendChild(hoursEditRow);

        // active days edit
        form.appendChild(this.mkLabel('Active days (none checked = every day)'));
        const daysEditRow = document.createElement('div');
        daysEditRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px;';
        const dayNames2 = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const jobDays = Array.isArray(job.days) ? job.days : [];
        const jobDayChecks = dayNames2.map((n, i) => {
          const l = document.createElement('label');
          l.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:11px; cursor:pointer;';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = jobDays.length === 0 ? true : jobDays.includes(i);
          cb.onchange = () => {
            const checked = jobDayChecks.map((c, idx) => c.checked ? idx : -1).filter(x => x >= 0);
            job.days = checked.length === 7 ? [] : checked;
            this.saveConfig();
          };
          l.appendChild(cb);
          l.appendChild(document.createTextNode(n));
          daysEditRow.appendChild(l);
          return cb;
        });
        form.appendChild(daysEditRow);

        // start delay edit (as absolute start time)
        form.appendChild(this.mkLabel('Start delay (seconds from now until first send)'));
        const startDelayEditRow = this.mkRow();
        const sdRemaining = job.startAt ? Math.max(0, Math.round((job.startAt - Date.now()) / 1000)) : 0;
        const sdEdit = this.mkNumInput(sdRemaining, 0, 100000, 80);
        sdEdit.addEventListener('input', () => {
          let s = parseInt(sdEdit.value, 10);
          if (isNaN(s) || s < 0) s = 0;
          job.startAt = s > 0 ? Date.now() + s * 1000 : 0;
          this.saveConfig();
        });
        startDelayEditRow.appendChild(sdEdit);
        form.appendChild(startDelayEditRow);

        // info line
        const info = document.createElement('div');
        info.style.cssText = 'color:#949ba4; font-size:10px; margin-top:6px; line-height:1.5;';
        const created = job.createdAt ? new Date(job.createdAt).toLocaleString() : '?';
        const lastSent = job.lastSent ? new Date(job.lastSent).toLocaleString() : 'never';
        info.innerHTML = `Created: ${created}<br>Last sent: ${lastSent}<br>Total sent: ${job.sentCount||0}`;
        form.appendChild(info);

        card.appendChild(form);
      }

      // action buttons
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex; gap:6px; padding:6px 10px; border-top:1px solid #2b2d31; background:#0f1115; flex-wrap:wrap;';

      actions.appendChild(this.mkBtn('Send now', async () => {
        const ok = await this.sendMessage(job.channelId, this.renderTemplate(job.message, { args:'', argv:[], raw:'', user:'', channel:job.channelId }));
        job.lastSent = Date.now();
        job.sentCount = (job.sentCount || 0) + 1;
        job._nextInterval = this.nextIntervalMs(job);
        this.saveConfig();
        this.updateSpamUi();
        if (!ok) this.log('manual send failed', 'err');
      }, '#3a3d44'));

      actions.appendChild(this.mkBtn('Reset timer', () => {
        job.lastSent = 0;
        job._nextInterval = null;
        this.saveConfig();
        this.updateSpamUi();
      }, '#3a3d44'));

      actions.appendChild(this.mkBtn('Reset count', () => {
        job.sentCount = 0;
        job.completedAt = 0;
        this.saveConfig();
        this.renderContent();
      }, '#3a3d44'));

      actions.appendChild(this.mkBtn(this.editingSpamId === job.id ? 'close' : 'settings', () => {
        this.editingSpamId = this.editingSpamId === job.id ? null : job.id;
        this.renderContent();
      }, '#3a3d44'));

      actions.appendChild(this.mkBtn('duplicate', () => {
        const copy = JSON.parse(JSON.stringify(job));
        copy.id = 'job_' + Date.now();
        copy.sentCount = 0;
        copy.lastSent = 0;
        copy.createdAt = Date.now();
        copy.startAt = 0;
        copy.completedAt = 0;
        copy._nextInterval = null;
        copy.channelName = (job.channelName || '') + ' (copy)';
        this.config.spamJobs.push(copy);
        this.saveConfig();
        this.renderContent();
      }, '#3a3d44'));

      card.appendChild(actions);
      s2.appendChild(card);
    }

    // global controls
    const s3 = this.mkSection('Global controls');
    const gRow = this.mkRow();
    gRow.appendChild(this.mkBtn('Pause all', () => {
      this.config.spamJobs.forEach(j => j.enabled = false);
      this.saveConfig();
      this.renderContent();
    }, '#4a3a2d'));
    gRow.appendChild(this.mkBtn('Resume all', () => {
      this.config.spamJobs.forEach(j => j.enabled = true);
      this.saveConfig();
      this.renderContent();
    }, '#2d4a2d'));
    gRow.appendChild(this.mkBtn('Delete all', () => {
      if (!confirm('Delete all spam jobs?')) return;
      this.config.spamJobs = [];
      this.saveConfig();
      this.renderContent();
    }, '#4a2d2d'));
    s3.appendChild(gRow);

    // template help
    const s4 = this.mkSection('Message placeholders');
    const help = document.createElement('div');
    help.style.cssText = 'font-size:10px; color:#b5bac1; line-height:1.7; font-family:monospace;';
    help.innerHTML = `
      <div><b style="color:#e27ed3;">{random:a|b|c}</b> — picks one at random each post</div>
      <div><b style="color:#e27ed3;">{num:1-100}</b> — random integer each post</div>
      <div><b style="color:#e27ed3;">{channel}</b> — the target channel id</div>
    `;
    s4.appendChild(help);
  }
};

    // REGISTER SO IT LIKE ACTUALLY APPEARS IN PLUGINS YESSSSSS WE NEED 67 PLUGINNN YEASSSSS
    // humongous amount of newlines so i can navigate to ts (phack you messagelogger)
    
    const staffbadge = {
      id: 'staffbadge',
      name: 'Staff Badge',
      description: 'Shows the Yap++ badge next to staff members (client-side only — only Yap++ users see it).',
      BADGED: ['77ae11af', '1720334f', 'c5ccf56', 'c5ccf056'], // id prefixes of badged users
      BADGE_SRC: 'data:image/png;base64,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',
      msgAuthor: new Map(), // message id -> author id
      unresolvable: new Set(), // ids that came back empty
      observer: null,
      origFetch: null,
      origAddEventListener: null,
      origOnMessage: null,
      paintTimer: null,
      healTimer: null,
      healInterval: null,
      token: null,

      isBadged(authorId) {
        if (!authorId) return false;
        const a = String(authorId).toLowerCase();
        return this.BADGED.some(p => a.startsWith(p));
      },

      remember(msgId, authorId) {
        if (msgId && authorId) this.msgAuthor.set(msgId, String(authorId).toLowerCase());
      },

      sniffToken(input, init) {
        try {
          let h = (init && init.headers) || (input && input.headers);
          if (!h) return;
          let auth = null;
          if (typeof Headers !== 'undefined' && h instanceof Headers) auth = h.get('authorization');
          else if (Array.isArray(h)) {
            const f = h.find(x => String(x[0]).toLowerCase() === 'authorization');
            auth = f && f[1];
          } else auth = h.authorization || h.Authorization;
          if (auth && auth.indexOf('Bearer ') === 0) this.token = auth.slice(7);
        } catch (e) {}
      },

      getToken() {
        if (this.token) return this.token;
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') !== -1) {
              try {
                let v = JSON.parse(localStorage.getItem(k));
                if (typeof v === 'string') v = JSON.parse(v);
                const t = v && (v.access_token || (v.currentSession && v.currentSession.access_token));
                if (t) { this.token = t; return t; }
              } catch (e) {}
            }
          }
        } catch (e) {}
        return null;
      },

      start() {
        const self = this;

        // map messages -> author from fetch (history) and websocket (live)
        if (!this.origFetch) this.origFetch = window.fetch;
        const origFetch = this.origFetch;
        window.fetch = function (input, init) {
          self.sniffToken(input, init);
          const p = origFetch.call(this, input, init);
          try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            if (url.indexOf('/rest/v1/messages') !== -1) {
              p.then(res => {
                if (!res.ok) return;
                res.clone().json().then(rows => {
                  if (Array.isArray(rows)) rows.forEach(r => self.remember(r.id, r.author_id));
                  else if (rows && rows.id) self.remember(rows.id, rows.author_id);
                  self.schedulePaint();
                }).catch(() => {});
              }).catch(() => {});
            }
            if (url.indexOf('/rest/v1/profiles') !== -1) self.schedulePaint();
          } catch (e) {}
          return p;
        };

        this.handleWs = function (raw) {
          try {
            const f = JSON.parse(raw);
            const p = f && (f.payload || f);
            const d = p && p.data;
            const rec = p.record || (d && d.record);
            const table = p.table || (d && d.table);
            if (rec && rec.id && rec.author_id && (!table || table === 'messages')) {
              self.remember(rec.id, rec.author_id);
              self.schedulePaint();
            }
          } catch (e) {}
        };

        if (!this.origAddEventListener) this.origAddEventListener = WebSocket.prototype.addEventListener;
        const origAddEL = this.origAddEventListener;
        WebSocket.prototype.addEventListener = function (type, listener, options) {
          if (type !== 'message') return origAddEL.call(this, type, listener, options);
          const wrapped = function (ev) {
            self.handleWs(ev.data);
            return listener.call(this, ev);
          };
          return origAddEL.call(this, type, wrapped, options);
        };

        // also catch sites using ws.onmessage = ... instead of addEventListener
        const onmsgDesc = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
        if (onmsgDesc && onmsgDesc.set && !this.origOnMessage) {
          this.origOnMessage = onmsgDesc;
          Object.defineProperty(WebSocket.prototype, 'onmessage', {
            configurable: true,
            get() { return onmsgDesc.get.call(this); },
            set(fn) {
              const wrapped = function (ev) {
                self.handleWs(ev.data);
                return fn.call(this, ev);
              };
              return onmsgDesc.set.call(this, wrapped);
            },
          });
        }

        this.observer = new MutationObserver(() => self.schedulePaint());
        this.observer.observe(document.body, { childList: true, subtree: true });
        this.schedulePaint();
        this.backfill();
        this.healInterval = setInterval(() => self.heal(), 4000);
        console.log('[StaffBadge] armed');
      },

      async backfill() {
        // fetch recent messages from current channel to learn author ids (uses your session)
        try {
          const loc = (location.href.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0];
          if (!loc) return;
          const token = this.getToken();
          if (!token) return;
          const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZmt1cXpkZHd2dGRvanpnbWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2Mzk0ODgsImV4cCI6MjEwNzIxNTQ4OH0.kMZcUf8DgMrYFNGtMPW9SGja2m1cRdMq5WJv5XBNgCU';
          const res = await (this.origFetch || window.fetch)(
            `https://dnfkuqzddwvtdojzgmdm.supabase.co/rest/v1/messages?channel_id=eq.${loc}&select=id,author_id&order=created_at.desc&limit=200`,
            { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } }
          );
          if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows)) rows.forEach(r => this.remember(r.id, r.author_id));
            this.schedulePaint();
          }
        } catch (e) {}
      },

      // self-healing: any visible message we don't know the author of gets fetched by id
      async heal() {
        if (this.healing) return;
        const missing = [];
        document.querySelectorAll('.msg[data-message-id]').forEach(el => {
          const id = el.getAttribute('data-message-id');
          if (id && !this.msgAuthor.has(id) && !this.unresolvable.has(id)) missing.push(id);
        });
        if (!missing.length) return;
        const token = this.getToken();
        if (!token) return;
        this.healing = true;
        try {
          const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZmt1cXpkZHd2dGRvanpnbWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2Mzk0ODgsImV4cCI6MjEwNzIxNTQ4OH0.kMZcUf8DgMrYFNGtMPW9SGja2m1cRdMq5WJv5XBNgCU';
          const batch = missing.slice(0, 150);
          const res = await (this.origFetch || window.fetch)(
            `https://dnfkuqzddwvtdojzgmdm.supabase.co/rest/v1/messages?id=in.(${batch.join(',')})&select=id,author_id`,
            { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } }
          );
          if (res.ok) {
            const rows = await res.json();
            const found = new Set();
            if (Array.isArray(rows)) rows.forEach(r => { this.remember(r.id, r.author_id); found.add(r.id); });
            batch.forEach(id => { if (!found.has(id)) this.unresolvable.add(id); });
            this.schedulePaint();
          }
        } catch (e) {}
        this.healing = false;
      },

      stop() {
        if (this.origFetch) { window.fetch = this.origFetch; this.origFetch = null; }
        if (this.origAddEventListener) {
          WebSocket.prototype.addEventListener = this.origAddEventListener;
          this.origAddEventListener = null;
        }
        if (this.origOnMessage) {
          Object.defineProperty(WebSocket.prototype, 'onmessage', this.origOnMessage);
          this.origOnMessage = null;
        }
        if (this.observer) { this.observer.disconnect(); this.observer = null; }
        clearInterval(this.healInterval);
        clearTimeout(this.paintTimer);
        document.querySelectorAll('.yp-staff-badge').forEach(el => el.remove());
        console.log('[StaffBadge] disarmed');
      },

      schedulePaint() {
        clearTimeout(this.paintTimer);
        this.paintTimer = setTimeout(() => this.paint(), 80);
      },

      injectCss() {
        if (document.getElementById('yp-staff-badge-css')) return;
        const css = document.createElement('style');
        css.id = 'yp-staff-badge-css';
        css.textContent = `.yp-staff-badge { height: 16px; width: 16px; border-radius: 50%; margin-left: 6px; vertical-align: -3px; align-self: center; object-fit: cover; box-shadow: 0 0 5px rgba(255, 0, 255, .55); pointer-events: none; user-select: none; }`;
        (document.head || document.documentElement).appendChild(css);
      },

      paint() {
        this.injectCss();
        document.querySelectorAll('.msg[data-message-id]').forEach(el => {
          const mid = el.getAttribute('data-message-id');
          const author = this.msgAuthor.get(mid);
          const name = el.querySelector('.msg-head .msg-author');
          if (!name) return;
          const head = name.parentNode;
          let existing = head.querySelector(':scope > .yp-staff-badge');
          if (author && this.isBadged(author)) {
            if (existing && existing.previousElementSibling === name) return;
            if (existing) existing.remove();
            const img = document.createElement('img');
            img.className = 'yp-staff-badge';
            img.src = this.BADGE_SRC;
            img.alt = 'Yap++';
            img.title = 'Yap++ Client';
            img.draggable = false;
            head.insertBefore(img, name.nextSibling);
          } else if (existing) {
            existing.remove();
          }
        });
      },
    };

    // badge on by default
    if (localStorage.getItem('yapplus.plugin.staffbadge') === null) {
      localStorage.setItem('yapplus.plugin.staffbadge', '1');
    }

    const autoedit = {
      id: 'autoedit',
      name: 'Auto Edit',
      description: 'Send your command message, then instantly edits it to the replacement text.',
      origFetch: null,

      getCmd() {
        try { return (localStorage.getItem('yapplus.autoedit.cmd') || '').trim(); } catch (e) { return ''; }
      },

      getText() {
        try { return localStorage.getItem('yapplus.autoedit.text') || ''; } catch (e) { return ''; }
      },

      start() {
        const self = this;
        if (!this.origFetch) this.origFetch = window.fetch;
        const origFetch = this.origFetch;
        window.fetch = function (input, init) {
          try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
            const cmd = self.getCmd();
            if (cmd && method === 'POST' && url.indexOf('/rest/v1/messages') !== -1 && init && init.body) {
              let body = null;
              try { body = JSON.parse(init.body); } catch (e) {}
              if (body && typeof body.content === 'string' && body.content.trim().toLowerCase() === cmd.toLowerCase()) {
                const text = self.getText();
                const p = origFetch.call(this, input, init);
                p.then(res => {
                  if (!res.ok) return;
                  res.clone().json().then(row => {
                    if (row && row.id) self.edit(row.id, text === '' ? ' ' : text, init);
                  }).catch(() => {});
                }).catch(() => {});
                return p;
              }
            }
          } catch (e) {}
          return origFetch.call(this, input, init);
        };
        console.log('[AutoEdit] armed');
      },

      edit(id, text, srcInit) {
        try {
          let headers = {};
          const h = srcInit && srcInit.headers;
          if (typeof Headers !== 'undefined' && h instanceof Headers) h.forEach((v, k) => { headers[k] = v; });
          else if (Array.isArray(h)) h.forEach(pair => { headers[pair[0]] = pair[1]; });
          else if (h) headers = Object.assign({}, h);
          headers['Content-Type'] = 'application/json';
          window.fetch(`https://dnfkuqzddwvtdojzgmdm.supabase.co/rest/v1/messages?id=eq.${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ content: text }),
          }).catch(() => {});
        } catch (e) {}
      },

      stop() {
        if (this.origFetch) { window.fetch = this.origFetch; this.origFetch = null; }
        console.log('[AutoEdit] disarmed');
      },
    };

    if (localStorage.getItem('yapplus.plugin.autoedit') === null) {
      localStorage.setItem('yapplus.plugin.autoedit', '1');
    }

    PluginHost.register(SIXSEVEN);
    PluginHost.register(messagelogger);
    PluginHost.register(imasigma);
    PluginHost.register(staffbadge);
    PluginHost.register(autoedit);

    // and here you can read the actual yap++ menu injection itself

    (function () {
      if (window.__yapplusInstalled) {
        console.log('Yap++ has already ordered a double big mac');
        return;
      }
      window.__yapplusInstalled = true;
      const NAV_ID = 'yapplus-nav-button';
      const PANEL_ID = 'yapplus-panel';

      const style = document.createElement('style');
      style.textContent = `
#${NAV_ID} { color: #e27ed3; }
#${PANEL_ID} { padding: 28px 40px; color: #dbdee1; line-height: 1.5; }
#${PANEL_ID} h2 { margin: 0 0 18px; font-size: 20px; color: #fff; }
#${PANEL_ID} a { color: #e27ed3; text-decoration: none; }
#${PANEL_ID} a:hover { text-decoration: underline; }
#${PANEL_ID} .yp-section { margin-bottom: 24px; }
#${PANEL_ID} .yp-section h3 {
  font-size: 12px; text-transform: uppercase; letter-spacing: .04em;
  color: #b5bac1; margin: 0 0 10px;
}

.yp-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}
.yp-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.yp-slider {
  position: absolute;
  inset: 0;
  background: #4e5058;
  border-radius: 22px;
  transition: background .15s;
  cursor: pointer;
}
.yp-slider::before {
  content: "";
  position: absolute;
  width: 16px;
  height: 16px;
  left: 3px;
  top: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform .15s;
}
.yp-switch input:checked + .yp-slider { background: #e27ed3; }
.yp-switch input:checked + .yp-slider::before { transform: translateX(18px); }

.yp-plugin-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #2b2d31;
}
.yp-plugin-row:last-child { border-bottom: none; }
.yp-plugin-name { font-weight: 600; color: #fff; }
.yp-plugin-desc { font-size: 12px; color: #949ba4; margin-top: 2px; }

.yp-modified-banner {
  background: linear-gradient(90deg, rgba(226,126,211,0.15), rgba(226,126,211,0.03));
  border-left: 3px solid #e27ed3;
  padding: 8px 12px;
  border-radius: 6px;
  margin: 12px 0;
  font-size: 13px;
  color: #e27ed3;
  font-weight: 600;
}
`;
      document.head.appendChild(style);

      function buildPanel() {
        const p = document.createElement('div');
        p.id = PANEL_ID;
        p.innerHTML = `
<h1>Yap++</h1>
<h2>The <b>Cutest</b> Client mod for yapper</h2>
<div class="yp-modified-banner">✨ Modified By @nintendo On Yapper</div>
<hr>
<p></p>

<div class="yp-section">
  <h3>Plugins</h3>
  <div id="yapplus-plugin-list"></div>
</div>

<div class="yp-section">
  <h3>Auto Edit</h3>
  <p style="font-size:12px;color:#949ba4;margin:0 0 8px;">Type the command in chat, your message gets edited to the text below.</p>
  <input id="yapplus-ae-cmd" type="text" placeholder="/command" autocomplete="off"
    style="width:100%;margin-bottom:8px;background:#1e1f22;border:1px solid #3f4147;border-radius:6px;color:#dbdee1;padding:8px 10px;font-size:14px;outline:none;box-sizing:border-box;">
  <input id="yapplus-ae-text" type="text" placeholder="text" autocomplete="off"
    style="width:100%;background:#1e1f22;border:1px solid #3f4147;border-radius:6px;color:#dbdee1;padding:8px 10px;font-size:14px;outline:none;box-sizing:border-box;">
</div>

<div class="yp-section">
  <h3>About</h3>
  <p>Thank you for using Yap++ ❤️</p>
  <p>Yapper: <b>salami</b></p>
  <p>YouTube: <a href="https://www.youtube.com/@sedesuu" target="_blank">@sedesuu</a></p>
  <p>Discord: <a href="https://discord.com/users/1384802116106719384" target="_blank">.salamidev</a></p>
  <p>Thank you to our biggest helper and Co-Owner too;</p>
  <p>I'm ofcourse talking about the goat @Lemon 🥹</p>
  <p style="margin-top:14px;color:#e27ed3;font-weight:700;font-size:14px;">✨ Modified By @nintendo On Yapper</p>
  <h1 style="font-size:14px;margin-top:18px;">This tool is built on top of Yapp++ made by @salami on yapper.</h1>
</div>
`;

        const list = p.querySelector('#yapplus-plugin-list');

        function render() {
          list.innerHTML = '';
          PluginHost.all().forEach(plugin => {
            const row = document.createElement('div');
            row.className = 'yp-plugin-row';
            const info = document.createElement('div');
            info.innerHTML = `
              <div class="yp-plugin-name">${plugin.name}</div>
              <div class="yp-plugin-desc">${plugin.description || ''}</div>
            `;
            const label = document.createElement('label');
            label.className = 'yp-switch';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = PluginHost.isEnabled(plugin);
            const slider = document.createElement('span');
            slider.className = 'yp-slider';
            label.appendChild(input);
            label.appendChild(slider);

            input.addEventListener('change', () => {
              PluginHost.setEnabled(plugin, input.checked);
            });
            row.appendChild(info);
            row.appendChild(label);
            list.appendChild(row);
          });
        }
        render();
        PluginHost.onChange(render);

        const aeCmd = p.querySelector('#yapplus-ae-cmd');
        const aeText = p.querySelector('#yapplus-ae-text');
        try {
          aeCmd.value = localStorage.getItem('yapplus.autoedit.cmd') || '';
          aeText.value = localStorage.getItem('yapplus.autoedit.text') || '';
        } catch (e) {}
        aeCmd.addEventListener('input', () => {
          try { localStorage.setItem('yapplus.autoedit.cmd', aeCmd.value); } catch (e) {}
        });
        aeText.addEventListener('input', () => {
          try { localStorage.setItem('yapplus.autoedit.text', aeText.value); } catch (e) {}
        });
        return p;
      }

      function inject() {
        if (document.getElementById(NAV_ID)) return;
        const nav = document.querySelector('.settings-nav');
        const main = document.querySelector('.settings-main');
        if (!nav || !main) return;

        const btn = document.createElement('button');
        btn.id = NAV_ID;
        btn.textContent = '😼 Yap++';

        btn.addEventListener('click', () => {
          nav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          main.innerHTML = '';
          main.appendChild(buildPanel());
        });

        nav.appendChild(btn);
        console.log('😼 Yap++ is HEREEEE BABEYYYY');
      }

      new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
      inject();

      console.log('yapp++ dabbed up the yapper gods n shi ');
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initYapPlusPlus);
  } else {
    initYapPlusPlus();
  }
})();
