/* Workshop 1 deck engine. Public API: window.Deck (see the end of this file). */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var PRESENTER = params.get('presenter') === '1';
  var CAPTURE = params.get('capture') === '1';
  var STEP_MS = 3000;
  var COUNT_MS = 1000;
  var NARROW = '(max-width: 760px) and (orientation: portrait) and (pointer: fine)';
  var TURNED = '(max-width: 760px) and (orientation: portrait) and (pointer: coarse)';
  var CHANNEL = 'w1-deck';
  var TIMER_KEY = 'w1-timer';
  var instance = Math.random().toString(36).slice(2);

  var S = { slides: [], byId: {}, nav: [], topics: [], cur: null, step: 1, playing: false, timer: null, totalMin: 0 };
  var hooks = {};
  var listeners = [];
  var presenterWin = null;
  var channel = null;
  try { channel = new BroadcastChannel(CHANNEL); } catch (e) { channel = null; }
  var el = {};
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function text(e) { return (e.textContent || '').replace(/\s+/g, ' ').trim(); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function mmss(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ':' + pad2(s % 60);
  }
  function make(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function parseList(v) {
    return String(v).split(/[\s,]+/).filter(Boolean).map(Number);
  }

  /* ---------- Model ---------- */
  function collect() {
    var cumulative = 0;
    $$('#slides > section.slide').forEach(function (sec) {
      var animOnly = sec.classList.contains('anim-only');
      var caps = $$('.captions > li', sec).map(text);
      var steps = parseInt(sec.dataset.steps, 10) || caps.length || 1;
      if (caps.length !== steps) console.warn('[deck] ' + sec.id + ': data-steps=' + steps + ' but ' + caps.length + ' captions');
      var h2 = $('h2', sec);
      var notes = $('aside.notes', sec);
      var s = {
        id: sec.id,
        el: sec,
        title: h2 ? text(h2) : sec.id,
        topic: sec.dataset.topic || (animOnly ? 'Animation ' + (sec.dataset.cmd || '') : ''),
        minutes: animOnly ? 0 : (parseFloat(sec.dataset.minutes) || 0),
        steps: steps,
        animOnly: animOnly,
        cmd: sec.dataset.cmd || null,
        captions: caps,
        notesText: notes ? text(notes) : '',
        index: null,
        cumStart: 0,
        stepEls: $$('[data-step]', sec).filter(function (e) { return !e.closest('.captions'); }),
        fromEls: $$('[data-from]', sec),
        counters: $$('[data-count]', sec),
        terms: $$('.term[data-cast]', sec)
      };
      s.stepEls.forEach(function (e) { e._steps = parseList(e.dataset.step); });
      s.fromEls.forEach(function (e) { e._from = parseInt(e.dataset.from, 10) || 1; });
      S.slides.push(s);
      S.byId[s.id] = s;
      if (!animOnly) {
        s.index = S.nav.length + 1;
        s.cumStart = cumulative;
        cumulative += s.minutes;
        S.nav.push(s);
      }
    });
    S.totalMin = cumulative;
  }

  function buildTopics() {
    var byName = {};
    S.nav.forEach(function (s) {
      var t = byName[s.topic];
      if (!t) {
        t = { name: s.topic, first: s.id, minutes: 0, start: s.cumStart };
        byName[s.topic] = t;
        S.topics.push(t);
      }
      t.minutes += s.minutes;
    });
  }

  /* ---------- Chrome ---------- */
  var ICON = {
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2.5v14H6zM19 5v14L9.5 12z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5H18v14h-2.5zM5 5v14l9.5-7z"/></svg>',
    reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L7 6.5 12 11V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z"/></svg>'
  };

  function button(cls, label, icon) {
    var b = make('button', cls);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = icon;
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    return b;
  }

  function buildChrome() {
    el.stage = $('#stage');
    el.fit = $('#fit');
    el.cap = $('#cap');
    el.capbar = $('#capbar');
    el.stepLabel = $('#steplabel');
    el.topic = $('#topic');
    el.progress = $('#progress');
    el.counter = $('#counter');
    el.dock = $('#dock');
    el.notes = $('#notes');
    el.nbody = $('.nbody', el.notes);

    var btns = $('.btns', el.capbar);
    btns.innerHTML = '';
    el.prev = button('', 'Previous', ICON.prev);
    el.play = button('playbtn', 'Play', ICON.play);
    el.next = button('', 'Next', ICON.next);
    el.reset = button('', 'Reset', ICON.reset);
    [el.prev, el.play, el.next, el.reset].forEach(function (b) { btns.appendChild(b); });
    el.prev.addEventListener('click', prev);
    el.next.addEventListener('click', next);
    el.play.addEventListener('click', toggle);
    el.reset.addEventListener('click', reset);

    S.topics.forEach(function (t) {
      var seg = make('button', 'seg');
      seg.type = 'button';
      seg.title = t.name;
      seg.setAttribute('aria-label', 'Go to topic ' + t.name);
      seg.style.flex = Math.max(t.minutes, 0.5) + ' 1 0';
      seg.appendChild(make('span', 'fill'));
      seg.addEventListener('mousedown', function (e) { e.preventDefault(); });
      seg.addEventListener('click', function () { go(t.first, 1); });
      t.seg = seg;
      el.progress.appendChild(seg);
    });

    el.btnNotes = $('#btn-notes');
    el.btnPres = $('#btn-pres');
    el.btnNotes.addEventListener('click', toggleNotes);
    el.btnPres.addEventListener('click', openPresenter);
    $('.nhead button', el.notes).addEventListener('click', toggleNotes);
    [el.btnNotes, el.btnPres].forEach(function (b) { b.addEventListener('mousedown', function (e) { e.preventDefault(); }); });

    var extra = make('div', 'dock-extra');
    var dn = make('button', 'tbtn', 'Notes');
    dn.type = 'button';
    dn.addEventListener('click', toggleNotes);
    var dt = make('span');
    var dc = make('span', 'counter');
    extra.appendChild(dn);
    extra.appendChild(dt);
    extra.appendChild(dc);
    el.dock.appendChild(extra);
    if (window.Theme) window.Theme.mount(dt);
    el.dockCounter = dc;

    el.dock.appendChild(make('div'));
    var mq = window.matchMedia(NARROW);
    var onMq = function () { layout(); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq);
    window.addEventListener('resize', layout);
    layout();
  }

  function layout() {
    // Measure #app, not innerWidth: mobile browsers widen innerWidth to fit a stale wide canvas,
    // and on a turned phone #app is the rotated frame.
    var w = el.fit.parentNode.clientWidth, h = el.fit.parentNode.clientHeight;
    var narrow = window.matchMedia(NARROW).matches && !PRESENTER && !CAPTURE;
    var s = narrow ? w / 1280 : Math.min(w / 1280, h / 720);
    document.documentElement.style.setProperty('--s', String(s));
    if (narrow && el.capbar.parentNode !== el.dock) el.dock.insertBefore(el.capbar, el.dock.firstChild);
    if (!narrow && el.capbar.parentNode !== el.stage) el.stage.appendChild(el.capbar);
  }

  /* ---------- Notes ---------- */
  var CUE = /(\[DO: [^\]]*\]|\[[A-Z]{2,}(?: [A-Za-z0-9.:_-]+)*\])/;
  function cueKind(label) {
    if (/^STEP/.test(label)) return 'step';
    if (/^ASK/.test(label)) return 'ask';
    if (/^PAUSE/.test(label)) return 'pause';
    if (/^DEMO/.test(label)) return 'demo';
    if (/^LIVE/.test(label)) return 'live';
    if (/^CLICK/.test(label)) return 'click';
    if (/^DO:/.test(label)) return 'do';
    return 'other';
  }
  function renderNotes(container, s) {
    container.textContent = '';
    if (!s || !s.notesText) {
      container.appendChild(make('p', null, s && s.animOnly ? 'This animation slide has no notes.' : 'No notes for this slide.'));
      return;
    }
    var block = null;
    function open(step) {
      block = make('p');
      block.dataset.step = String(step);
      container.appendChild(block);
    }
    open(0);
    s.notesText.split(CUE).forEach(function (tok) {
      if (!tok) return;
      if (CUE.test(tok) && /^\[.*\]$/.test(tok)) {
        var label = tok.slice(1, -1);
        var kind = cueKind(label);
        if (kind === 'step') {
          if (!block.childNodes.length) block.remove();
          open(parseInt(label.replace(/\D+/g, ''), 10) || 0);
        }
        block.appendChild(make('span', 'cue cue-' + kind, label));
      } else {
        block.appendChild(document.createTextNode(tok));
      }
    });
  }
  function scrollInto(scroller, node) {
    var top = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 40;
    scroller.scrollTop = Math.max(0, top);
  }
  function markNotes(container, scroller, step) {
    var current = null;
    $$('p', container).forEach(function (p) {
      var on = p.dataset.step === String(step);
      p.classList.toggle('is-current', on);
      if (on) current = p;
    });
    if (current && scroller && scroller.clientHeight > 0) scrollInto(scroller, current);
  }
  function toggleNotes() {
    var open = el.notes.classList.toggle('open');
    el.btnNotes.setAttribute('aria-pressed', String(open));
    if (open) markNotes(el.nbody, el.notes, S.step);
  }

  /* ---------- Components ---------- */
  function copyButton(cls, label, aria, getText) {
    var b = make('button', cls, label);
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function () {
      var text = getText();
      var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = label; }, 1500); };
      var fallback = function () {
        var ta = make('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        ta.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    });
    return b;
  }

  function initCommands() {
    $$('pre.cmd').forEach(function (pre) {
      if (pre.parentNode.classList.contains('cmdbox')) return;
      var box = make('div', 'cmdbox');
      pre.parentNode.insertBefore(box, pre);
      if (pre.hasAttribute('data-live')) box.appendChild(make('span', 'live-tag', 'LIVE'));
      box.appendChild(pre);
      box.appendChild(copyButton('copy', 'Copy', 'Copy the command', function () { return pre.textContent.trim(); }));
    });
  }

  function commandColumn(id, steps) {
    var col = make('ol', 'cmd-col');
    col.setAttribute('aria-label', 'Commands of recording ' + id);
    steps.forEach(function (st, i) {
      var item = make('li', 'cmd-step ' + st.where);
      item.appendChild(make('span', 'cmd-where', (i + 1) + ' · ' + (st.where === 'claude' ? 'Claude Code' : 'Terminal')));
      var pre = make('pre', null, st.cmd);
      pre.title = (st.note ? st.note + '\n\n' : '') + st.cmd;
      item.appendChild(pre);
      item.appendChild(copyButton('copy', 'Copy', 'Copy step ' + (i + 1) + ' of recording ' + id, function () { return st.cmd; }));
      col.appendChild(item);
    });
    return col;
  }

  function filesPane(id, files) {
    var pane = make('details', 'term-files');
    pane.appendChild(make('summary', null, 'Files (' + files.length + ')'));
    var body = make('div', 'files-body');
    body.setAttribute('aria-label', 'Files of recording ' + id);
    pane.appendChild(body);
    // The file text goes into the page on the first open, so a closed pane adds no hidden text to the slide.
    pane.addEventListener('toggle', function () { if (pane.open && !body.firstChild) fillFiles(body, files); });
    return pane;
  }
  function fillFiles(body, files) {
    files.forEach(function (f, i) {
      var file = make('details', 'file');
      var src = window.FILES[f];
      file.open = i === Math.min(1, files.length - 1);
      file.appendChild(make('summary', null, 'demo/' + f));
      if (src.cut) {
        var open = make('a', 'copy', 'Open');
        open.href = 'demo/' + f;
        open.target = '_blank';
        open.rel = 'noopener';
        file.appendChild(open);
      } else {
        file.appendChild(copyButton('copy', 'Copy', 'Copy file demo/' + f, function () { return src.text; }));
      }
      file.appendChild(make('pre', null, src.text));
      body.appendChild(file);
    });
  }

  // Fewer rows give a larger font, because the player fits the whole terminal into the box.
  // Use data-rows to override the estimate (for example for a recording that moves the cursor).
  function termSize(data, rowsAttr) {
    var cols = 100, rows = 26, lines = 0;
    try {
      var all = data.split('\n');
      var head = JSON.parse(all[0]);
      cols = (head.term && head.term.cols) || head.width || cols;
      rows = (head.term && head.term.rows) || head.height || rows;
      for (var i = 1; i < all.length; i++) {
        if (all[i].charAt(0) !== '[') continue;
        var ev = JSON.parse(all[i]);
        if (ev[1] === 'o') lines += (ev[2].match(/\n/g) || []).length;
      }
    } catch (e) { /* keep the header size */ }
    var fit = rowsAttr || Math.min(rows, Math.max(10, lines + 3));
    return { cols: cols, rows: fit };
  }

  function initTerm(host) {
    if (host._ready) return;
    host._ready = true;
    var id = host.dataset.cast;
    var wrap = make('div', 'term-wrap');
    host.parentNode.insertBefore(wrap, host);
    var row = make('div', 'term-row');
    wrap.appendChild(row);
    row.appendChild(host);
    var steps = window.CMDS && window.CMDS[id];
    if (steps && steps.length) {
      var col = commandColumn(id, steps);
      row.appendChild(col);
      // One line per command only when the full cards do not fit, so no Copy button is out of view.
      requestAnimationFrame(function () { if (col.scrollHeight > col.clientHeight + 1) col.classList.add('dense'); });
    }
    var links = make('div', 'term-links');
    var files = window.RUNFILES && window.RUNFILES[id];
    if (files && files.length) links.appendChild(filesPane(id, files));
    [['Terminal video', 'video/term/' + id + '.mp4'], ['Animation video', 'video/anim/' + id + '.mp4']].forEach(function (l) {
      var a = make('a', null, l[0]);
      a.href = l[1];
      a.target = '_blank';
      a.rel = 'noopener';
      links.appendChild(a);
    });
    wrap.appendChild(links);
    var data = window.CASTS && window.CASTS[id];
    if (!data || typeof AsciinemaPlayer === 'undefined') {
      host.appendChild(make('div', 'term-missing', 'Recording ' + id + ' is not yet available.'));
      return;
    }
    var size = termSize(data, parseInt(host.dataset.rows, 10));
    host._player = AsciinemaPlayer.create({ data: data }, host, {
      cols: size.cols,
      rows: size.rows,
      autoPlay: false,
      preload: true,
      loop: false,
      fit: 'both',
      theme: 'monokai',
      speed: parseFloat(host.dataset.speed) || 1,
      idleTimeLimit: 2,
      terminalFontFamily: "'JetBrains Mono', Menlo, monospace",
      controls: 'auto'
    });
    host.addEventListener('mouseup', function () {
      setTimeout(function () { if (document.activeElement && host.contains(document.activeElement)) document.activeElement.blur(); }, 0);
    });
  }

  function quiet(p) { if (p && p.catch) p.catch(function () {}); }
  function termStep(host, step, prevStep) {
    var pl = host._player;
    if (!pl) return;
    var at = parseInt(host.dataset.playStep, 10) || 1;
    if (CAPTURE) {
      if (step >= at) quiet(pl.getDuration().then(function (d) { return pl.seek(d); }));
      return;
    }
    if (step >= at && prevStep < at) {
      quiet(Promise.resolve(pl.seek(0)).then(function () { return pl.play(); }));
    } else if (step < at && prevStep >= at) {
      quiet(Promise.resolve(pl.pause()).then(function () { return pl.seek(0); }));
    }
  }
  function termsLeave(s) {
    s.terms.forEach(function (h) { if (h._player) quiet(h._player.pause()); });
  }

  /* ---------- Counters (seekable: WAAPI animates --n, text is synced from it) ---------- */
  function fmtCount(e, v) { return e.dataset.countFmt === 'comma' ? v.toLocaleString('en-US') : String(v); }
  function setCount(e, v) { e.textContent = fmtCount(e, v); }
  function cancelCount(e) { if (e._anim) { e._anim.cancel(); e._anim = null; } }
  var tickOn = false;
  function syncCounters() {
    if (!S.cur) return false;
    var running = false;
    S.cur.counters.forEach(function (e) {
      if (!e._anim) return;
      var v = parseInt(getComputedStyle(e).getPropertyValue('--n'), 10);
      if (!isNaN(v)) setCount(e, v);
      if (e._anim.playState === 'running') running = true;
    });
    return running;
  }
  function tick() {
    if (syncCounters()) requestAnimationFrame(tick); else tickOn = false;
  }
  function applyCounters(s, step, animate) {
    s.counters.forEach(function (e) {
      var target = parseInt(e.dataset.count, 10) || 0;
      var from = parseInt(e.dataset.countStep, 10) || 1;
      var shouldShow = step >= from;
      if (shouldShow && !e._on) {
        e._on = true;
        cancelCount(e);
        if (animate && !motion.matches && e.animate) {
          e._anim = e.animate([{ '--n': 0 }, { '--n': target }], { duration: COUNT_MS, easing: 'ease-out', fill: 'forwards' });
          setCount(e, 0);
          if (!tickOn) { tickOn = true; requestAnimationFrame(tick); }
        } else {
          setCount(e, target);
        }
      } else if (!shouldShow && e._on) {
        e._on = false;
        cancelCount(e);
        setCount(e, 0);
      } else if (!shouldShow && !e._on) {
        setCount(e, 0);
      }
    });
  }

  /* ---------- Navigation ---------- */
  function applySteps(s, step) {
    s.stepEls.forEach(function (e) {
      var on = e._steps.indexOf(step) >= 0;
      e.classList.toggle('is-active', on);
      e.classList.toggle('is-dim', !on);
    });
    s.fromEls.forEach(function (e) {
      e.classList.toggle('is-future', step < e._from);
    });
  }

  function updateChrome() {
    var s = S.cur, step = S.step;
    var cap = s.captions[step - 1] || '';
    el.cap.textContent = cap;
    el.cap.classList.toggle('long', cap.length > 110);
    el.stepLabel.textContent = 'Step ' + step + ' of ' + s.steps;
    el.topic.textContent = s.topic;
    var counter = s.animOnly ? 'Animation ' + (s.cmd || '') : 'Slide ' + s.index + ' / ' + S.nav.length;
    el.counter.textContent = counter;
    el.dockCounter.textContent = counter;
    var pos = s.cumStart + s.minutes * (step / s.steps);
    S.topics.forEach(function (t) {
      var f = t.minutes > 0 ? clamp((pos - t.start) / t.minutes, 0, 1) : 0;
      if (s.animOnly) f = 0;
      t.seg.firstChild.style.width = (f * 100) + '%';
      t.seg.classList.toggle('is-current', t.name === s.topic);
    });
    el.prev.disabled = !prevTarget();
    el.next.disabled = !nextTarget();
    var label = S.playing ? 'Pause' : 'Play';
    el.play.innerHTML = S.playing ? ICON.pause : ICON.play;
    el.play.setAttribute('aria-label', label);
    el.play.title = label;
    document.title = (s.animOnly ? 'Animation ' + s.cmd : s.title) + ' | Workshop 1';
  }

  function nextTarget() {
    var s = S.cur;
    if (S.step < s.steps) return { id: s.id, step: S.step + 1 };
    if (s.animOnly) return null;
    var n = S.nav[s.index];
    return n ? { id: n.id, step: 1 } : null;
  }
  function prevTarget() {
    var s = S.cur;
    if (S.step > 1) return { id: s.id, step: S.step - 1 };
    if (s.animOnly) return null;
    var p = S.nav[s.index - 2];
    return p ? { id: p.id, step: p.steps } : null;
  }

  function go(id, step, opts) {
    opts = opts || {};
    var s = S.byId[id];
    if (!s) return false;
    step = clamp(parseInt(step, 10) || 1, 1, s.steps);
    var prevSlide = S.cur, prevStep = S.step;
    var newSlide = prevSlide !== s;
    if (!opts.fromTimer && S.playing) stopPlay();
    if (newSlide) {
      if (prevSlide) {
        prevSlide.el.classList.remove('is-current');
        termsLeave(prevSlide);
        prevSlide.counters.forEach(function (e) { cancelCount(e); e._on = false; });
      }
      s.el.classList.add('is-current');
      prevStep = 0;
    }
    S.cur = s;
    S.step = step;
    applySteps(s, step);
    applyCounters(s, step, !newSlide && step > prevStep);
    if (!PRESENTER) {
      s.terms.forEach(initTerm);
      s.terms.forEach(function (h) { termStep(h, step, prevStep); });
    }
    (hooks[s.id] || []).forEach(function (fn) { fn(step, s.el); });
    updateChrome();
    if (newSlide) renderNotes(el.nbody, s);
    markNotes(el.nbody, el.notes, step);
    if (PRESENTER) renderPresenter();
    if (!CAPTURE && !PRESENTER) {
      try { history.replaceState(null, '', '#' + s.id); } catch (e) {}
    }
    if (!opts.remote) broadcast({ t: 'state', id: s.id, step: step });
    listeners.forEach(function (fn) { fn(state()); });
    return true;
  }

  function next() { var t = nextTarget(); if (t) go(t.id, t.step); }
  function prev() { var t = prevTarget(); if (t) go(t.id, t.step); }
  function reset() { go(S.cur.id, 1); }
  function nextSlide() { var s = S.cur; var n = s.animOnly ? null : S.nav[s.index]; if (n) go(n.id, 1); }
  function prevSlide() { var s = S.cur; var p = s.animOnly ? null : S.nav[s.index - 2]; if (p) go(p.id, 1); }
  function first() { go(S.nav[0].id, 1); }
  function last() { var l = S.nav[S.nav.length - 1]; go(l.id, l.steps); }

  function stopPlay() {
    S.playing = false;
    clearTimeout(S.timer);
    if (S.cur) updateChrome();
  }
  function schedule() {
    clearTimeout(S.timer);
    S.timer = setTimeout(function () {
      if (!S.playing) return;
      if (S.step < S.cur.steps) go(S.cur.id, S.step + 1, { fromTimer: true });
      if (S.step >= S.cur.steps) stopPlay(); else schedule();
    }, STEP_MS);
  }
  function startPlay() {
    if (S.step >= S.cur.steps) go(S.cur.id, 1);
    S.playing = true;
    updateChrome();
    schedule();
  }
  function toggle() { if (S.playing) stopPlay(); else startPlay(); }

  function state() {
    var s = S.cur;
    return { id: s.id, step: S.step, steps: s.steps, index: s.index, count: S.nav.length, caption: s.captions[S.step - 1] || '', title: s.title, topic: s.topic, playing: S.playing };
  }

  /* ---------- Keyboard ---------- */
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && e.target.closest && e.target.closest('button, a, input, select, textarea, summary, [contenteditable="true"]')) return;
    var k = e.key, handled = true;
    if (k === 'ArrowRight' || k === ' ' || k === 'Spacebar') next();
    else if (k === 'ArrowLeft') prev();
    else if (k === 'PageDown') nextSlide();
    else if (k === 'PageUp') prevSlide();
    else if (k === 'Home') first();
    else if (k === 'End') last();
    else if (k === 'n' || k === 'N') { if (PRESENTER) handled = false; else toggleNotes(); }
    else if (k === 'p' || k === 'P') { if (PRESENTER) handled = false; else openPresenter(); }
    else if (k === 't' || k === 'T') { if (window.Theme) window.Theme.cycle(); }
    else if (k === 'r' || k === 'R') reset();
    else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    } else handled = false;
    if (handled) e.preventDefault();
  }

  /* ---------- Touch: tap the right half for next, the left half for previous ---------- */
  var TAP_IGNORE = 'button, a, input, select, textarea, summary, details, label, [contenteditable="true"], .term, .cmd-col';
  var lastPointer = '';
  function onTap(e) {
    if (lastPointer !== 'touch' && lastPointer !== 'pen') return;
    if (e.target.closest(TAP_IGNORE)) return;
    var r = el.fit.getBoundingClientRect();
    var turned = window.matchMedia(TURNED).matches && !PRESENTER && !CAPTURE;
    // Turned 90deg clockwise, the slide's right half is the bottom half of the screen.
    var along = turned ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    if (along >= 0.5) next(); else prev();
  }

  /* ---------- Sync between the deck window and the presenter window ---------- */
  function broadcast(msg) {
    msg.w1 = 1;
    msg.src = instance;
    if (channel) { try { channel.postMessage(msg); } catch (e) {} }
    var targets = [];
    if (window.opener && !window.opener.closed) targets.push(window.opener);
    if (presenterWin && !presenterWin.closed) targets.push(presenterWin);
    targets.forEach(function (w) { try { w.postMessage(msg, '*'); } catch (e) {} });
  }
  function receive(msg) {
    if (!msg || msg.w1 !== 1 || msg.src === instance || !S.cur) return;
    if (msg.t === 'hello') {
      if (!PRESENTER) broadcast({ t: 'state', id: S.cur.id, step: S.step, reply: true });
    } else if (msg.t === 'state') {
      if (msg.id !== S.cur.id || msg.step !== S.step) go(msg.id, msg.step, { remote: true });
      if (PRESENTER && !msg.reply) timerAutoStart();
    }
  }
  function openPresenter() {
    var url = location.href.split('#')[0].split('?')[0] + '?presenter=1';
    presenterWin = window.open(url, 'w1-presenter', 'popup=yes,width=1180,height=780');
  }

  /* ---------- Presenter view ---------- */
  var P = { acc: 0, t0: 0, running: false, auto: false };
  function timerLoad() {
    try {
      var v = JSON.parse(localStorage.getItem(TIMER_KEY));
      if (v) { P.acc = v.acc || 0; P.t0 = v.t0 || 0; P.running = !!v.running; P.auto = !!v.auto; }
    } catch (e) {}
  }
  function timerSave() { try { localStorage.setItem(TIMER_KEY, JSON.stringify({ acc: P.acc, t0: P.t0, running: P.running, auto: P.auto })); } catch (e) {} }
  function elapsed() { return P.acc + (P.running ? Date.now() - P.t0 : 0); }
  function timerStart() { if (!P.running) { P.running = true; P.t0 = Date.now(); P.auto = true; timerSave(); } }
  function timerPause() { if (P.running) { P.acc = elapsed(); P.running = false; timerSave(); } }
  function timerReset() { P.acc = 0; P.running = false; P.auto = false; timerSave(); }
  function timerAutoStart() { if (!P.auto && !P.running && P.acc === 0) timerStart(); }

  function buildPresenter() {
    var root = $('#presenter');
    root.innerHTML =
      '<header class="pres-head">' +
      '<div class="pres-block"><span class="pres-label">Clock</span><span class="pres-clock" id="p-clock">--:--</span></div>' +
      '<div class="pres-block"><span class="pres-label">Elapsed</span><span class="pres-val" id="p-elapsed">0:00</span></div>' +
      '<div class="pres-block"><span class="pres-label">Plan: end of this slide</span><span class="pres-val" id="p-plan">0:00</span></div>' +
      '<div class="pres-block"><span class="pres-label">Total plan</span><span class="pres-val" id="p-total">0:00</span></div>' +
      '<span class="pres-status" id="p-status" role="status">On time</span>' +
      '<span data-theme-toggle style="margin-left:auto"></span>' +
      '</header>' +
      '<section class="pres-main">' +
      '<span class="pres-label" id="p-topic"></span><h1 id="p-title"></h1>' +
      '<p class="pres-step" id="p-step"></p><p class="pres-caption" id="p-cap" aria-live="polite"></p>' +
      '<div class="pres-notes" id="p-notes" lang="bn"></div>' +
      '</section>' +
      '<aside class="pres-side"><span class="pres-label">Next</span><h2 id="p-next"></h2><p id="p-next-sub"></p>' +
      '<div class="pres-btns" id="p-btns"></div>' +
      '<p class="pres-hint">Keys: Right or Space = next step, Left = previous step, Page Down/Up = slide, Home/End, T = theme, R = reset.</p>' +
      '</aside>';
    var btns = $('#p-btns');
    [['Previous', prev], ['Next', next, 'primary'], ['Start timer', function () { timerStart(); }], ['Pause timer', function () { timerPause(); }], ['Reset timer', function () { timerReset(); }]].forEach(function (d) {
      var b = make('button', d[2] || '', d[0]);
      b.type = 'button';
      b.addEventListener('click', function () { d[1](); tickPresenter(); });
      btns.appendChild(b);
    });
    if (window.Theme) window.Theme.mount($('[data-theme-toggle]', root));
    $('#p-total').textContent = mmss(S.totalMin * 60000);
    timerLoad();
    setInterval(tickPresenter, 250);
  }
  function renderPresenter() {
    var s = S.cur;
    $('#p-topic').textContent = s.topic;
    $('#p-title').textContent = s.title;
    $('#p-step').textContent = 'Step ' + S.step + ' of ' + s.steps + (s.animOnly ? '' : '   |   Slide ' + s.index + ' / ' + S.nav.length);
    $('#p-cap').textContent = s.captions[S.step - 1] || '';
    var box = $('#p-notes');
    if (box._for !== s.id) { renderNotes(box, s); box._for = s.id; }
    markNotes(box, box, S.step);
    var nt = nextTarget();
    var nextEl = $('#p-next'), sub = $('#p-next-sub');
    if (!nt) { nextEl.textContent = 'End of the deck'; sub.textContent = ''; }
    else if (nt.id === s.id) { nextEl.textContent = 'Step ' + nt.step + ' of ' + s.steps; sub.textContent = s.captions[nt.step - 1] || ''; }
    else { var n = S.byId[nt.id]; nextEl.textContent = n.title; sub.textContent = n.topic + (n.minutes ? ' (' + n.minutes + ' min)' : ''); }
    tickPresenter();
  }
  function tickPresenter() {
    var s = S.cur;
    if (!s) return;
    var d = new Date();
    $('#p-clock').textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    var el_ms = elapsed();
    $('#p-elapsed').textContent = mmss(el_ms) + (P.running ? '' : ' (paused)');
    var st = $('#p-status');
    if (s.animOnly) { $('#p-plan').textContent = '-'; st.textContent = 'Animation slide'; st.className = 'pres-status'; return; }
    var planEnd = (s.cumStart + s.minutes) * 60000, planStart = s.cumStart * 60000, slack = 30000;
    $('#p-plan').textContent = mmss(planEnd);
    if (el_ms > planEnd + slack) { st.textContent = 'Behind ' + mmss(el_ms - planEnd); st.className = 'pres-status behind'; }
    else if (el_ms < planStart - slack) { st.textContent = 'Ahead ' + mmss(planStart - el_ms); st.className = 'pres-status ahead'; }
    else { st.textContent = 'On time'; st.className = 'pres-status'; }
  }

  /* ---------- Init ---------- */
  function init() {
    collect();
    if (!S.slides.length) { console.warn('[deck] no slides'); return; }
    buildTopics();
    buildChrome();
    initCommands();
    if (PRESENTER) { document.body.classList.add('presenter'); buildPresenter(); }
    if (CAPTURE) document.body.classList.add('capture');

    document.addEventListener('keydown', onKey);
    el.fit.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType; });
    el.fit.addEventListener('click', onTap);
    window.addEventListener('message', function (e) { receive(e.data); });
    if (channel) channel.onmessage = function (e) { receive(e.data); };

    var h = (location.hash || '').replace(/^#/, '').split('/');
    var id = params.get('slide') || h[0];
    var step = params.get('step') || h[1] || 1;
    if (!S.byId[id]) id = S.nav.length ? S.nav[0].id : S.slides[0].id;
    go(id, step, { remote: true });
    if (PRESENTER) broadcast({ t: 'hello' });
    Deck.isReady = true;
    document.documentElement.setAttribute('data-deck-ready', '1');
  }

  var Deck = {
    isReady: false,
    go: go,
    next: next,
    prev: prev,
    reset: reset,
    play: startPlay,
    pause: stopPlay,
    steps: function (id) { var s = S.byId[id]; return s ? s.steps : 0; },
    state: function () { return S.cur ? state() : null; },
    slides: function () {
      return S.slides.map(function (s) {
        return { id: s.id, title: s.title, topic: s.topic, minutes: s.minutes, steps: s.steps, animOnly: s.animOnly, cmd: s.cmd, index: s.index, captions: s.captions.slice() };
      });
    },
    onStep: function (id, fn) { (hooks[id] = hooks[id] || []).push(fn); },
    onChange: function (fn) { listeners.push(fn); },
    sync: syncCounters
  };
  window.Deck = Deck;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
