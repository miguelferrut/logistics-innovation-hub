// Supabase data layer for Logistics Innovation Hub. Owners + solutions + taxonomies + media + auth.
(function () {
  var URL = 'https://knbnsbvtvyminkqhjdxg.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuYm5zYnZ0dnltaW5rcWhqZHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwOTkwMzksImV4cCI6MjEwNTY3NTAzOX0.PCjAGdvDMns5P-a7HZYHK0W3cAWqYkizx6cykrsy89I';
  var BUCKET = 'lih-media';
  var SYNCED = ['owners', 'solutions', 'siteSettings'];
  var JSONB = { siteSettings: 'site_settings' };

  function boot() {
    if (!window.supabase || !window.supabase.createClient) return setTimeout(boot, 40);
    var sb = window.supabase.createClient(URL, KEY);
    var recovery = /type=recovery/.test(location.hash);
    var day = function (v) { return v ? String(v).slice(0, 10) : ''; };
    var clean = function (u) { return u && !/^data:/.test(u) ? u : null; };
    var chk = function (r) { if (r.error) throw r.error; return r.data || []; };

    async function load() {
      var q = await Promise.all([
        sb.from('owners').select('*').order('sort_order'),
        sb.from('solutions').select('*').order('sort_order'),
        sb.from('solution_rollout').select('*'),
        sb.from('solution_images').select('*').order('sort_order'),
        sb.from('solution_related').select('*'),
        sb.from('sites').select('*').order('sort_order'),
        sb.from('areas').select('*').order('sort_order'),
        sb.from('statuses').select('*').order('sort_order'),
        sb.from('stages').select('*').order('sort_order'),
        sb.from('idea_states').select('*').order('sort_order'),
        sb.from('functions').select('*').order('sort_order'),
        sb.from('site_settings').select('*').order('sort_order')
      ]);
      var d = q.map(chk);
      var tx = function (rows) { return rows.map(function (r) { var o = { id: r.id, label: r.label }; if (r.region != null) o.region = r.region; if (r.pill != null) o.pill = r.pill; if (r.desc != null) o.desc = r.desc; return o; }); };
      var owners = d[0].map(function (o) {
        return {
          id: o.id, state: o.state, order: o.sort_order, modifiedBy: o.modified_by || '', modifiedAt: day(o.modified_at),
          name: o.name, nameZh: o.name_zh || '', initials: o.initials || '',
          photo: { url: o.photo_url || '', name: '', alt: o.photo_alt || { en: '', zh: '' } },
          position: o.position || { en: '', zh: '' }, functionId: o.function_id || '', siteId: o.site_id || '',
          responsibilities: o.responsibilities || { en: [], zh: [] }, email: o.email || '', phone: o.phone || '', teams: o.teams || ''
        };
      });
      var solutions = d[1].map(function (s) {
        return {
          id: s.id, state: s.state, order: s.sort_order, modifiedBy: s.modified_by || '', modifiedAt: day(s.modified_at),
          name: s.name, nameZh: s.name_zh || '', area: s.area_id, status: s.status_id, ownerId: s.owner_id || '',
          launched: s.launched || { en: '', zh: '' }, tagline: s.tagline || { en: '', zh: '' },
          problem: s.problem || { en: '', zh: '' }, solution: s.solution || { en: '', zh: '' },
          how: s.how || { en: [], zh: [] }, systems: s.systems || { en: '', zh: '' }, faq: s.faq || { en: [], zh: [] },
          rollout: d[2].filter(function (r) { return r.solution_id === s.id; }).map(function (r) { return r.site_id + ':' + r.status_id; }),
          related: d[4].filter(function (r) { return r.solution_id === s.id; }).map(function (r) { return r.related_id; }),
          shotImages: d[3].filter(function (r) { return r.solution_id === s.id; }).map(function (r) { return { url: r.url || '', name: '', caption: r.caption || { en: '', zh: '' } }; })
        };
      });
      return {
        collections: { owners: owners, solutions: solutions, siteSettings: d[11].map(function (x) { return Object.assign({}, x.data, { id: x.id, state: x.state, order: x.sort_order, modifiedBy: x.modified_by || '', modifiedAt: day(x.modified_at) }); }) },
        taxonomies: { sites: tx(d[5]), areas: tx(d[6]), statuses: tx(d[7]), stages: tx(d[8]), ideaStates: tx(d[9]), functions: tx(d[10]) }
      };
    }

    async function save(coll, r, user) {
      var meta = { id: r.id, state: r.state || 'draft', sort_order: r.order || 0, modified_by: user || null, modified_at: new Date().toISOString() };
      if (JSONB[coll]) {
        var data = {}; Object.keys(r).forEach(function (k) { if (['id', 'state', 'order', 'modifiedBy', 'modifiedAt'].indexOf(k) < 0) data[k] = r[k]; });
        Object.keys(data).forEach(function (k) { var v = data[k]; if (v && typeof v === 'object' && typeof v.url === 'string' && /^data:/.test(v.url)) data[k] = Object.assign({}, v, { url: '' }); });
        chk(await sb.from(JSONB[coll]).upsert(Object.assign(meta, { data: data })));
      } else if (coll === 'owners') {
        var img = r.photo || r.image || {};
        chk(await sb.from('owners').upsert(Object.assign(meta, {
          name: r.name || '(untitled)', name_zh: r.nameZh || null, initials: r.initials || null,
          photo_url: clean(img.url), photo_alt: img.alt || null, position: r.position || { en: '', zh: '' },
          function_id: r.functionId || null, site_id: r.siteId || null, responsibilities: r.responsibilities || null,
          email: r.email || null, phone: r.phone || null, teams: r.teams || null
        })));
      } else if (coll === 'solutions') {
        chk(await sb.from('solutions').upsert(Object.assign(meta, {
          name: r.name || '(untitled)', name_zh: r.nameZh || null, area_id: r.area, status_id: r.status, owner_id: r.ownerId || null,
          launched: r.launched || null, tagline: r.tagline || { en: '', zh: '' }, problem: r.problem || null,
          solution: r.solution || null, how: r.how || null, systems: r.systems || null, faq: r.faq || null
        })));
        var id = r.id;
        await Promise.all(['solution_rollout', 'solution_related', 'solution_images'].map(function (t) { return sb.from(t).delete().eq('solution_id', id); }));
        var roll = (r.rollout || []).map(function (x) { var p = String(x).split(':'); return { solution_id: id, site_id: p[0], status_id: p[1] || null }; }).filter(function (x) { return x.site_id; });
        var rel = (r.related || []).map(function (x) { return { solution_id: id, related_id: x }; });
        var imgs = (r.shotImages || []).map(function (x, i) { return { solution_id: id, url: clean(x.url), caption: x.caption || null, sort_order: i }; });
        if (roll.length) chk(await sb.from('solution_rollout').insert(roll));
        if (rel.length) chk(await sb.from('solution_related').insert(rel));
        if (imgs.length) chk(await sb.from('solution_images').insert(imgs));
      }
    }

    async function remove(coll, id) { chk(await sb.from(JSONB[coll] || coll).delete().eq('id', id)); }

    async function upload(file, folder) {
      var ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      var path = (folder || 'misc') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      var r = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (r.error) throw r.error;
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    async function whoami() {
      var s = (await sb.auth.getSession()).data.session;
      if (!s) return null;
      var a = (await sb.from('admins').select('role, owner_id').eq('user_id', s.user.id).maybeSingle()).data;
      if (!a) return { email: s.user.email, role: null };
      var name = s.user.email;
      if (a.owner_id) { var o = (await sb.from('owners').select('name').eq('id', a.owner_id).maybeSingle()).data; if (o) name = o.name; }
      return { email: s.user.email, role: a.role === 'content_admin' ? 'admin' : 'owner', ownerId: a.owner_id, name: name };
    }

    async function signIn(email, password) {
      var r = await sb.auth.signInWithPassword({ email: email, password: password });
      if (r.error) throw r.error;
      return whoami();
    }
    async function resetPassword(email) {
      var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (r.error) throw r.error;
    }
    async function updatePassword(pw) {
      var r = await sb.auth.updateUser({ password: pw });
      if (r.error) throw r.error;
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      return whoami();
    }
    async function signOut() { await sb.auth.signOut(); }

    window.LIH_SB = { client: sb, synced: SYNCED, load: load, save: save, remove: remove, upload: upload, whoami: whoami, signIn: signIn, signOut: signOut, resetPassword: resetPassword, updatePassword: updatePassword, recovery: recovery };
  }
  boot();
})();
