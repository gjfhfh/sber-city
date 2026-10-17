/* Звук: синтезируется на лету через WebAudio — ни одного аудиофайла.
   По умолчанию выключен и включается только кнопкой (требование трека). */
(function (root) {
  'use strict';
  var ctx = null, on = false, master = null;
  function ensure() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
    return ctx;
  }
  function tone(freq, t0, dur, type, vol, slide) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.5, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  var SFX = {
    tap: function (t) { tone(660, t, 0.08, 'triangle', 0.35); },
    swipe: function (t) { tone(420, t, 0.16, 'sine', 0.3, 880); },
    coin: function (t) { tone(988, t, 0.09, 'square', 0.18); tone(1319, t + 0.08, 0.22, 'square', 0.18); },
    good: function (t) { tone(523, t, 0.12, 'triangle', 0.4); tone(659, t + 0.1, 0.12, 'triangle', 0.4); tone(784, t + 0.2, 0.25, 'triangle', 0.4); },
    soft: function (t) { tone(392, t, 0.16, 'triangle', 0.35); tone(330, t + 0.14, 0.22, 'triangle', 0.3); },
    news: function (t) { tone(880, t, 0.1, 'sine', 0.3); tone(1175, t + 0.1, 0.18, 'sine', 0.3); },
    win: function (t) { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * 0.12, 0.3, 'triangle', 0.4); }); },
    build: function (t) { tone(196, t, 0.5, 'sawtooth', 0.12, 392); tone(523, t + 0.45, 0.4, 'triangle', 0.35); }
  };
  root.Sound = {
    get on() { return on; },
    toggle: function () {
      on = !on;
      if (on && ensure()) { if (ctx.state === 'suspended') ctx.resume(); this.play('tap'); }
      return on;
    },
    play: function (name) {
      if (!on || !ctx || !SFX[name]) return;
      try { SFX[name](ctx.currentTime + 0.01); } catch (e) { /* звук не критичен */ }
    },
    pause: function () { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume: function () { if (ctx && on && ctx.state === 'suspended') ctx.resume(); }
  };
})(this);
