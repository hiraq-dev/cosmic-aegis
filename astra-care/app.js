/* ==========================================================================
   ASTRA CARE — Deep Space Wellbeing Prototype (demo data only)
   Core Application Engine & Telemetry Simulator
   ========================================================================== */

class AstraCareApp {
  constructor() {
    this.sol = 147;
    this.audioEnabled = true;
    this.audioCtx = null;
    this.binauralNodes = null;
    this.isBinauralPlaying = false;
    this.sosInterval = null;
    this.sosTimeLeft = 10;
    this.isBlackout = false;
    this.activeMetric = 'sleep';
    this.currentQuestionIdx = 0;
    this.laughPercentage = 85;

    // 7-Day Sleep Telemetry Data (Sol 141 to Sol 147)
    this.sleepData = [
      { sol: 141, duration: 7.2, rem: 22, deep: 18, fatigue: 18, efficiency: 91 },
      { sol: 142, duration: 6.8, rem: 20, deep: 16, fatigue: 24, efficiency: 87 },
      { sol: 143, duration: 8.1, rem: 25, deep: 21, fatigue: 12, efficiency: 95 },
      { sol: 144, duration: 7.5, rem: 23, deep: 19, fatigue: 16, efficiency: 93 },
      { sol: 145, duration: 6.4, rem: 19, deep: 14, fatigue: 28, efficiency: 84 },
      { sol: 146, duration: 7.9, rem: 24, deep: 20, fatigue: 14, efficiency: 94 },
      { sol: 147, duration: 7.8, rem: 24, deep: 20, fatigue: 13, efficiency: 93 }
    ];

    // Cosmic Questions Database
    this.questions = [
      {
        text: "If an extraterrestrial civilization intercepts our deep-space habitat, who on this crew gets sent out first to explain why we spend 30 minutes looking for floating velcro pens?",
        options: [
          "A) Commander Vance, because she'll make it sound like a tactical military drill.",
          "B) Pilot Kenji Sato, who will blame solar wind for losing his pen.",
          "C) Dr. Elena Rostova, who will analyze the alien's psychological response to velcro.",
          "D) Marcus Cole, who will immediately try to trade the alien for spare thermal duct tape."
        ],
        banter: "PLT Sato: 'I stand by my statement. In zero-g, lost pens enter a miniature Einstein-Rosen bridge behind the ECLSS duct!'"
      },
      {
        text: "The agency allows one luxury item on the return transit from Mars. What is our unanimous crew choice?",
        options: [
          "A) Real espresso machine that doesn't foam sideways in microgravity.",
          "B) A zero-gravity trampoline with tethered pillow anchors.",
          "C) Atmospheric smell synthesizer set to 'Fresh Pine Rain Forest'.",
          "D) An acoustic guitar that somehow doesn't disturb Commander Vance's sleep shift."
        ],
        banter: "CDR Vance: 'Approved, but if anyone plays Wonderwall at 0300 UTC, they get assigned to exterior radiator inspection.'"
      },
      {
        text: "You wake up floating 3 inches off your sleep bunk because the velcro strap slipped. What is your immediate reaction?",
        options: [
          "A) Gently swim through the cabin like a majestic space seal.",
          "B) Panic for 0.4 seconds thinking the artificial spin gravity failed.",
          "C) Ask Astro companion to play heroic orchestral docking music.",
          "D) Reach for floating coffee pouch before it touches the optical navigation sensors."
        ],
        banter: "Dr. Rostova: 'Reaction time test passed. Cortisol spike: zero. Pure zero-g elegance.'"
      },
      {
        text: "Space Dad Joke of the Sol: Why couldn't the astronaut book a room on the Moon?",
        options: [
          "A) Because it was full.",
          "B) Insufficient atmospheric shielding.",
          "C) Mission control declined the voucher.",
          "D) Marcus dismantled the door for spare copper."
        ],
        banter: "SE Cole: 'Hey! That copper was re-routed to the cupola defrosting grid! You're welcome!'"
      }
    ];

    // Astro Companion Speech Responses
    this.astroQuotes = {
      happy: [
        "Optimal morning Commander! Solar array efficiency is 99.4%, and your dopamine levels are looking stellar!",
        "Telemetry check complete: heart rate is steady, cabin air smells like freeze-dried optimism!",
        "Remember: Even in deep space, you are never alone. I'm right here in your habitat HUD!"
      ],
      analyze: [
        "Demo scan: scripted result, no audio is analysed.",
        "Comparing Sol 147 sleep with the demo schedule. (Simulated message.)",
        "Demo reaction estimate: 212 ms. (Simulated message, not a measurement.)"
      ],
      zen: [
        "Inhale calmness, exhale mission tension. Floating in 10-billion-year-old cosmic stardust.",
        "Take a look out the Cupola window. Earth is a fragile blue marble, and you are its guardian.",
        "Breathe with me... 4 seconds in... 7 seconds hold... 8 seconds release."
      ],
      alert: [
        "Sensors note a slight circadian drift of +18 minutes. Initiating Chrono-Phototherapy recommendation.",
        "Attention: Hydration telemetry is slightly low. Please consume 250ml electrolyte hydration pouch.",
        "Standing by with emergency calm protocols if cabin pressure or stress spikes."
      ]
    };
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  init() {
    this.initClock();
    this.initStarfield();
    this.initNavigation();
    this.initAudioSynthesizer();
    this.initAstroCompanion();
    this.initWellbeingCheckin();
    this.initQuestionsModule();
    this.initPVTTester();
    this.initSleepChart();
    this.initAINeuralVisualizer();
    this.initPreventionTools();
    this.initSOSSystem();
    this.initQueueSystem();
    this.initEarthConsole();
    this.initDeploymentChecklist();

    this.showToast("ASTRA CARE demo online &bull; all values are simulated", "success");
  }

  // =========================================================================
  // MISSION CLOCK & UTC DISPLAY
  // =========================================================================
  initClock() {
    const clockEl = document.getElementById('mission-clock');
    const update = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      if (clockEl) clockEl.textContent = `${h}:${m}:${s} UTC`;
    };
    update();
    setInterval(update, 1000);
  }

  // =========================================================================
  // STARFIELD BACKGROUND ANIMATION
  // =========================================================================
  initStarfield() {
    const canvas = document.getElementById('space-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const numStars = 160;
    const stars = Array.from({ length: numStars }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.8 + 0.4,
      alpha: Math.random() * 0.8 + 0.2,
      speed: Math.random() * 0.15 + 0.05
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep space gradient
      const grad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width);
      grad.addColorStop(0, '#060B1E');
      grad.addColorStop(0.6, '#040713');
      grad.addColorStop(1, '#020308');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Stars
      for (const s of stars) {
        s.y -= s.speed;
        if (s.y < 0) s.y = height;
        ctx.fillStyle = `rgba(215, 235, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(render);
    };
    render();
  }

  // =========================================================================
  // VIEW NAVIGATION & SWITCHING
  // =========================================================================
  initNavigation() {
    const pills = document.querySelectorAll('.nav-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        const targetView = pill.dataset.view;
        this.switchView(targetView);
      });
    });

    // Deployment Checklist banner click
    const ribbonBtn = document.getElementById('open-checklist-btn');
    if (ribbonBtn) {
      ribbonBtn.addEventListener('click', () => {
        this.switchView('checklist-view');
        this.playBeep(650, 0.08);
      });
    }
  }

  switchView(viewId) {
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
    }

    document.querySelectorAll('.nav-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.view === viewId);
    });

    this.playBeep(520, 0.05);

    // If switching to Earth view, trigger ECG redraw
    if (viewId === 'earth-view') {
      window.dispatchEvent(new Event('resize'));
    }
  }

  jumpToModule(modId) {
    this.switchView('hab-view');
    setTimeout(() => {
      const el = document.getElementById(modId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.borderColor = '#00F0FF';
        el.style.boxShadow = '0 0 30px rgba(0, 240, 255, 0.7)';
        setTimeout(() => {
          el.style.borderColor = '';
          el.style.boxShadow = '';
        }, 2200);
      }
    }, 150);
  }

  // =========================================================================
  // AUDIO SYNTHESIZER (WEB AUDIO API)
  // =========================================================================
  initAudioSynthesizer() {
    const toggleBtn = document.getElementById('sound-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.audioEnabled = !this.audioEnabled;
        toggleBtn.querySelector('.btn-text').textContent = this.audioEnabled ? 'AUDIO ON' : 'MUTED';
        toggleBtn.querySelector('.sound-icon').textContent = this.audioEnabled ? '🔊' : '🔇';
        if (this.audioEnabled) this.playBeep(880, 0.1);
      });
    }
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playBeep(freq = 440, duration = 0.08, type = 'sine') {
    if (!this.audioEnabled) return;
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  playCompanionChime() {
    if (!this.audioEnabled) return;
    try {
      const ctx = this.getAudioContext();
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.06, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.35);
      });
    } catch (e) {}
  }

  playSiren() {
    if (!this.audioEnabled) return;
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1100, ctx.currentTime + 0.3);
      osc.frequency.linearRampToValueAtTime(700, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch (e) {}
  }

  toggleBinauralSound() {
    const ctx = this.getAudioContext();
    const btn = document.getElementById('btn-toggle-binaural');

    if (this.isBinauralPlaying) {
      if (this.binauralNodes) {
        this.binauralNodes.oscLeft.stop();
        this.binauralNodes.oscRight.stop();
        this.binauralNodes = null;
      }
      this.isBinauralPlaying = false;
      if (btn) btn.textContent = 'Play Audio';
      this.showToast('Binaural soundscape deactivated.', 'info');
      return;
    }

    try {
      // 432 Hz carrier with 6 Hz theta beat difference (432Hz vs 438Hz)
      const oscLeft = ctx.createOscillator();
      const oscRight = ctx.createOscillator();
      const gain = ctx.createGain();

      oscLeft.frequency.value = 432;
      oscRight.frequency.value = 438;

      const merger = ctx.createChannelMerger(2);
      oscLeft.connect(merger, 0, 0); // left ear
      oscRight.connect(merger, 0, 1); // right ear

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      merger.connect(gain);
      gain.connect(ctx.destination);

      oscLeft.start();
      oscRight.start();

      this.binauralNodes = { oscLeft, oscRight, gain };
      this.isBinauralPlaying = true;
      if (btn) btn.textContent = 'Stop Audio ⏸';
      this.showToast('432Hz Theta wave binaural acoustic therapy active.', 'success');
    } catch (e) {
      console.error(e);
    }
  }

  // =========================================================================
  // MODULE 1: ANIMATED ASTRO COMPANION
  // =========================================================================
  initAstroCompanion() {
    const avatar = document.getElementById('astro-interactive-avatar');
    const speechText = document.getElementById('astro-speech-text');
    const speakBtn = document.getElementById('astro-speak-btn');
    const jokeBtn = document.getElementById('astro-joke-shortcut');
    const floatToggle = document.getElementById('astro-float-toggle');
    const moodBtns = document.querySelectorAll('.astro-mood-btn');
    const leftArm = document.getElementById('astro-left-arm');

    let currentMood = 'happy';

    const setMood = (mood) => {
      currentMood = mood;
      moodBtns.forEach(b => b.classList.toggle('active', b.dataset.mood === mood));
      const visor = document.getElementById('astro-visor-bg');
      const face = document.getElementById('astro-face');

      if (mood === 'happy') {
        if (visor) visor.setAttribute('fill', 'url(#visorGrad)');
        if (face) {
          face.innerHTML = `
            <path class="eye eye-left" d="M78 54 Q86 46 94 54" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
            <path class="eye eye-right" d="M106 54 Q114 46 122 54" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
            <path class="mouth" d="M94 65 Q100 71 106 65" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"/>
          `;
        }
      } else if (mood === 'analyze') {
        if (visor) visor.setAttribute('fill', '#051833');
        if (face) {
          face.innerHTML = `
            <circle cx="86" cy="52" r="5" fill="#00FF9D"/>
            <circle cx="114" cy="52" r="5" fill="#00FF9D"/>
            <line x1="84" y1="65" x2="116" y2="65" stroke="#00FF9D" stroke-width="2.5"/>
          `;
        }
      } else if (mood === 'zen') {
        if (visor) visor.setAttribute('fill', 'url(#goldVisor)');
        if (face) {
          face.innerHTML = `
            <path d="M78 54 Q86 60 94 54" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
            <path d="M106 54 Q114 60 122 54" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
            <circle cx="100" cy="65" r="2.5" fill="#FFFFFF"/>
          `;
        }
      } else if (mood === 'alert') {
        if (visor) visor.setAttribute('fill', '#3A0612');
        if (face) {
          face.innerHTML = `
            <line x1="80" y1="50" x2="92" y2="54" stroke="#FF2A55" stroke-width="3.5"/>
            <line x1="120" y1="50" x2="108" y2="54" stroke="#FF2A55" stroke-width="3.5"/>
            <ellipse cx="100" cy="65" rx="5" ry="4" fill="none" stroke="#FF2A55" stroke-width="2"/>
          `;
        }
      }
      this.playCompanionChime();
    };

    moodBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        setMood(btn.dataset.mood);
        const quotes = this.astroQuotes[btn.dataset.mood];
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        speechText.textContent = randomQuote;
      });
    });

    const triggerAstroInteraction = () => {
      if (leftArm) {
        leftArm.classList.add('waving');
        setTimeout(() => leftArm.classList.remove('waving'), 2000);
      }
      const quotes = this.astroQuotes[currentMood];
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
      speechText.textContent = randomQuote;
      this.playCompanionChime();
    };

    if (avatar) avatar.addEventListener('click', triggerAstroInteraction);
    if (speakBtn) speakBtn.addEventListener('click', triggerAstroInteraction);

    if (jokeBtn) {
      jokeBtn.addEventListener('click', () => {
        const jokes = [
          "Astro Joke: How do astronauts organize a party in the Cupola? They planet!",
          "Astro Joke: Why did the sun go to school? To get a little brighter!",
          "Astro Joke: In zero-g, you don't drop items; you just place them in low habitat orbit!"
        ];
        speechText.textContent = jokes[Math.floor(Math.random() * jokes.length)];
        this.playBeep(700, 0.15);
      });
    }

    if (floatToggle) {
      floatToggle.addEventListener('click', () => {
        avatar.classList.toggle('floating-fast');
        this.showToast('Astro Zero-G micro-thruster calibration toggled.', 'info');
        this.playBeep(450, 0.08);
      });
    }
  }

  // =========================================================================
  // MODULE 2: DAILY MENTAL WELLBEING CHECK-IN
  // =========================================================================
  initWellbeingCheckin() {
    const pad = document.getElementById('valence-pad');
    const pin = document.getElementById('coord-pin');
    const valReadout = document.getElementById('val-val');
    const aroReadout = document.getElementById('val-aro');
    const stateReadout = document.getElementById('val-state');

    // 2D Valence / Arousal Pad Interaction
    if (pad && pin) {
      const updateCoords = (e) => {
        const rect = pad.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        if (!clientX || !clientY) return;

        let x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        let y = Math.max(0, Math.min(rect.height, clientY - rect.top));

        pin.style.left = `${x}px`;
        pin.style.top = `${y}px`;

        // Normalize to -1.0 to +1.0
        const valence = ((x / rect.width) * 2 - 1).toFixed(2);
        const arousal = (((rect.height - y) / rect.height) * 2 - 1).toFixed(2);

        if (valReadout) valReadout.textContent = (valence >= 0 ? `+${valence}` : valence);
        if (aroReadout) aroReadout.textContent = (arousal >= 0 ? `+${arousal}` : arousal);

        let state = "IN THE ZONE";
        let stateClass = "text-optimal";
        if (valence >= 0 && arousal >= 0) {
          state = "ENERGIZED & FOCUSED";
          stateClass = "text-optimal";
        } else if (valence < 0 && arousal >= 0) {
          state = "CONFINED / STRESSED";
          stateClass = "text-caution";
        } else if (valence < 0 && arousal < 0) {
          state = "FATIGUED / MONOTONOUS";
          stateClass = "text-caution";
        } else {
          state = "TRANQUIL & STABLE";
          stateClass = "text-optimal";
        }

        if (stateReadout) {
          stateReadout.textContent = state;
          stateReadout.className = stateClass;
        }
      };

      pad.addEventListener('click', (e) => {
        updateCoords(e);
        this.playBeep(480, 0.05);
      });
    }

    // Sliders
    const setupSlider = (id, valId) => {
      const slider = document.getElementById(id);
      const valEl = document.getElementById(valId);
      if (slider && valEl) {
        slider.addEventListener('input', () => {
          valEl.textContent = `${slider.value}%`;
        });
      }
    };
    setupSlider('resilience-slider', 'resilience-val');
    setupSlider('workload-slider', 'workload-val');
    setupSlider('cohesion-slider', 'cohesion-val');

    // Sample Log & Voice Record Simulation
    const journal = document.getElementById('journal-input');
    const quickFillBtn = document.getElementById('quick-fill-btn');
    const voiceRecordBtn = document.getElementById('voice-record-btn');
    const sentimentTag = document.getElementById('sentiment-tag');

    if (quickFillBtn && journal) {
      quickFillBtn.addEventListener('click', () => {
        journal.value = "Sol 147: Completed EVA suit pressure checks. Sleep was restorative, and crew banter during breakfast was high spirits. Feeling confident for docking maneuvers.";
        if (sentimentTag) {
          sentimentTag.textContent = "STABLE • HIGH CONFIDENCE (+0.84)";
          sentimentTag.className = "sentiment-badge positive";
        }
        this.playBeep(600, 0.06);
      });
    }

    if (voiceRecordBtn) {
      voiceRecordBtn.addEventListener('click', () => {
        voiceRecordBtn.innerHTML = "🔴 Analyzing Vocal Tremors...";
        this.playBeep(880, 0.15);
        setTimeout(() => {
          voiceRecordBtn.innerHTML = "🎤 Record Voice";
          if (sentimentTag) {
            sentimentTag.textContent = "VOCAL JITTER 1.2% • ZERO FATIGUE DETECTED";
            sentimentTag.className = "sentiment-badge positive";
          }
          this.showToast("Simulated voice analysis (no audio is recorded or analysed).", "success");
        }, 1400);
      });
    }

    // Commit Sol Check-In
    const submitBtn = document.getElementById('submit-checkin-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        this.playCompanionChime();
        this.showToast("Sol 147 Psychological Telemetry Committed & Queued for DSN Sync!", "success");

        // Add telemetry packet to queue
        this.addPacketToQueue(`PKT_SOL147_PSYCH_${Date.now().toString().slice(-4)}`, "1.3 MB", "P0 (CRITICAL)");
      });
    }
  }

  // =========================================================================
  // MODULE 3: FUNNY INTERACTIVE QUESTIONS & MORALE BOOSTER
  // =========================================================================
  initQuestionsModule() {
    const qText = document.getElementById('cur-question-text');
    const optionsContainer = document.getElementById('question-options');
    const banterFeed = document.getElementById('banter-feed');
    const nextBtn = document.getElementById('next-question-btn');
    const banterBtn = document.getElementById('crew-banter-btn');
    const boostBtn = document.getElementById('laugh-boost-btn');
    const laughScore = document.getElementById('laugh-score');
    const laughFill = document.getElementById('laugh-fill');

    const renderQuestion = (idx) => {
      const q = this.questions[idx];
      if (qText) qText.textContent = `"${q.text}"`;
      if (optionsContainer) {
        optionsContainer.innerHTML = '';
        q.options.forEach((optText, oIdx) => {
          const btn = document.createElement('button');
          btn.className = 'quiz-opt';
          btn.textContent = optText;
          btn.addEventListener('click', () => {
            optionsContainer.querySelectorAll('.quiz-opt').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            this.playBeep(580, 0.08);
            this.boostLaugh(5);
            if (banterFeed) {
              banterFeed.innerHTML = `<div class="banter-bubble">${q.banter}</div>`;
            }
          });
          optionsContainer.appendChild(btn);
        });
      }
    };

    renderQuestion(this.currentQuestionIdx);

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.currentQuestionIdx = (this.currentQuestionIdx + 1) % this.questions.length;
        renderQuestion(this.currentQuestionIdx);
        this.playBeep(520, 0.05);
      });
    }

    if (banterBtn) {
      banterBtn.addEventListener('click', () => {
        const extraBanter = [
          "CDR Vance: 'Whoever keeps reprogramming Astro to whisper space dad jokes at 0200 UTC will be on solar panel scrubbing duty.'",
          "SE Cole: 'If we duct tape enough velcro pads together, can we sleep on the ceiling? Asking for science.'",
          "MS Dr. Rostova: 'Scientific consensus confirms SE Cole should never be left alone with velcro.'"
        ];
        const pick = extraBanter[Math.floor(Math.random() * extraBanter.length)];
        if (banterFeed) {
          banterFeed.innerHTML = `<div class="banter-bubble"><strong>Crew Channel:</strong> ${pick}</div>`;
        }
        this.boostLaugh(10);
        this.playBeep(620, 0.08);
      });
    }

    if (boostBtn) {
      boostBtn.addEventListener('click', () => {
        this.boostLaugh(15);
        this.playBeep(780, 0.12);
        this.showToast("Dopamine calibration logged: +15% Morale Surge!", "success");
      });
    }
  }

  boostLaugh(amount) {
    this.laughPercentage = Math.min(100, this.laughPercentage + amount);
    const score = document.getElementById('laugh-score');
    const fill = document.getElementById('laugh-fill');
    if (score) score.textContent = `${this.laughPercentage}% BOOSTED`;
    if (fill) fill.style.width = `${this.laughPercentage}%`;
  }

  // =========================================================================
  // MODULE 4: SLEEP AND FATIGUE DASHBOARD & PVT TESTER
  // =========================================================================
  initPVTTester() {
    const screen = document.getElementById('pvt-screen');
    const badge = document.getElementById('pvt-badge');
    const msReadout = document.getElementById('pvt-ms');
    const gradeReadout = document.getElementById('pvt-grade');

    let state = 'idle'; // idle | waiting | ready | done
    let startTime = 0;
    let timeoutId = null;

    if (!screen) return;

    screen.addEventListener('click', () => {
      if (state === 'idle' || state === 'done') {
        // Start test
        state = 'waiting';
        screen.className = 'pvt-screen-ready';
        screen.innerHTML = 'WAIT FOR GREEN SCREEN...';
        if (badge) badge.textContent = 'STANDBY';
        this.playBeep(400, 0.08);

        const delay = Math.floor(Math.random() * 2500) + 1500;
        timeoutId = setTimeout(() => {
          if (state !== 'waiting') return;
          state = 'ready';
          startTime = performance.now();
          screen.className = 'pvt-screen-go';
          screen.innerHTML = '⚡ CLICK NOW!';
          if (badge) badge.textContent = 'TAP!';
          this.playBeep(880, 0.1);
        }, delay);

      } else if (state === 'waiting') {
        // False start
        clearTimeout(timeoutId);
        state = 'idle';
        screen.className = 'pvt-screen-waiting';
        screen.innerHTML = 'FALSE START! Click to retry.';
        if (badge) badge.textContent = 'ERR';
        this.playBeep(240, 0.2, 'sawtooth');

      } else if (state === 'ready') {
        // Success
        const elapsed = Math.round(performance.now() - startTime);
        state = 'done';
        screen.className = 'pvt-screen-done';
        screen.innerHTML = `REACTION: ${elapsed} ms &bull; Click to re-test`;
        if (badge) badge.textContent = 'PASSED';
        if (msReadout) msReadout.textContent = `${elapsed} ms`;

        let grade = "Demo: within range";
        let colorClass = "text-optimal";
        if (elapsed > 280) {
          grade = "Slower than demo baseline";
          colorClass = "text-caution";
        }
        if (gradeReadout) {
          gradeReadout.textContent = grade;
          gradeReadout.className = colorClass;
        }

        this.playBeep(650, 0.1);
        this.showToast(`PVT Test Completed: ${elapsed}ms (${grade})`, "success");
      }
    });
  }

  // =========================================================================
  // MODULE 5: 7-DAY SLEEP TREND CHART (HTML5 CANVAS)
  // =========================================================================
  initSleepChart() {
    const canvas = document.getElementById('sleepTrendCanvas');
    const tooltip = document.getElementById('chart-tooltip');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const buttons = document.querySelectorAll('.chart-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeMetric = btn.dataset.metric;
        this.renderChart(canvas, ctx, tooltip);
        this.playBeep(520, 0.05);
      });
    });

    // Resize handling
    const resizeChart = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      this.renderChart(canvas, ctx, tooltip);
    };
    window.addEventListener('resize', resizeChart);
    setTimeout(resizeChart, 100);

    // Hover tooltip
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const step = canvas.width / (this.sleepData.length + 1);

      let found = null;
      this.sleepData.forEach((d, i) => {
        const x = step * (i + 1);
        if (Math.abs(mouseX - x) < step * 0.45) {
          found = { d, x };
        }
      });

      if (found && tooltip) {
        tooltip.style.display = 'block';
        tooltip.style.left = `${found.x - 40}px`;
        tooltip.style.top = `35px`;
        tooltip.innerHTML = `
          <strong>SOL ${found.d.sol}</strong><br>
          Sleep: ${found.d.duration} hrs<br>
          REM: ${found.d.rem}% | Deep: ${found.d.deep}%<br>
          Efficiency: ${found.d.efficiency}%
        `;
      } else if (tooltip) {
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.style.display = 'none';
    });
  }

  renderChart(canvas, ctx, tooltip) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const padLeft = 45;
    const padRight = 20;
    const padTop = 30;
    const padBottom = 35;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "Space Mono", monospace';
      ctx.textAlign = 'right';
      const val = (10 - i * 2.5).toFixed(1);
      ctx.fillText(`${val}h`, padLeft - 8, y + 3);
    }

    // Critical Fatigue Threshold (6.0 hrs) - Red line
    const yFatigue = padTop + chartH * (1 - 6.0 / 10.0);
    ctx.strokeStyle = '#FF2A55';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, yFatigue);
    ctx.lineTo(w - padRight, yFatigue);
    ctx.stroke();
    ctx.setLineDash([]);

    // Optimal Target (8.0 hrs) - Green line
    const yTarget = padTop + chartH * (1 - 8.0 / 10.0);
    ctx.strokeStyle = 'rgba(0, 255, 157, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, yTarget);
    ctx.lineTo(w - padRight, yTarget);
    ctx.stroke();
    ctx.setLineDash([]);

    // Points calculation
    const step = chartW / (this.sleepData.length - 1);
    const points = this.sleepData.map((d, i) => {
      const x = padLeft + step * i;
      let val = d.duration;
      if (this.activeMetric === 'rem') val = (d.rem / 100) * 10;
      if (this.activeMetric === 'fatigue') val = (d.fatigue / 30) * 10;

      const y = padTop + chartH * (1 - Math.min(10, Math.max(0, val)) / 10.0);
      return { x, y, sol: d.sol, val: d.duration };
    });

    // Filled area under curve
    const areaGrad = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
    areaGrad.addColorStop(0, 'rgba(0, 240, 255, 0.35)');
    areaGrad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, h - padBottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, h - padBottom);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Line curve
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Data points & X Labels
    points.forEach(p => {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Sol X-axis label
      ctx.fillStyle = '#90A2C0';
      ctx.font = '10px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Sol ${p.sol}`, p.x, h - padBottom + 16);
    });
  }

  // =========================================================================
  // MODULE 6: AI PATTERN DETECTION (NEURAL VISUALIZER)
  // =========================================================================
  initAINeuralVisualizer() {
    const canvas = document.getElementById('neuralCanvas');
    const scanBtn = document.getElementById('run-ai-scan-btn');
    const scanStatus = document.getElementById('scan-status-text');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const nodes = [
      { x: 40, y: 35, r: 4 },
      { x: 120, y: 35, r: 4 },
      { x: 80, y: 75, r: 6 },
      { x: 35, y: 115, r: 4 },
      { x: 125, y: 115, r: 4 }
    ];

    let pulseTime = 0;
    const renderNeural = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pulseTime += 0.03;

      // Draw connections
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      // Draw nodes
      nodes.forEach((n, idx) => {
        const glow = Math.sin(pulseTime + idx) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(0, 255, 157, ${glow})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#00F0FF';
        ctx.stroke();
      });

      requestAnimationFrame(renderNeural);
    };
    renderNeural();

    if (scanBtn) {
      scanBtn.addEventListener('click', () => {
        scanBtn.disabled = true;
        scanBtn.innerHTML = "⚙️ Executing Bio-Neural Diagnostic...";
        this.playBeep(750, 0.2);

        setTimeout(() => {
          scanBtn.disabled = false;
          scanBtn.innerHTML = "⚙️ Trigger Deep Autonomous Bio-Scan";
          if (scanStatus) {
            scanStatus.textContent = `Autonomous scan completed at ${new Date().toLocaleTimeString()} • Zero anomalies`;
          }
          this.playCompanionChime();
          this.showToast("Simulated scan result: nominal (scripted).", "success");
        }, 1600);
      });
    }
  }

  // =========================================================================
  // MODULE 7: PREVENTION RECOMMENDATIONS (LIGHT, SOUND, BREATHING)
  // =========================================================================
  initPreventionTools() {
    // 1. Light Therapy
    const lightBtn = document.getElementById('btn-start-light');
    const lightModal = document.getElementById('light-modal');
    const closeLightBtn = document.getElementById('close-light-btn');

    if (lightBtn && lightModal) {
      lightBtn.addEventListener('click', () => {
        lightModal.classList.remove('hidden');
        this.playBeep(650, 0.1);
      });
    }
    if (closeLightBtn && lightModal) {
      closeLightBtn.addEventListener('click', () => {
        lightModal.classList.add('hidden');
      });
    }

    // 2. Binaural Beats
    const binauralBtn = document.getElementById('btn-toggle-binaural');
    if (binauralBtn) {
      binauralBtn.addEventListener('click', () => this.toggleBinauralSound());
    }

    // 3. 4-7-8 Breathing Pacer
    const breathBtn = document.getElementById('btn-open-breath');
    const breathModal = document.getElementById('breath-modal');
    const closeBreathBtn = document.getElementById('close-breath-btn');
    const breathCircle = document.getElementById('breath-circle');
    const breathInstruction = document.getElementById('breath-instruction');
    const breathTimerSec = document.getElementById('breath-phase-seconds');

    let breathInterval = null;

    const startBreathingCycle = () => {
      let phase = 'inhale'; // inhale(4s) -> hold(7s) -> exhale(8s)
      let sec = 4;

      const runPhase = () => {
        if (!breathCircle || !breathInstruction || !breathTimerSec) return;

        if (phase === 'inhale') {
          breathInstruction.textContent = "INHALE";
          breathTimerSec.textContent = `${sec}s`;
          breathCircle.className = "breath-circle inhale";
          sec--;
          if (sec < 0) {
            phase = 'hold';
            sec = 7;
            this.playBeep(440, 0.05);
          }
        } else if (phase === 'hold') {
          breathInstruction.textContent = "HOLD";
          breathTimerSec.textContent = `${sec}s`;
          breathCircle.className = "breath-circle hold";
          sec--;
          if (sec < 0) {
            phase = 'exhale';
            sec = 8;
            this.playBeep(520, 0.05);
          }
        } else if (phase === 'exhale') {
          breathInstruction.textContent = "EXHALE";
          breathTimerSec.textContent = `${sec}s`;
          breathCircle.className = "breath-circle exhale";
          sec--;
          if (sec < 0) {
            phase = 'inhale';
            sec = 4;
            this.playBeep(330, 0.05);
          }
        }
      };

      runPhase();
      breathInterval = setInterval(runPhase, 1000);
    };

    if (breathBtn && breathModal) {
      breathBtn.addEventListener('click', () => {
        breathModal.classList.remove('hidden');
        startBreathingCycle();
      });
    }

    if (closeBreathBtn && breathModal) {
      closeBreathBtn.addEventListener('click', () => {
        breathModal.classList.add('hidden');
        if (breathInterval) clearInterval(breathInterval);
      });
    }

    // 4. Cupola Log
    const cupolaBtn = document.getElementById('btn-log-cupola');
    if (cupolaBtn) {
      cupolaBtn.addEventListener('click', () => {
        this.playCompanionChime();
        this.showToast("Cupola Earth-Gaze Session logged: +12% Psychological Resilience boost.", "success");
      });
    }
  }

  // =========================================================================
  // MODULE 8: EMERGENCY SOS SCREEN
  // =========================================================================
  initSOSSystem() {
    const triggerTop = document.getElementById('emergency-sos-trigger');
    const triggerCard = document.getElementById('trigger-sos-btn');
    const modal = document.getElementById('sos-modal');
    const cancelBtn = document.getElementById('cancel-sos-btn');
    const confirmBtn = document.getElementById('confirm-sos-btn');
    const timerEl = document.getElementById('sos-timer');
    const ringEl = document.getElementById('sos-ring-progress');

    const openSOS = () => {
      if (!modal) return;
      modal.classList.remove('hidden');
      this.sosTimeLeft = 10;
      this.playSiren();

      if (this.sosInterval) clearInterval(this.sosInterval);
      this.sosInterval = setInterval(() => {
        this.sosTimeLeft--;
        if (timerEl) timerEl.textContent = this.sosTimeLeft;

        // Progress ring offset (314 is circumference)
        if (ringEl) {
          const offset = 314 * (1 - this.sosTimeLeft / 10);
          ringEl.style.strokeDashoffset = offset;
        }

        if (this.sosTimeLeft % 2 === 0) {
          this.playSiren();
        }

        if (this.sosTimeLeft <= 0) {
          clearInterval(this.sosInterval);
          this.confirmSOS();
        }
      }, 1000);
    };

    if (triggerTop) triggerTop.addEventListener('click', openSOS);
    if (triggerCard) triggerCard.addEventListener('click', openSOS);

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (this.sosInterval) clearInterval(this.sosInterval);
        modal.classList.add('hidden');
        this.showToast("SOS demo cancelled.", "info");
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (this.sosInterval) clearInterval(this.sosInterval);
        this.confirmSOS();
      });
    }
  }

  triggerEmergencySOS() {
    const triggerCard = document.getElementById('trigger-sos-btn');
    if (triggerCard) triggerCard.click();
  }

  confirmSOS() {
    const modal = document.getElementById('sos-modal');
    if (modal) modal.classList.add('hidden');
    this.showToast("CRITICAL ALERT: SIMULATION: no real alert was sent. A ground team would be contacted here.", "alert");
    this.addPacketToQueue("PKT_EMERGENCY_SOS_OVERRIDE", "0.4 MB", "P0_EMERGENCY");
  }

  // =========================================================================
  // MODULE 9: OFFLINE DEMO DATA AND TRANSMISSION QUEUE
  // =========================================================================
  initQueueSystem() {
    const blackoutBtn = document.getElementById('simulate-blackout-btn');
    const flushBtn = document.getElementById('flush-queue-btn');
    const inspectBtn = document.getElementById('inspect-packets-btn');
    const hexModal = document.getElementById('hex-modal');
    const closeHexBtn = document.getElementById('close-hex-btn');
    const copyHexBtn = document.getElementById('copy-hex-btn');
    const hexViewer = document.getElementById('hex-viewer-content');

    if (blackoutBtn) {
      blackoutBtn.addEventListener('click', () => {
        this.isBlackout = !this.isBlackout;
        blackoutBtn.classList.toggle('blackout-active', this.isBlackout);
        blackoutBtn.textContent = this.isBlackout ? '⚠️ Blackout Active' : '📡 Toggle Blackout';
        this.showToast(this.isBlackout ? 'Planetary occultation active: Offline queue buffering telemetry.' : 'Comms re-established with Deep Space Network.', this.isBlackout ? 'alert' : 'success');
        this.playBeep(this.isBlackout ? 300 : 700, 0.1);
      });
    }

    if (flushBtn) {
      flushBtn.addEventListener('click', () => {
        if (this.isBlackout) {
          this.showToast('Transmission failed: DSN line-of-sight occulted. Stored in offline flash.', 'alert');
          return;
        }

        flushBtn.innerHTML = '⬆️ Simulating uplink...';
        this.playBeep(800, 0.15);

        setTimeout(() => {
          flushBtn.innerHTML = '⬆️ Flush & Transmit to Deep Space Network';
          const items = document.querySelectorAll('.packet-status');
          items.forEach(el => {
            el.className = 'packet-status synced';
            el.textContent = 'SYNCED (ACK RECV)';
          });
          this.showToast('Simulated transmission complete (no data left this page).', 'success');
          this.playCompanionChime();
        }, 1200);
      });
    }

    if (inspectBtn && hexModal && hexViewer) {
      inspectBtn.addEventListener('click', () => {
        hexModal.classList.remove('hidden');
        hexViewer.textContent = this.generateSampleHex();
      });
    }

    if (closeHexBtn && hexModal) {
      closeHexBtn.addEventListener('click', () => hexModal.classList.add('hidden'));
    }

    if (copyHexBtn) {
      copyHexBtn.addEventListener('click', () => {
        this.showToast('Binary CCSDS packet stream copied to clipboard.', 'success');
      });
    }
  }

  addPacketToQueue(name, size, priority) {
    const container = document.getElementById('packet-container');
    const countEl = document.getElementById('queue-count');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'packet-item';
    div.innerHTML = `
      <div class="packet-icon">📦</div>
      <div class="packet-details">
        <span class="packet-name">${name}</span>
        <span class="packet-meta">Size: ${size} &bull; Enc: SHA-256 &bull; Prior: ${priority}</span>
      </div>
      <span class="packet-status queued">QUEUED</span>
    `;
    container.prepend(div);

    const total = container.querySelectorAll('.packet-item').length;
    if (countEl) countEl.textContent = `${total} PACKETS`;
  }

  generateSampleHex() {
    return `00000000: 0B 3D 91 00 24 00 00 93  4E 41 53 41 2D 53 54 44  .=..$...DEMO-STD
00000010: 33 30 30 31 00 01 00 93  53 4F 4C 2D 31 34 37 00  3001....SOL-147.
00000020: 50 4C 54 20 53 41 54 4F  00 00 48 52 3D 30 37 34  PLT SATO..HR=074
00000030: 53 50 4F 32 3D 39 38 2E  35 25 20 50 56 54 3D 32  SPO2=98.5% PVT=2
00000040: 31 34 6D 73 20 53 54 41  54 55 53 3D 4E 4F 4D 49  14ms STATUS=NOMI
00000050: 4E 41 4C 00 43 43 53 44  53 2D 50 41 43 4B 45 54  NAL.CCSDS-PACKET
00000060: 7F 2E 1A 9C 00 FF 9D 00  00 F0 FF 00 FC 3D 21 FF  .............=!.`;
  }

  // =========================================================================
  // MODULE 10: EARTH MEDICAL MONITORING DASHBOARD (JSC HOUSTON)
  // =========================================================================
  initEarthConsole() {
    const canvas = document.getElementById('ecgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let t = 0;
    const ecgPoints = [];
    const maxPoints = 220;

    const renderECG = () => {
      ctx.fillStyle = '#02050E';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Generate ECG heartbeat pulse (P-Q-R-S-T)
      t += 0.08;
      const beatCycle = t % (Math.PI * 2);
      let sampleY = canvas.height / 2;

      // P wave
      if (beatCycle > 1.2 && beatCycle < 1.6) {
        sampleY -= Math.sin((beatCycle - 1.2) * (Math.PI / 0.4)) * 8;
      }
      // QRS complex
      else if (beatCycle >= 1.8 && beatCycle < 2.2) {
        const qrs = (beatCycle - 1.8) / 0.4;
        if (qrs < 0.25) sampleY += 6; // Q dip
        else if (qrs < 0.6) sampleY -= 55; // R peak
        else sampleY += 16; // S dip
      }
      // T wave
      else if (beatCycle > 2.6 && beatCycle < 3.2) {
        sampleY -= Math.sin((beatCycle - 2.6) * (Math.PI / 0.6)) * 14;
      }

      ecgPoints.push(sampleY);
      if (ecgPoints.length > maxPoints) ecgPoints.shift();

      // Render ECG stream
      ctx.strokeStyle = '#00FF9D';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#00FF9D';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      const step = canvas.width / maxPoints;
      ecgPoints.forEach((val, i) => {
        const x = i * step;
        if (i === 0) ctx.moveTo(x, val);
        else ctx.lineTo(x, val);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      requestAnimationFrame(renderECG);
    };
    renderECG();

    const exportBtn = document.getElementById('export-report-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }

  sendEarthMessage(crewName) {
    const msg = prompt(`Simulated ground message to ${crewName}:\nEnter message to transmit via DSN:`, "Sample message: demo metrics look fine.");
    if (msg) {
      this.playCompanionChime();
      this.showToast(`Simulated message to ${crewName} (nothing was sent).`, "success");
    }
  }

  inspectCrew(crewName) {
    this.showToast(`Loading high-resolution biometric telemetry for ${crewName}...`, "info");
  }

  overrideSchedule(type) {
    this.playBeep(640, 0.1);
    this.showToast(`Simulated ground action: ${type.toUpperCase()} (nothing was sent).`, "success");
  }

  // =========================================================================
  // DEPLOYMENT CHECKLIST SYSTEM
  // =========================================================================
  initDeploymentChecklist() {
    // Jump-to buttons in checklist table
    document.querySelectorAll('.jump-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
  }

  // =========================================================================
  // TOAST NOTIFICATION SYSTEM
  // =========================================================================
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'alert') icon = '🚨';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Instantiate and initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AstraCareApp();
  window.app.init();
});
