// One Shape v2 (Dubstep only) synth, copied verbatim from src/app-v2.html (the WORKLET string) — DRUB v3 adds only a bass meter (measuring, no sound change)

const TAU = Math.PI * 2, TAPE_D = 1.4;
function svfCoef(fc, q) { const g = Math.tan(Math.PI * Math.min(fc, sampleRate * 0.42) / sampleRate), k = 1 / q; const a1 = 1 / (1 + g * (g + k)); return [a1, g * a1, g * g * a1, k]; }
class Synth extends AudioWorkletProcessor {
  constructor() {
    super();
    const N = 16384; this.N = N;
    this.qF = new Float64Array(N); this.qT = new Int32Array(N); this.qA = new Float64Array(N);
    this.qB = new Float64Array(N); this.qI = new Float64Array(N); this.qS = new Float64Array(N);
    this.qn = 0; this.seq = 0; this.next = Infinity;
    this.kTy = new Uint8Array(2);
    this.KP = [[42, 130, 28, 7, 1.8], [45, 80, 20, 4.5, 1.2], [48, 180, 35, 6, 3], [50, 90, 30, 10, 1.1], [52, 160, 40, 12, 2], [56, 30, 22, 6.5, 0.9]];   // f0, sweep, sweep decay, amp decay, drive; 5 = acoustic
    this.xOn = new Uint8Array(6); this.xT = new Float64Array(6); this.xTy = new Uint8Array(6); this.xV = new Float64Array(6); this.xPh = new Float64Array(6);
    this.kOn = new Uint8Array(2); this.kT = new Float64Array(2); this.kPh = new Float64Array(2); this.kV = new Float64Array(2);
    this.sOn = new Uint8Array(2); this.sT = new Float64Array(2); this.sPh = new Float64Array(2); this.sV = new Float64Array(2);
    this.hOn = new Uint8Array(3); this.hT = new Float64Array(3); this.hV = new Float64Array(3);
    this.cOn = new Uint8Array(4); this.cT = new Float64Array(4); this.cPh = new Float64Array(4); this.cF = new Float64Array(4); this.cV = new Float64Array(4); this.cD = new Float64Array(4);
    this.pOn = new Uint8Array(8); this.pT = new Float64Array(8); this.pPh = new Float64Array(8); this.pM = new Float64Array(8);
    this.pF = new Float64Array(8); this.pV = new Float64Array(8); this.pK = new Uint8Array(8);
    this.pEnd = [1.5, 3.2, 2.5, 3.5, 2.6, 4.0, 1.6];
    const B2 = () => new Float64Array(2);
    this.bG = B2(); this.bE = B2(); this.bF = new Float64Array([110, 110]); this.bFT = new Float64Array([110, 110]);
    this.bP = B2(); this.bS = B2(); this.bFE = B2(); this.bV = new Float64Array([0.9, 0.9]); this.bz1 = B2(); this.bz2 = B2(); this.bTone = 0;
    const sr = sampleRate;
    this.cA = 1 - Math.exp(-1 / (0.003 * sr)); this.cR = 1 - Math.exp(-1 / (0.09 * sr)); this.cDamp = Math.exp(-1 / (0.035 * sr)); this.cGr = 1 - Math.exp(-1 / (0.012 * sr)); this.cGl = 1 - Math.exp(-1 / (0.018 * sr)); this.cGlp = 1 - Math.exp(-TAU * 6000 / sr);   // a choked guitar chord dies in ~35 ms
    this.cG = 1 - Math.exp(-1 / (0.012 * sr)); this.cFE = Math.exp(-1 / (0.16 * sr)); this.cSm = 1 - Math.exp(-1 / (0.02 * sr));
    [this.ba1, this.ba2, this.ba3, this.bk] = svfCoef(1900, 0.8); this.bn1 = 0; this.bn2 = 0;
    [this.ha1, this.ha2, this.ha3, this.hk] = svfCoef(7500, 0.7); this.hn1 = 0; this.hn2 = 0;
    this.fx = 0.5; this.fy = 0.5; this.fxs = 0.5; this.fys = 0.5;
    this.l1 = 0; this.l2 = 0; this.h1 = 0; this.h2 = 0; this.coef();
    this.tOn = 0; this.tS = 0; this.rng = 0x2545F491;
    this.kit = 0;
    // recorded instruments: 24 one-shot voices (chords with long tails overlap) and one per bass voice
    this.as = null; this.asets = null; this.abSet = 0; this.chokeF = -1; this.rr = 0; this.nI = 0; this.nR = 1;
    this.aOn = new Uint8Array(24); this.aS = new Int32Array(24); this.aPos = new Float64Array(24); this.aRate = new Float64Array(24); this.aG = new Float64Array(24); this.aT = new Float64Array(24); this.aX = new Uint8Array(24); this.aLast = 0; this.aHold = new Float64Array(24); this.aSd = new Float64Array(24); this.chF = [-1, -1, -1];
    // growl (the dubstep drop): one voice; three detuned saws and a square an octave down, filtered per shape, driven, over a sine sub
    this.grOn = 0; this.grT = 0; this.grDur = 0; this.grF = 55; this.grFs = 55; this.grR = 0; this.grSh = 0; this.grE = 0; this.grL = 0;
    this.grP = new Float64Array(5); this.grZ = new Float64Array(8); this.grLp = 0; this.gB = 0;
    this.abOn = new Uint8Array(2); this.abS = new Int32Array(2); this.abPos = new Float64Array(2); this.abRate = new Float64Array(2); this.abRateT = new Float64Array(2); this.abM = new Float64Array(2); this.nM = 0;
    this.abEnv = new Float64Array(2); this.abMk = 8.5; this.cCa = 1 - Math.exp(-1 / (0.001 * sampleRate)); this.cCr = 1 - Math.exp(-1 / (0.18 * sampleRate));
    this.cSl = 1 - Math.exp(-1 / (0.03 * sampleRate));   // a finger slide on the upright: 30 ms
    // modelled fallback. Plucked strings (Karplus-Strong): 6 guitar voices and the 2 bass voices, each with its own delay line
    const SZ = 2048; this.SZ = SZ;
    this.gBuf = new Float32Array(6 * SZ); this.gOn = new Uint8Array(6); this.gT = new Float64Array(6); this.gL = new Float64Array(6);
    this.gW = new Int32Array(6); this.gZ = new Float64Array(6); this.gV = new Float64Array(6); this.gLp = new Float64Array(6);
    this.kbBuf = new Float32Array(2 * SZ); this.kbW = new Int32Array(2); this.kbZ = new Float64Array(2); this.kbLp = new Float64Array(2);
    this.pZ = new Float64Array(8); this.wobR = 0; this.wobP = 0;                           // drive tone filter; bass wobble
    this.pM2 = new Float64Array(8); this.pH = new Float64Array(8 * 5);                    // marimba and piano partials
    this.sAc = new Uint8Array(2); this.sPh2 = new Float64Array(2);                        // snare body modes
    this.hAc = new Uint8Array(3); this.hPh = new Float64Array(3 * 6);                     // metallic hats
    this.xAc = new Uint8Array(6); this.xPh2 = new Float64Array(6);                        // cross-stick second mode
    this.METAL = [1.0, 1.304, 1.659, 2.1, 2.47, 2.95];
    // a small room (Schroeder: 4 combs, 2 allpasses) that only the acoustic sounds feed
    const sc = sr / 44100;
    const fvC = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], fvA = [556, 441, 341, 225];    // Freeverb, right channel spread by 23
    this.fcL = fvC.map(k => new Float32Array(Math.round(k * sc))); this.fcR = fvC.map(k => new Float32Array(Math.round((k + 23) * sc)));
    this.faL = fvA.map(k => new Float32Array(Math.round(k * sc))); this.faR = fvA.map(k => new Float32Array(Math.round((k + 23) * sc)));
    this.fcIL = new Int32Array(8); this.fcIR = new Int32Array(8); this.fcSL = new Float64Array(8); this.fcSR = new Float64Array(8);
    this.faIL = new Int32Array(4); this.faIR = new Int32Array(4);
    this.lr1 = 0; this.lr2 = 0; this.hr1 = 0; this.hr2 = 0;
    this.port.onmessage = e => this.msg(e.data);
  }
  mv(i, j) { this.qF[j] = this.qF[i]; this.qT[j] = this.qT[i]; this.qA[j] = this.qA[i]; this.qB[j] = this.qB[i]; this.qI[j] = this.qI[i]; this.qS[j] = this.qS[i]; }
  recalc() { let m = Infinity; for (let i = 0; i < this.qn; i++) if (this.qF[i] < m) m = this.qF[i]; this.next = m; }
  msg(d) {
    if (d.acSamples) { this.as = d.acSamples; this.asets = d.acSets; }
    if (d.clear) { this.qn = 0; this.next = Infinity; this.bG.fill(0); this.tOn = 0; }
    if (d.cancelFrom !== undefined) { let j = 0; for (let i = 0; i < this.qn; i++) { if (this.qF[i] >= d.cancelFrom && (this.qT[i] <= 9 || (this.qT[i] >= 15 && this.qT[i] <= 19) || this.qT[i] === 21 || this.qT[i] === 22 || this.qT[i] === 24)) continue; if (i !== j) this.mv(i, j); j++; } this.qn = j; this.recalc(); }
    if (d.cancelGrid !== undefined) { let j = 0; for (let i = 0; i < this.qn; i++) { if (this.qF[i] >= d.cancelGrid && this.qI[i] >= 1e7) continue; if (i !== j) this.mv(i, j); j++; } this.qn = j; this.recalc(); }
    if (d.cancelId !== undefined) { let j = 0; for (let i = 0; i < this.qn; i++) { if (this.qI[i] === d.cancelId) continue; if (i !== j) this.mv(i, j); j++; } this.qn = j; this.recalc(); }
    if (d.ev) { const a = d.ev; for (let i = 0; i + 4 < a.length; i += 5) { if (this.qn >= this.N) break; const k = this.qn++; this.qT[k] = a[i]; this.qF[k] = a[i + 1]; this.qA[k] = a[i + 2]; this.qB[k] = a[i + 3]; this.qI[k] = a[i + 4]; this.qS[k] = this.seq++; if (a[i + 1] < this.next) this.next = a[i + 1]; } }
    if (d.ping !== undefined) this.port.postMessage({ pong: d.ping });
  }
  // the recording nearest to a pitch; sets this.nI (sample) and this.nR (playback rate)
  acNear(list, hz) {
    const m = 69 + 12 * Math.log2(hz / 440);
    let b = 0;
    for (let j = 1; j < list.length; j++) if (Math.abs(m - list[j].root) < Math.abs(m - list[b].root)) b = j;
    // several takes of the same note: take turns, so a repeated note never sounds identical
    let n = 0; for (let j = 0; j < list.length; j++) if (Math.abs(list[j].root - list[b].root) < 0.5) n++;
    if (n > 1) { let c = this.rr++ % n; for (let j = 0; j < list.length; j++) if (Math.abs(list[j].root - list[b].root) < 0.5 && c-- === 0) { b = j; break; } }
    this.nI = list[b].i; this.nM = list[b].root; this.nR = Math.pow(2, (m - list[b].root) / 12);
  }
  acPlay(idx, rate, gain) {
    const i = this.pick(this.aOn, this.aT);
    this.aOn[i] = 1; this.aS[i] = idx; this.aPos[i] = 0; this.aRate[i] = rate; this.aG[i] = gain; this.aT[i] = 0; this.aX[i] = 0; this.aHold[i] = 1e9; this.aSd[i] = 0.1; this.aLast = i;
  }
  // 4-point cubic (Hermite) read between samples: clean re-pitching, no dulling
  herm(d, p) {
    const i = p | 0, f = p - i, xm = d[i > 0 ? i - 1 : 0], x0 = d[i], x1 = d[i + 1], x2 = d[i + 2 < d.length ? i + 2 : i + 1];
    const c = (x1 - xm) * 0.5, v = x0 - x1, w = c + v, a = w + v + (x2 - x0) * 0.5, b = w + a;
    return ((a * f - b) * f + c) * f + x0;
  }
  // growl filter stage o (state in grZ[o], grZ[o+1]): returns the low-pass, leaves the band-pass in gB. No allocation per sample.
  gsvf(x, fc, q, o) {
    const Z = this.grZ, g = Math.tan(Math.PI * Math.min(fc, sampleRate * 0.42) / sampleRate), a1 = 1 / (1 + g * (g + 1 / q)), a2 = g * a1, a3 = g * a2;
    const v3 = x - Z[o + 1], v1 = a1 * Z[o] + a2 * v3, v2 = Z[o + 1] + a2 * Z[o] + a3 * v3;
    Z[o] = 2 * v1 - Z[o]; Z[o + 1] = 2 * v2 - Z[o + 1]; this.gB = v1; return v2;
  }
  // one player per group (1 guitar, 2 bass): a new note at a new moment damps the group's ringing notes
  choke(g, f) { if (f === this.chF[g]) return; for (let k = 0; k < 24; k++) if (this.aOn[k] && this.aX[k] === g) this.aX[k] = 9; this.chF[g] = f; }
  // a drum one-shot; takes turns between recordings so repeats never sound identical
  acHit(set, gain) {
    if (!this.kit || !this.asets) return false;
    const L = this.asets[set]; if (!L || !L.length) return false;
    this.acPlay(L[this.rr++ % L.length].i, 1, gain);
    return true;
  }
  // fill a string's delay line with a filtered noise burst (the pluck); returns the write position
  pluck(buf, off, freq, bright, amp) {
    const n = Math.min(this.SZ - 1, Math.ceil(sampleRate / freq) + 2);
    let lp = 0;
    for (let j = 0; j < n; j++) { let r = this.rng; r ^= r << 13; r ^= r >>> 17; r ^= r << 5; this.rng = r; lp += (r / 2147483648 - lp) * bright; buf[off + j] = lp * amp; }
    return n;
  }
  pick(on, T) { for (let i = 0; i < on.length; i++) if (!on[i]) return i; let b = 0; for (let i = 1; i < on.length; i++) if (T[i] > T[b]) b = i; return b; }
  due(f) {
    for (;;) {
      let b = -1;
      for (let i = 0; i < this.qn; i++) if (this.qF[i] <= f && (b < 0 || this.qF[i] < this.qF[b] || (this.qF[i] === this.qF[b] && this.qS[i] < this.qS[b]))) b = i;
      if (b < 0) break;
      this.apply(this.qT[b], this.qA[b], this.qB[b], this.qI[b], f);
      this.qn--; if (b !== this.qn) this.mv(this.qn, b);
    }
    this.recalc();
  }
  apply(ty, a, b, id, f) {
    let i;
    const v = id === 1 ? 1 : 0;
    switch (ty) {
      case 1: {                                    // b >= 10: a recording on top of the synth kick's sub (dubstep)
        const lay = b >= 10; if (lay) b -= 10;
        if (this.acHit('kick', lay ? a * 0.6 : a) && !lay) break;
        i = this.pick(this.kOn, this.kT); this.kOn[i] = 1; this.kT[i] = 0; this.kPh[i] = 0; this.kV[i] = lay ? a * 0.75 : a; this.kTy[i] = this.kit && !lay ? 5 : b | 0; break; }
      case 2: if (b === 1 && this.acHit('snare', a)) {   // the big snare: snare and clap together, opening into the room
          this.aSd[this.aLast] = 0.9; if (this.acHit('clap', a * 0.7)) this.aSd[this.aLast] = 0.9; break; }
        if (this.acHit('snare', a)) break;
        i = this.pick(this.sOn, this.sT); this.sOn[i] = 1; this.sT[i] = 0; this.sPh[i] = 0; this.sPh2[i] = 0; this.sV[i] = a; this.sAc[i] = this.kit; break;
      case 21: if (this.acHit('ride', Math.min(1, a * 1.3))) break;
      // falls through: until the ride recording arrives, a hat stands in
      case 3: if (this.acHit('chh', Math.min(1, a * 1.5))) break;
        i = this.pick(this.hOn, this.hT); this.hOn[i] = 1; this.hT[i] = 0; this.hV[i] = a; this.hAc[i] = this.kit; break;
      case 4:                                      // metronome: recorded claves in the acoustic kit (strong take on the downbeat)
        if (this.kit && this.asets && this.asets.clave.length > 1) { this.acPlay(this.asets.clave[a > 0.6 ? 0 : 1].i, 1, Math.min(1, a * 1.2)); break; }
        i = this.pick(this.cOn, this.cT); this.cOn[i] = 1; this.cT[i] = 0; this.cPh[i] = 0; this.cF[i] = a > 0.9 ? 2200 : 1500; this.cV[i] = 0.6 * a; this.cD[i] = 120; break;
      case 6:                                      // interface tick: a soft woodblock, pitched so each action keeps its own note
        if (this.kit && this.asets && this.asets.wood.length) { const W = this.asets.wood; this.acPlay(W[this.rr++ % W.length].i, Math.sqrt(a / 880), Math.min(1, b * 1.1)); break; }
        i = this.pick(this.cOn, this.cT); this.cOn[i] = 1; this.cT[i] = 0; this.cPh[i] = 0; this.cF[i] = a; this.cV[i] = 0.2 * b; this.cD[i] = 95; break;
      case 5: case 7: case 8: case 9: case 24:
        i = this.pick(this.pOn, this.pT); this.pOn[i] = 1; this.pT[i] = 0; this.pPh[i] = 0; this.pM[i] = 0; this.pM2[i] = 0; this.pF[i] = a; this.pV[i] = b;
        this.pK[i] = ty === 5 ? 0 : ty === 24 ? 6 : ty - 6; this.pZ[i] = 0; break;
      case 10: this.wobP = 0; if (this.kit && this.asets && this.asets.bass.length) { this.acNear(this.abSet && this.asets.ebass.length ? this.asets.ebass : this.asets.bass, a); this.abOn[v] = 1; this.abS[v] = this.nI; this.abPos[v] = 0; this.abRate[v] = this.abRateT[v] = this.nR; this.abM[v] = this.nM; this.bF[v] = a; }
        else if (this.kit) { this.kbW[v] = this.pluck(this.kbBuf, v * this.SZ, a, 0.3, 1.2); this.kbZ[v] = 0; this.kbLp[v] = 0; this.bF[v] = a; }
        this.bG[v] = 1; this.bFT[v] = a; if (this.bE[v] < 0.02) this.bF[v] = a; this.bFE[v] = 1; this.bV[v] = b; break;
      case 11: this.bFT[v] = a; if (this.bFE[v] < 0.7) this.bFE[v] = 0.7;
        if (this.kit && this.bG[v] && this.asets && this.asets.bass.length) {
          const mm = 69 + 12 * Math.log2(a / 440);
          if (this.abOn[v] && Math.abs(mm - this.abM[v]) <= 5) this.abRateT[v] = Math.pow(2, (mm - this.abM[v]) / 12);   // slide the finger
          else { this.acNear(this.abSet && this.asets.ebass.length ? this.asets.ebass : this.asets.bass, a); this.abOn[v] = 1; this.abS[v] = this.nI; this.abPos[v] = 0; this.abRate[v] = this.abRateT[v] = this.nR; this.abM[v] = this.nM; }   // too far: pluck again
          this.bF[v] = a; }
        else if (this.kit && this.bG[v]) { this.kbW[v] = this.pluck(this.kbBuf, v * this.SZ, a, 0.3, 0.9); this.kbZ[v] = 0; this.bF[v] = a; }   // each new note is plucked
        break;
      case 12: this.bG[v] = 0; break;
      case 13: this.bTone = a | 0; break;
      case 25: this.abSet = a; break;
      case 26: this.acHit('crash', a); break;
      case 27: {                                   // growl: a = Hz, b = length ms * 1e4 + wobble Hz * 100 + shape
        const ms = Math.floor(b / 10000), r = b - ms * 10000;
        this.grOn = 1; this.grT = 0; this.grDur = ms / 1000; this.grR = Math.floor(r / 10) / 10; this.grSh = r % 10; this.grF = a; this.grL = 0;
        if (this.grE < 0.01) { this.grFs = a; for (let j = 0; j < 8; j++) this.grZ[j] = 0; }
        break; }
      case 28: {                                   // rock guitar: a whole power chord recorded through the amp, b = velocity (+10 rings open)
        const open = b >= 10, set = this.asets && (open ? this.asets.rockO : this.asets.rockP);
        if (!set || !set.length) break;
        this.choke(1, f); this.acNear(set, a); this.acPlay(this.nI, this.nR, open ? b - 10 : b);
        this.aX[this.aLast] = 1; this.aSd[this.aLast] = 0.03; break; }
      case 29:                                     // recorded electric bass under the riff
        if (!this.asets || !this.asets.ebass.length) break;
        this.choke(2, f); this.acNear(this.asets.ebass, a); this.acPlay(this.nI, this.nR, b * 0.95); this.aX[this.aLast] = 2; this.aSd[this.aLast] = 0.02; break;
      case 23: this.wobR = a; break;
      case 14: this.kit = a | 0; break;
      case 22:                                     // tambourine: a hit on the strong steps, a shake in between
        if (this.kit && this.asets) {
          const T = a > 0.5 ? this.asets.tambHit : this.asets.tambShake;
          if (T && T.length) { this.acPlay(T[this.rr++ % T.length].i, 1, a * 0.7); break; }
        }
      // falls through: until the tambourine arrives, the shaker stands in
      case 16: case 17: case 18: case 19:
        if (this.acHit(ty === 16 ? 'clap' : ty === 17 ? 'side' : ty === 18 ? 'ohh' : 'shaker', Math.min(1, a * 1.3))) break;
        i = this.pick(this.xOn, this.xT); this.xOn[i] = 1; this.xT[i] = 0; this.xTy[i] = ty; this.xV[i] = a; this.xPh[i] = 0; this.xPh2[i] = 0; this.xAc[i] = this.kit; break;
      case 15: {                                   // acoustic melody: 0 guitar (plucked string), 1 marimba, 2 piano
        const inst = Math.floor(b / 10), vel = b - inst * 10;
        if (this.kit && this.asets && this.asets.mel[inst].length) {
          // electric guitar: one player, one chord at a time; a new chord damps the last one (notes of the same chord share a frame)
          if (inst === 4) this.choke(1, f);
          this.acNear(this.asets.mel[inst], a); this.acPlay(this.nI, this.nR, vel * (inst === 3 ? 0.45 : inst === 4 ? 0.5 : 1));
          if (inst === 4) this.aX[this.aLast] = 1;
          break; }   // vibes ring long and stack up: set lower   // vibes ring long and stack up: set lower
        if (inst === 0) {
          i = this.pick(this.gOn, this.gT); this.gOn[i] = 1; this.gT[i] = 0; this.gV[i] = vel; this.gZ[i] = 0; this.gLp[i] = 0;
          this.gL[i] = sampleRate / a - 0.5; this.gW[i] = this.pluck(this.gBuf, i * this.SZ, a, 0.55, 1);
        } else {
          i = this.pick(this.pOn, this.pT); this.pOn[i] = 1; this.pT[i] = 0; this.pPh[i] = 0; this.pM[i] = 0; this.pM2[i] = 0;
          for (let m = 0; m < 5; m++) this.pH[i * 5 + m] = 0;
          this.pF[i] = a; this.pV[i] = vel; this.pK[i] = inst === 1 ? 4 : 5;
        }
        break;
      }
      case 20: this.fx = a; this.fy = b; break;
      case 30: this.tOn = 1; this.tS = f; break;
      case 31: this.tOn = 0; break;
    }
  }
  coef() {
    const x = this.fxs, r = 1 - this.fys;
    let fL = 20000, qL = 0.707, fH = 10, qH = 0.707;
    if (x < 0.5) { fL = 70 * Math.pow(2, (x / 0.5) * 8.2); qL = 0.707 + r * r * 9 * Math.min(1, (0.5 - x) / 0.12); }
    else { fH = 10 * Math.pow(2, ((x - 0.5) / 0.5) * 9.3); qH = 0.707 + r * r * 9 * Math.min(1, (x - 0.5) / 0.12); }
    [this.la1, this.la2, this.la3, this.lk] = svfCoef(fL, qL);
    [this.ha1m, this.ha2m, this.ha3m, this.hkm] = svfCoef(fH, qH);
    this.gain = 1 / (1 + 0.06 * (Math.max(qL, qH) - 0.707));
  }
  process(inputs, outputs) {
    const o = outputs[0], L = o[0], R = o[1] || o[0], n = L.length, sr = sampleRate, dt = 1 / sr, f0 = currentFrame;
    if (this.mN === undefined) { this.mS = 0; this.mD = 0; this.mP = 0; this.mN = 0; this.oS = 0; this.oD = 0; this.oP = 0; }
    for (let i = 0; i < n; i++) {
      const f = f0 + i;
      if (f >= this.next) this.due(f);
      let rate = 1;
      if (this.tOn) { const u = (f - this.tS) / (TAPE_D * sr); rate = u >= 1 ? 0 : (1 - u) * (1 - u); }
      let r = this.rng; r ^= r << 13; r ^= r >>> 17; r ^= r << 5; this.rng = r;
      const nz = r / 2147483648;
      let v3 = nz - this.bn2, v1 = this.ba1 * this.bn1 + this.ba2 * v3, v2 = this.bn2 + this.ba2 * this.bn1 + this.ba3 * v3;
      this.bn1 = 2 * v1 - this.bn1; this.bn2 = 2 * v2 - this.bn2; const nBP = v1;
      v3 = nz - this.hn2; v1 = this.ha1 * this.hn1 + this.ha2 * v3; v2 = this.hn2 + this.ha2 * this.hn1 + this.ha3 * v3;
      this.hn1 = 2 * v1 - this.hn1; this.hn2 = 2 * v2 - this.hn2; const nHP = nz - this.hk * v1 - v2;
      let x = 0, send = 0, sL = 0, sR = 0;         // x: mono synth bus; sL/sR: stereo recordings
      for (let k = 0; k < 2; k++) if (this.kOn[k]) {
        const q = this.KP[this.kTy[k]], t = this.kT[k], fr = (q[0] + q[1] * Math.exp(-t * q[2])) * rate;
        this.kPh[k] += TAU * fr * dt; if (this.kPh[k] > TAU) this.kPh[k] -= TAU;
        let yk = Math.tanh(q[4] * Math.sin(this.kPh[k])) * this.kV[k] * Math.exp(-t * q[3]) * Math.min(1, t * 2000) * 0.8;
        if (this.kTy[k] === 5) { yk += nBP * Math.exp(-t * 350) * 0.3 * this.kV[k]; send += yk * 0.3; }   // beater click, a little room
        x += yk;
        this.kT[k] = t + dt; if (t > 0.8) this.kOn[k] = 0;
      }
      for (let k = 0; k < 2; k++) if (this.sOn[k]) {
        const t = this.sT[k], fr = (180 + 60 * Math.exp(-t * 50)) * rate;
        this.sPh[k] += TAU * fr * dt; if (this.sPh[k] > TAU) this.sPh[k] -= TAU;
        if (this.sAc[k]) {                         // drum head (two modes) plus snare wires
          this.sPh2[k] += TAU * 331 * rate * dt; if (this.sPh2[k] > TAU) this.sPh2[k] -= TAU;
          const ys = (Math.sin(this.sPh[k]) * 0.45 * Math.exp(-t * 18) + Math.sin(this.sPh2[k]) * 0.25 * Math.exp(-t * 26) + (nBP * 1.1 + nHP * 0.7) * Math.exp(-t * 12)) * this.sV[k] * 0.62;
          x += ys; send += ys * 0.5;
        } else x += (Math.sin(this.sPh[k]) * Math.exp(-t * 20) * 0.4 + nBP * 1.7 * Math.exp(-t * 16)) * this.sV[k] * 0.7;
        this.sT[k] = t + dt; if (t > 0.45) this.sOn[k] = 0;
      }
      for (let k = 0; k < 3; k++) if (this.hOn[k]) {
        const t = this.hT[k];
        if (this.hAc[k]) {                         // cymbal: inharmonic partials over noise
          let metal = 0;
          for (let m = 0; m < 6; m++) { const idx = k * 6 + m; this.hPh[idx] += TAU * 3100 * this.METAL[m] * rate * dt; if (this.hPh[idx] > TAU) this.hPh[idx] -= TAU; metal += Math.sin(this.hPh[idx]); }
          const yh = (nHP * 0.5 + metal * 0.06) * this.hV[k] * Math.exp(-t * 45);
          x += yh; send += yh * 0.4;
        } else x += nHP * this.hV[k] * Math.exp(-t * 60) * 0.5;
        this.hT[k] = t + dt; if (t > 0.15) this.hOn[k] = 0;
      }
      // clap, rim, open hat, shaker
      for (let k = 0; k < 6; k++) if (this.xOn[k]) {
        const t = this.xT[k], ty = this.xTy[k];
        let y, end;
        if (ty === 16) { const burst = t < 0.033 ? Math.exp(-(t % 0.011) * 260) : 0; y = nBP * (burst * 1.3 + (t > 0.02 ? Math.exp(-(t - 0.02) * 15) * 0.9 : 0)); end = 0.35; }
        else if (ty === 17 && this.xAc[k]) {      // cross-stick: two wood modes and a click
          this.xPh[k] += TAU * 1100 * rate * dt; if (this.xPh[k] > TAU) this.xPh[k] -= TAU;
          this.xPh2[k] += TAU * 2600 * rate * dt; if (this.xPh2[k] > TAU) this.xPh2[k] -= TAU;
          y = (Math.sin(this.xPh[k]) * 0.7 + Math.sin(this.xPh2[k]) * 0.35) * Math.exp(-t * 70) + nHP * Math.exp(-t * 400) * 0.4; end = 0.12;
        }
        else if (ty === 17) { this.xPh[k] += TAU * 1750 * rate * dt; if (this.xPh[k] > TAU) this.xPh[k] -= TAU; y = Math.sin(this.xPh[k]) * Math.exp(-t * 90) * 0.8 + nHP * Math.exp(-t * 260) * 0.5; end = 0.12; }
        else if (ty === 18 && this.xAc[k]) {
          let metal = 0;
          for (let m = 0; m < 3; m++) metal += Math.sin(TAU * 3100 * this.METAL[m * 2] * t);
          y = (nHP * 0.45 + metal * 0.05) * Math.exp(-t * 6); end = 0.7;
        }
        else if (ty === 18) { y = nHP * Math.exp(-t * 7) * 0.45; end = 0.6; }
        else { y = nHP * Math.min(1, t * 120) * Math.exp(-t * 30) * 0.5; end = 0.2; }
        x += y * this.xV[k];
        if (this.xAc[k]) send += y * this.xV[k] * 0.5;
        this.xT[k] = t + dt; if (t > end) this.xOn[k] = 0;
      }
      for (let k = 0; k < 4; k++) if (this.cOn[k]) {
        const t = this.cT[k];
        this.cPh[k] += TAU * this.cF[k] * rate * dt; if (this.cPh[k] > TAU) this.cPh[k] -= TAU;
        x += Math.sin(this.cPh[k]) * this.cV[k] * Math.exp(-t * this.cD[k]) * Math.min(1, t * 4000);
        this.cT[k] = t + dt; if (t > 0.08) this.cOn[k] = 0;
      }
      // melody: 0 pluck, 1 bell, 2 keys, 3 glass
      for (let k = 0; k < 8; k++) if (this.pOn[k]) {
        const t = this.pT[k], fr = this.pF[k] * rate;
        this.pPh[k] += TAU * fr * dt; if (this.pPh[k] > TAU) this.pPh[k] -= TAU;
        const ph = this.pPh[k];
        let y;
        switch (this.pK[k]) {
          case 0: y = Math.sin(ph + 1.2 * Math.exp(-t * 10) * Math.sin(2 * ph)) * Math.exp(-t * 5.5) * Math.min(1, t * 400) * 0.26; break;
          case 1:
            this.pM[k] += TAU * fr * 3.5 * dt; if (this.pM[k] > TAU) this.pM[k] -= TAU;
            y = Math.sin(ph + 2.2 * Math.exp(-t * 2.5) * Math.sin(this.pM[k])) * Math.exp(-t * 1.4) * Math.min(1, t * 800) * 0.2; break;
          case 2: {                                // electric piano: a 1:1 FM pair whose brightness fades, plus a short high tine
            this.pM[k] += TAU * fr * 1.0015 * dt; if (this.pM[k] > TAU) this.pM[k] -= TAU;
            let tine = 0;
            if (fr * 14 < 16000) { this.pM2[k] += TAU * fr * 14 * dt; if (this.pM2[k] > TAU) this.pM2[k] -= TAU; tine = Math.sin(this.pM2[k]) * 0.1 * Math.exp(-t * 40); }
            y = (Math.sin(ph + (0.4 + 1.1 * Math.exp(-t * 4)) * Math.sin(this.pM[k])) + tine) * Math.exp(-t * 1.6) * Math.min(1, t * 700) * 0.22; break;
          }
          case 3:
            this.pM[k] += TAU * fr * 2 * dt; if (this.pM[k] > TAU) this.pM[k] -= TAU;
            y = (Math.sin(ph) + 0.35 * Math.sin(this.pM[k] + 0.4 * Math.sin(ph))) * Math.exp(-t * 1.1) * Math.min(1, t * 25) * 0.2; break;
          case 4:                                  // marimba: a tuned bar's modes (1, 3.93, 9.2) and a mallet tick
            this.pM[k] += TAU * fr * 3.93 * dt; if (this.pM[k] > TAU) this.pM[k] -= TAU;
            this.pM2[k] += TAU * fr * 9.2 * dt; if (this.pM2[k] > TAU) this.pM2[k] -= TAU;
            y = (Math.sin(ph) * Math.exp(-t * 2.6) + 0.3 * Math.sin(this.pM[k]) * Math.exp(-t * 9) + 0.08 * Math.sin(this.pM2[k]) * Math.exp(-t * 22)) * Math.min(1, t * 1500) * 0.3
              + nBP * Math.exp(-t * 300) * 0.05; break;
          case 6: {                                // drive: two detuned saws, overdriven, then softened
            this.pM[k] += TAU * fr * 1.006 * dt; if (this.pM[k] > TAU) this.pM[k] -= TAU;
            const dv = Math.tanh(2.8 * ((ph / Math.PI - 1) + (this.pM[k] / Math.PI - 1)));
            this.pZ[k] += (dv - this.pZ[k]) * 0.3;
            y = this.pZ[k] * Math.exp(-t * 1.3) * Math.min(1, t * 900) * 0.13; break;
          }
          default: {                               // piano: slightly stretched partials, two-stage decay, hammer thump
            let s5 = 0;
            for (let m = 0; m < 5; m++) {
              const km = m + 1, idx = k * 5 + m;
              this.pH[idx] += TAU * fr * km * Math.sqrt(1 + 0.0004 * km * km) * dt; if (this.pH[idx] > TAU) this.pH[idx] -= TAU;
              s5 += Math.sin(this.pH[idx]) / Math.pow(km, 1.1) * (0.6 * Math.exp(-t * (1.6 + km * 0.9)) + 0.4 * Math.exp(-t * (0.35 + 0.25 * km)));
            }
            y = s5 * Math.min(1, t * 900) * 0.22 + nBP * Math.exp(-t * 90) * 0.04;
          }
        }
        x += y * this.pV[k];
        send += y * this.pV[k] * (this.pK[k] >= 4 ? 1 : 1.6);   // synth melody gets some room too
        this.pT[k] = t + dt; if (t > this.pEnd[this.pK[k]]) this.pOn[k] = 0;
      }
      // guitar: plucked strings; the tape stop stretches the delay line, so the pitch falls with it
      const SZ = this.SZ;
      for (let k = 0; k < 6; k++) if (this.gOn[k]) {
        const off = k * SZ, Ld = Math.min(SZ - 3, this.gL[k] / Math.max(rate, 0.05));
        let rp = this.gW[k] - Ld; if (rp < 0) rp += SZ;
        const i0 = rp | 0, i1 = i0 + 1 === SZ ? 0 : i0 + 1, yg = this.gBuf[off + i0] + (this.gBuf[off + i1] - this.gBuf[off + i0]) * (rp - i0);
        this.gBuf[off + this.gW[k]] = (yg + this.gZ[k]) * 0.5 * 0.9965; this.gZ[k] = yg;
        this.gW[k] = this.gW[k] + 1 === SZ ? 0 : this.gW[k] + 1;
        this.gLp[k] += (yg - this.gLp[k]) * 0.45;
        const og = this.gLp[k] * this.gV[k] * 0.55 * Math.min(1, rate * 4);
        x += og; send += og;
        this.gT[k] += dt; if (this.gT[k] > 3.5) this.gOn[k] = 0;
      }
      // recorded one-shots
      for (let k = 0; k < 24; k++) if (this.aOn[k]) {
        const s = this.as[this.aS[k]], p = this.aPos[k];
        if (p >= s.L.length - 3) { this.aOn[k] = 0; continue; }
        if (this.aT[k] > this.aHold[k]) this.aX[k] = 9;                       // palm-muted: the hand stops it
        if (this.aX[k] === 9) { this.aG[k] *= this.cDamp; if (this.aG[k] < 1e-4) { this.aOn[k] = 0; continue; } }
        const gk = this.aG[k] * 0.8 * Math.min(1, rate * 4), yl = this.herm(s.L, p) * gk, yr = this.herm(s.R, p) * gk;
        sL += yl; sR += yr; send += (yl + yr) * this.aSd[k];
        this.aPos[k] = p + this.aRate[k] * rate; this.aT[k] += dt;
      }
      if (this.wobR > 0) { this.wobP += TAU * this.wobR * rate * dt; if (this.wobP > TAU) this.wobP -= TAU; }
      // bass: two voices; 0 acid, 1 sub, 2 growl, or the acoustic upright (a recording; a plucked-string model until it loads)
      for (let k = 0; k < 2; k++) {
        this.bE[k] += (this.bG[k] - this.bE[k]) * (this.bG[k] ? this.cA : this.cR);
        this.bF[k] += (this.bFT[k] - this.bF[k]) * this.cG;
        if (this.bE[k] <= 1e-4) continue;
        const inc = this.bF[k] * rate * dt;
        this.bP[k] += inc; if (this.bP[k] >= 1) this.bP[k] -= 1;
        let p = this.bP[k], saw = 2 * p - 1;
        if (inc > 0) { if (p < inc) { p /= inc; saw -= p + p - p * p - 1; } else if (p > 1 - inc) { p = (p - 1) / inc; saw -= p * p + p + p + 1; } }
        this.bS[k] += inc * 0.5; if (this.bS[k] >= 1) this.bS[k] -= 1;
        const sub = Math.sin(TAU * this.bS[k]);
        this.bFE[k] *= this.cFE;
        const fe = this.bFE[k];
        let y;
        if (this.kit && this.abOn[k]) {
          const s = this.as[this.abS[k]], p = this.abPos[k];
          y = 0;
          if (p >= s.L.length - 3) this.abOn[k] = 0;
          else {
            // a recorded pluck falls away fast: a 4:1 compressor holds up the body of the note, then make-up gain
            const gb = 0.52 * this.bE[k] * this.bV[k] * Math.min(1, rate * 4);
            let yl = this.herm(s.L, p) * gb, yr = this.herm(s.R, p) * gb;
            const lv = Math.max(Math.abs(yl), Math.abs(yr));
            this.abEnv[k] += (lv - this.abEnv[k]) * (lv > this.abEnv[k] ? this.cCa : this.cCr);
            const over = this.abEnv[k] / 0.03, cg = (over > 1 ? Math.pow(over, -0.75) : 1) * this.abMk;
            yl *= cg; yr *= cg;
            sL += yl; sR += yr; send += (yl + yr) * 0.04;
            { const m = (yl + yr) * 0.5; this.mS += m * m; this.mD += Math.abs(m - this.mP); this.mP = m; }
            this.abRate[k] += (this.abRateT[k] - this.abRate[k]) * this.cSl;
            this.abPos[k] = p + this.abRate[k] * rate;
          }
        } else if (this.kit) {
          const off = k * SZ, Ld = Math.min(SZ - 3, (sr / this.bF[k] - 0.5) / Math.max(rate, 0.05));
          let rp = this.kbW[k] - Ld; if (rp < 0) rp += SZ;
          const i0 = rp | 0, i1 = i0 + 1 === SZ ? 0 : i0 + 1, yb = this.kbBuf[off + i0] + (this.kbBuf[off + i1] - this.kbBuf[off + i0]) * (rp - i0);
          this.kbBuf[off + this.kbW[k]] = (yb + this.kbZ[k]) * 0.5 * (this.bG[k] ? 0.9992 : 0.99); this.kbZ[k] = yb;
          this.kbW[k] = this.kbW[k] + 1 === SZ ? 0 : this.kbW[k] + 1;
          this.kbLp[k] += (yb - this.kbLp[k]) * 0.18;          // woody, finger-plucked
          y = this.kbLp[k] * 2.0 * Math.min(1, rate * 4);
          send += y * this.bE[k] * this.bV[k] * 0.12;
        } else if (this.bTone === 1) {
          const q = TAU * this.bP[k];
          y = Math.tanh(1.5 * (Math.sin(q) + 0.22 * Math.sin(2 * q) * (0.4 + fe))) * 0.95 + sub * 0.15;
        } else {
          let src = saw, fc = 160 + 2600 * fe * fe, q = 3.5;
          if (this.bTone === 2) {
            let p2 = this.bP[k] + 0.3; if (p2 >= 1) p2 -= 1;
            let saw2 = 2 * p2 - 1;
            if (inc > 0) { if (p2 < inc) { p2 /= inc; saw2 -= p2 + p2 - p2 * p2 - 1; } else if (p2 > 1 - inc) { p2 = (p2 - 1) / inc; saw2 -= p2 * p2 + p2 + p2 + 1; } }
            src = (saw - saw2) * 0.6; fc = 240 + 1500 * fe; q = 1.6;
          }
          if (this.wobR > 0) { const lfo = 0.5 - 0.5 * Math.cos(this.wobP); fc = 70 + 2600 * lfo * lfo; q = 5; }   // the wobble
          const [a1, a2, a3] = svfCoef(fc, q);
          const w3 = src - this.bz2[k], w1 = a1 * this.bz1[k] + a2 * w3, w2 = this.bz2[k] + a2 * this.bz1[k] + a3 * w3;
          this.bz1[k] = 2 * w1 - this.bz1[k]; this.bz2[k] = 2 * w2 - this.bz2[k];
          y = w2 * 0.8 + sub * (this.bTone === 2 ? 0.45 : 0.35);
        }
        x += y * this.bE[k] * this.bV[k] * 0.4;
        { const m = y * this.bE[k] * this.bV[k] * 0.4; this.mS += m * m; this.mD += Math.abs(m - this.mP); this.mP = m; }
      }
      // growl: the dubstep drop. Pitch glides a little between notes; shape 3 dives an octave over the note
      if (this.grOn || this.grE > 1e-4) {
        this.grT += dt; if (this.grT >= this.grDur) this.grOn = 0;
        this.grE += ((this.grOn ? 1 : 0) - this.grE) * (this.grOn ? this.cA : this.cGr);
        const sh = this.grSh, u = Math.min(1, this.grT / Math.max(this.grDur, 1e-3));
        this.grFs += (this.grF - this.grFs) * this.cGl;
        const fr = this.grFs * (sh === 3 ? Math.pow(2, -u * u) : 1) * rate, P = this.grP;
        let src = 0;
        for (let j = 0; j < 3; j++) {                               // three saws, detuned 0 / +7 / -7 cents
          const inc = fr * (j === 0 ? 1 : j === 1 ? 1.004 : 0.996) * dt;
          P[j] += inc; if (P[j] >= 1) P[j] -= 1;
          let p = P[j], sw = 2 * p - 1;
          if (p < inc) { p /= inc; sw -= p + p - p * p - 1; } else if (p > 1 - inc) { p = (p - 1) / inc; sw -= p * p + p + p + 1; }
          src += sw;
        }
        P[3] += fr * 0.5 * dt; if (P[3] >= 1) P[3] -= 1;
        src = src * 0.33 + (P[3] < 0.5 ? 0.35 : -0.35);                // plus a square an octave down
        this.grL += TAU * this.grR * rate * dt; if (this.grL > TAU) this.grL -= TAU;
        const lfo = this.grR > 0 ? 0.5 - 0.5 * Math.cos(this.grL) : 0;
        let y;
        if (sh === 1) {                                                 // yoi: vowel formants sweep "oo" to "ah"
          const d = Math.tanh(src * 2.2);
          this.gsvf(d, 320 + 480 * lfo, 7, 0); y = this.gB * 1.4;
          this.gsvf(d, 800 + 700 * lfo, 8, 2); y += this.gB;
          this.gsvf(d, 2400, 9, 4); y = (y + this.gB * 0.25 * lfo) * 1.6;
        } else {
          const fc = sh === 2 ? 180 + 2400 * Math.exp(-this.grT * 7) : sh === 3 ? 300 + 2800 * lfo : 60 + 3600 * lfo * lfo * lfo;
          y = this.gsvf(this.gsvf(src, fc, sh === 2 ? 1.4 : 3.2, 0), fc * 1.1, 0.9, 2);   // 24 dB low-pass
        }
        y = Math.tanh(y * 1.5);                                         // the grit comes after the filter
        this.grLp += (y - this.grLp) * this.cGlp; y = this.grLp;         // tame the fizz above ~6 kHz
        P[4] += this.grFs * rate * dt; if (P[4] >= 1) P[4] -= 1;         // clean sine sub at the fundamental
        const sub = Math.sin(TAU * P[4]) * (sh === 3 ? 1 - u : 1);
        x += (y * 0.24 + sub * 0.22) * this.grE;
      }
      // room: stereo Freeverb fed only by the acoustic sounds
      let rvL = 0, rvR = 0;
      {
        const inp = send * 0.015;
        for (let c = 0; c < 8; c++) {
          let b = this.fcL[c], j = this.fcIL[c], yv = b[j];
          this.fcSL[c] = yv * 0.8 + this.fcSL[c] * 0.2; b[j] = inp + this.fcSL[c] * 0.84; this.fcIL[c] = j + 1 === b.length ? 0 : j + 1; rvL += yv;
          b = this.fcR[c]; j = this.fcIR[c]; yv = b[j];
          this.fcSR[c] = yv * 0.8 + this.fcSR[c] * 0.2; b[j] = inp + this.fcSR[c] * 0.84; this.fcIR[c] = j + 1 === b.length ? 0 : j + 1; rvR += yv;
        }
        for (let a = 0; a < 4; a++) {
          let b = this.faL[a], j = this.faIL[a], bv = b[j], o = bv - rvL;
          b[j] = rvL + bv * 0.5; this.faIL[a] = j + 1 === b.length ? 0 : j + 1; rvL = o;
          b = this.faR[a]; j = this.faIR[a]; bv = b[j]; o = bv - rvR;
          b[j] = rvR + bv * 0.5; this.faIR[a] = j + 1 === b.length ? 0 : j + 1; rvR = o;
        }
      }
      this.fxs += (this.fx - this.fxs) * this.cSm; this.fys += (this.fy - this.fys) * this.cSm;
      if ((f & 15) === 0) this.coef();
      // stereo from here: master filter on each side, then the output stage
      let xl = x + sL + rvL * 1.1, xr = x + sR + rvR * 1.1;
      v3 = xl - this.l2; v1 = this.la1 * this.l1 + this.la2 * v3; v2 = this.l2 + this.la2 * this.l1 + this.la3 * v3;
      this.l1 = 2 * v1 - this.l1; this.l2 = 2 * v2 - this.l2; xl = v2;
      v3 = xr - this.lr2; v1 = this.la1 * this.lr1 + this.la2 * v3; v2 = this.lr2 + this.la2 * this.lr1 + this.la3 * v3;
      this.lr1 = 2 * v1 - this.lr1; this.lr2 = 2 * v2 - this.lr2; xr = v2;
      v3 = xl - this.h2; v1 = this.ha1m * this.h1 + this.ha2m * v3; v2 = this.h2 + this.ha2m * this.h1 + this.ha3m * v3;
      this.h1 = 2 * v1 - this.h1; this.h2 = 2 * v2 - this.h2; xl = xl - this.hkm * v1 - v2;
      v3 = xr - this.hr2; v1 = this.ha1m * this.hr1 + this.ha2m * v3; v2 = this.hr2 + this.ha2m * this.hr1 + this.ha3m * v3;
      this.hr1 = 2 * v1 - this.hr1; this.hr2 = 2 * v2 - this.hr2; xr = xr - this.hkm * v1 - v2;
      let yl, yr;
      if (this.kit) {                             // acoustic: clean; a soft limiter only touches peaks above 0.8
        yl = xl * this.gain * 0.72; yr = xr * this.gain * 0.72;
        const al = Math.abs(yl), ar = Math.abs(yr);
        if (al > 0.8) yl = (yl > 0 ? 1 : -1) * (0.8 + 0.2 * Math.tanh((al - 0.8) / 0.2));
        if (ar > 0.8) yr = (yr > 0 ? 1 : -1) * (0.8 + 0.2 * Math.tanh((ar - 0.8) / 0.2));
      } else { yl = Math.tanh(xl * 0.9 * this.gain) * 0.95; yr = Math.tanh(xr * 0.9 * this.gain) * 0.95; }   // synth: gentler warm saturation, so drum hits don't grind the held notes
      L[i] = yl; if (R !== L) R[i] = yr;
      this.oS += yl * yl; this.oD += Math.abs(yl - this.oP); this.oP = yl;   // output meter (after the filter)
    }
    // meters for the page (DRUB v3): loudness and grit of the bass voices alone, and of the final output, every 4 blocks (~10 ms); it only
    // measures, the sound is untouched
    if (++this.mN >= 4) { const c = this.mN * n; this.port.postMessage({ bm: [Math.sqrt(this.mS / c), this.mD / c], om: [Math.sqrt(this.oS / c), this.oD / c] }); this.mS = 0; this.mD = 0; this.oS = 0; this.oD = 0; this.mN = 0; }
    return true;
  }
}
registerProcessor('synth2', Synth);   // renamed: both synths share one AudioWorkletGlobalScope
