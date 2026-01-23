import { OrkaCloud } from '../../core/scripts/orka-cloud.js';
import { OrkaGameManager } from '../../core/scripts/orka-game-manager.js'; // NOVO IMPORT
import { OrkaFX, OrkaMath, OrkaStorage, OrkaAudio, OrkaCalendar, Utils, OrkaTutorial } from '../../core/scripts/orka-lib.js';

// =========================
// CONFIGURAÇÕES
// =========================
const GAME_ID = 'eagle_aim';
const MIN_DATE = '2026-01-01'; 
const PENALTY_MS = 1000; 
const PERFECT_BONUS_MS = 500;
const TOTAL_WAVES = 3;

// Configuração de Pontos (1º ao 10º)
const RANK_POINTS = { 0: 10, 1: 7, 2: 5, 3: 4, 4: 3, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 };

// --- INSTÂNCIA DO GERENTE (O Novo Cérebro) ---
const Game = new OrkaGameManager({
    gameId: GAME_ID,
    enforceLogin: true,       // Garante nick
    heartbeatInterval: 30000  // Salva sessão a cada 30s
});

let state = {
    currentDate: new Date(),
    seed: 0,
    isPlaying: false,
    waveIndex: 0,
    targetsLeft: 0,
    startTime: 0,
    penaltyTime: 0,
    bonusTime: 0,
    timerInterval: null,
    levelData: null,
    finalTime: 0,
    bestTime: null,
    lastRunTime: null,
    profile: null // Guarda perfil localmente
};

const screens = {
    menu: document.getElementById('screen-menu'),
    countdown: document.getElementById('screen-countdown'),
    game: document.getElementById('screen-game')
};

const els = {
    timer: document.getElementById('timer-hud'),
    wave: document.getElementById('wave-hud'),
    targets: document.getElementById('targets-container'),
    missLayer: document.getElementById('miss-click-layer'),
    splatLayer: document.getElementById('splat-layer'),
    countText: document.getElementById('countdown-text'),
    dateDisplay: document.getElementById('date-display'),
    
    // Menu Elements
    podiumContainer: document.getElementById('podium-container'),
    dashAvatar: document.getElementById('dash-avatar'),
    dashNick: document.getElementById('dash-nick'),
    dashGlobalPts: document.getElementById('dash-global-pts'),
    dashBestToday: document.getElementById('dash-best-today'),
    dashLastRun: document.getElementById('dash-last-run'),
    inlineRankingList: document.getElementById('inline-ranking-list'),
    
    btnPlay: document.getElementById('btn-play'),
    btnShare: document.getElementById('btn-share'),
    
    // Botões Flutuantes (Restore)
    btnBackHub: document.getElementById('btn-back-hub'),
    btnFloatCalendar: document.getElementById('btn-float-calendar'),

    // Modais e Outros
    modalNick: document.getElementById('modal-nick'),
    nickInput: document.getElementById('nick-input'),
    saveNickBtn: document.getElementById('save-nick-btn')
};

// =========================
// 1. INICIALIZAÇÃO (REFATORADA)
// =========================
async function init() {
    // 1. Inicializa via Game Manager (Resolve Auth, Nickname, Proteção e Sessão)
    const { profile } = await Game.init();
    state.profile = profile;

    state.currentDate.setHours(0,0,0,0);
    updateDateDisplay();
    
    // 🔊 CARREGAMENTO DOS SONS
    OrkaAudio.loadAll({
        'shoot': '../../assets/sounds/shoot.mp3',
        'miss': '../../assets/sounds/glass-shrink.mp3',
        'aim': '../../assets/sounds/eagle.mp3',
        'wave': '../../assets/sounds/recharge.mp3',
        'endgame': '../../assets/sounds/last-impact.mp3',
        'record': '../../assets/sounds/crowd-applause.mp3',
        'precise': '../../assets/sounds/shine.mp3',
        'tick': '../../assets/sounds/beep.mp3',
        'hit_armor': '../../assets/sounds/hit-armor.mp3'
    });

    OrkaTutorial.checkAndShow(GAME_ID, {
        title: 'BEM-VINDO AO EAGLE AIM 🦅',
        btnText: 'ENTENDI, BORA!',
        steps: [
            '🎯 <b>PRECISÃO É TUDO:</b> Toque nos alvos o mais rápido possível. Cuidado: toques fora (miss click) adicionam <b>+1s</b> de penalidade!',
            '🦅 <b>PERFECT SHOT:</b> Acertar exatamente no centro do alvo garante um bônus de <b>-0.5s</b> no seu tempo final.',
            '📅 <b>DESAFIO DIÁRIO:</b> Todo dia à meia-noite, uma nova fase é gerada usando a data como "semente". Todos os jogadores enfrentam exatamente a mesma sequência de alvos.',
            '🏆 <b>PONTUAÇÃO & RANKING:</b> Seu objetivo é ter o menor tempo. Ficar no <b>Top 10 Diário</b> te dá pontos para subir no Ranking da Temporada (visualizado no menu).'
        ]
    });

    loadDailyRecord(); // Carrega do LocalStorage primeiro (instantâneo)

    els.btnPlay.addEventListener('click', () => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
        startCountdown();
    });
        
    els.missLayer.addEventListener('mousedown', (e) => handleMissClick(e));
    els.missLayer.addEventListener('touchstart', (e) => { e.preventDefault(); handleMissClick(e.touches[0]); });
    
    els.btnShare.addEventListener('click', shareResult);
    
    document.getElementById('game-stage').addEventListener('mousedown', () => {
        if(state.isPlaying) OrkaAudio.play('shoot', 0.3);
    });

    els.saveNickBtn.addEventListener('click', saveNicknameAndSubmit);

    // Navegação Extra (Floating Buttons)
    if(els.btnBackHub) els.btnBackHub.addEventListener('click', () => window.location.href = '../../index.html');
    if(els.btnFloatCalendar) els.btnFloatCalendar.addEventListener('click', () => {
        document.getElementById('calendar-btn').click(); // Apenas clica no botão principal
    });

   // --- CALENDÁRIO ---
    OrkaCalendar.bind({
        triggerBtn: 'calendar-btn',
        modalId: 'modal-calendar',
        gridId: 'calendar-grid',
        titleId: 'calendar-month-year',
        prevBtn: 'prev-month',
        nextBtn: 'next-month'
    }, {
        minDate: MIN_DATE,
        getCurrentDate: () => state.currentDate,
        getDayClass: (isoDate) => {
            const hasRecord = OrkaStorage.load(`eagleAim_record_${isoDate}`);
            return hasRecord ? 'win' : ''; 
        },
        onSelect: (d) => {
            state.currentDate = d;
            updateDateDisplay();
            loadDailyRecord();
            loadLeaderboardInline();
            Utils.toggleModal('modal-calendar', false);
        }
    });

    refreshDashboardUI(); 
    loadSeasonRankings(); 
    loadLeaderboardInline(); 
}

// =========================
// 2. LÓGICA DE DADOS & DASHBOARD
// =========================

function getStorageKey() {
    const iso = state.currentDate.toISOString().split('T')[0];
    return `eagleAim_record_${iso}`;
}

function loadDailyRecord() {
    // Tenta carregar local (mais rápido)
    const record = OrkaStorage.load(getStorageKey());
    if (record) {
        state.bestTime = parseFloat(record);
    } else {
        state.bestTime = null;
    }
    refreshDashboardUI();
}

// ATENÇÃO: Esta função agora salva localmente E prepara o terreno pro Cloud
function saveDailyRecord(newTime) {
    const timeFloat = parseFloat(newTime);
    state.lastRunTime = timeFloat;
    
    // Se for recorde do dia
    if (!state.bestTime || timeFloat < state.bestTime) {
        state.bestTime = timeFloat;
        OrkaStorage.save(getStorageKey(), timeFloat);
        OrkaFX.confetti(); 
        OrkaAudio.play('record');
    }
}

function refreshDashboardUI() {
    const user = OrkaCloud.getProfile(); // Pega do estado V5
    els.dashNick.textContent = user?.nickname || 'Visitante';
    // O novo Cloud não expõe getAvatarUrl() diretamente como helper, mas podemos reconstruir ou pegar do profile
    // Ajuste V5: o avatar vem no profile.image
    const avatarSlug = user?.image || 'default';
    els.dashAvatar.src = `../../assets/avatars/${avatarSlug}.png`;
    
    if (state.bestTime) {
        els.dashBestToday.textContent = state.bestTime.toFixed(3) + 's';
        els.dashBestToday.style.color = '#facc15';
    } else {
        els.dashBestToday.textContent = '--.--';
        els.dashBestToday.style.color = '#666';
    }

    if (state.lastRunTime) {
        els.dashLastRun.textContent = state.lastRunTime.toFixed(3) + 's';
    } else {
        els.dashLastRun.textContent = '--.--';
    }
}

// =========================
// 3. PONTUAÇÃO GLOBAL & PÓDIO
// =========================

async function loadSeasonRankings() {
    els.podiumContainer.innerHTML = '<div class="loading-spinner small"></div>';
    
    try {
        const globalScores = {};
        const daysToCheck = 7; 
        const today = new Date();
        const promises = [];

        // V5: loadSave e getLeaderboard continuam funcionando via OrkaCloud
        // A lógica de "Temporada" ainda é client-side por enquanto (como planejado no roadmap futuro)
        for (let i = 0; i < daysToCheck; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            if (d >= new Date(MIN_DATE)) {
                // Ajuste V5: Passa data como objeto Date direto
                promises.push(OrkaCloud.getLeaderboard(GAME_ID, d));
            }
        }

        const results = await Promise.all(promises);

        results.forEach(dailyList => {
            if (!dailyList) return;
            dailyList.forEach((entry, index) => {
                const pts = RANK_POINTS[index] || 0;
                if (pts > 0) {
                    const key = entry.nickname; 
                    if (!globalScores[key]) {
                        globalScores[key] = { 
                            nickname: entry.nickname, 
                            avatar: entry.avatar, 
                            points: 0,
                            isMe: entry.isMe
                        };
                    }
                    globalScores[key].points += pts;
                }
            });
        });

        const sortedPlayers = Object.values(globalScores)
            .filter(p => p.points > 0)
            .sort((a, b) => b.points - a.points);

        renderPodium(sortedPlayers.slice(0, 10));
        
        // Ajuste V5: getProfile() substitui getNickname() direto
        const currentNick = OrkaCloud.getProfile()?.nickname;
        const myEntry = sortedPlayers.find(p => p.isMe) || sortedPlayers.find(p => p.nickname === currentNick);
        const myPoints = myEntry ? myEntry.points : 0;
        els.dashGlobalPts.textContent = `${myPoints} pts`;

    } catch (e) {
        console.error("Erro ao carregar season:", e);
        els.podiumContainer.innerHTML = '<small style="color:#d33">Falha ao carregar pódio</small>';
    }
}

function renderPodium(players) {
    els.podiumContainer.innerHTML = '';
    
    if (!players || players.length === 0) {
        els.podiumContainer.innerHTML = '<small style="color:#666; margin:auto;">Início de Temporada. Jogue para pontuar!</small>';
        return;
    }

    players.forEach((p, index) => {
        const rank = index + 1;
        const div = document.createElement('div');
        
        let rankClass = 'rank-other';
        if (rank === 1) rankClass = 'rank-1';
        else if (rank === 2) rankClass = 'rank-2';
        else if (rank === 3) rankClass = 'rank-3';

        div.className = `podium-item ${rankClass}`;
        
        // Ajuste Avatar URL se vier completo ou slug
        const avatarSrc = p.avatar.includes('/') ? p.avatar : `../../assets/avatars/${p.avatar}.png`;

        div.innerHTML = `
            <span class="rank-badge">${rank}º</span>
            <img src="${avatarSrc}" class="podium-avatar" onerror="this.src='../../assets/icons/orka-logo.png'">
            <span class="podium-nick">${p.nickname}</span>
            <div class="podium-pts">${p.points}<small>PTS</small></div>
        `;
        els.podiumContainer.appendChild(div);
    });
}

// =========================
// 4. LÓGICA DO JOGO (Core)
// =========================

function generateDailyLevel(dateInput) {
    const seed = OrkaMath.getDateSeed(dateInput);
    const rng = OrkaMath.createSeededRNG(seed);
    const level = { waves: [] };

    for (let w = 0; w < TOTAL_WAVES; w++) {
        const wave = { targets: [] };
        const count = 3 + (2 * w) + Math.floor(rng() * 1.5); 
        for (let i = 0; i < count; i++) {
            let type = 'normal';
            const roll = rng();
            if (w > 0 && roll > 0.7) type = 'moving';
            if (w > 1 && roll > 0.7) type = 'armored';

            let moveConfig = null;
            if (type === 'moving') {
                moveConfig = {
                    axis: rng() > 0.5 ? 'X' : 'Y',
                    speed: 2 + (rng() * 2) + 's',
                    range: 20 + (rng() * 30)
                };
            }
            wave.targets.push({
                id: `w${w}-t${i}`,
                x: 15 + (rng() * 70), y: 15 + (rng() * 70),
                scale: 0.9 + (rng() * 0.3), type: type, move: moveConfig
            });
        }
        level.waves.push(wave);
    }
    return level;
}

function startCountdown() {
    switchScreen('countdown');
    
    // V5: Inicia Sessão já foi feito no init(), mas para cada partida podemos
    // mandar um "checkpoint" de início ou criar nova sessão se o design permitir.
    // Como o Manager V5 cria UMA sessão por visita, vamos usar checkpoints.
    Game.checkpoint({ 
        status: 'countdown_started', 
        attempt_date: new Date() 
    });

    state.levelData = generateDailyLevel(state.currentDate);
    els.splatLayer.innerHTML = ''; 
    
    let count = 3;
    els.countText.textContent = count;
    els.countText.style.color = '#facc15';
    OrkaAudio.play('tick');
    
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            els.countText.textContent = count;
            els.countText.style.transform = 'scale(1.5)';
            OrkaAudio.play('tick');
            setTimeout(() => els.countText.style.transform = 'scale(1)', 100);
        } else if (count === 0) {
            els.countText.textContent = "AIM!";
            els.countText.style.color = '#ffffff';
            document.body.classList.add('game-mode');
            OrkaAudio.play('aim');
        } else {
            clearInterval(interval);
            startGame();
        }
    }, 700);
}

function startGame() {
    switchScreen('game');
    state.isPlaying = true;
    state.waveIndex = 0;
    state.penaltyTime = 0;
    state.bonusTime = 0;
    state.startTime = performance.now();
    
    // V5: Checkpoint de início de jogo
    Game.checkpoint({ status: 'game_started', wave: 0 });

    spawnWave(0);
    state.timerInterval = requestAnimationFrame(updateTimerLoop);
}

function updateTimerLoop() {
    if (!state.isPlaying) return;
    const now = performance.now();
    const current = Math.max(0, now - state.startTime + state.penaltyTime - state.bonusTime);
    els.timer.textContent = (current / 1000).toFixed(2);
    requestAnimationFrame(updateTimerLoop);
}

function spawnWave(index) {
    if (index >= TOTAL_WAVES) {
        finishGame();
        return;
    }
    
    // V5: Checkpoint de progresso
    Game.checkpoint({ 
        wave_completed: index, 
        current_time: els.timer.textContent 
    });

    state.waveIndex = index;
    els.wave.textContent = `ONDA ${index + 1}/${TOTAL_WAVES}`;
    els.targets.innerHTML = ''; 
    OrkaAudio.play('wave');
    
    const waveData = state.levelData.waves[index];
    state.targetsLeft = waveData.targets.length;

    waveData.targets.forEach((t, i) => {
        const el = document.createElement('div');
        el.className = 'target';
        if (t.type === 'armored') { el.classList.add('armored'); el.dataset.hp = 2; }
        if (t.type === 'moving') {
            el.classList.add('moving');
            const animName = t.move.axis === 'X' ? 'moveHorizontal' : 'moveVertical';
            el.style.animationName = animName; el.style.animationDuration = t.move.speed;
        }
        el.style.left = t.x + '%'; el.style.top = t.y + '%';
        el.style.transform = `translate(-50%, -50%) scale(0)`;
        
        setTimeout(() => {
            if(state.isPlaying) el.style.transform = `translate(-50%, -50%) scale(${t.scale})`;
        }, i * 50);

        const hitHandler = (e) => {
            const clientX = e.clientX || e.changedTouches[0].clientX;
            const clientY = e.clientY || e.changedTouches[0].clientY;
            e.preventDefault(); e.stopPropagation();
            if (!state.isPlaying) return;
            
            OrkaAudio.play('shoot');
            createVisualFX(clientX, clientY, true);

            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dist = Math.hypot(clientX - centerX, clientY - centerY);
            
            if (dist < (rect.width / 2) * 0.25) { 
                state.bonusTime += PERFECT_BONUS_MS;
                OrkaFX.toast(`PERFECT! -${(PERFECT_BONUS_MS/1000)}s`, 'success');
                OrkaAudio.play('precise');
                const flash = document.createElement('div'); flash.className = 'perfect-flash';
                document.body.appendChild(flash); setTimeout(() => flash.remove(), 200);
            }

            if (t.type === 'armored' && parseInt(el.dataset.hp) > 1) {
                el.dataset.hp = 1; el.classList.remove('armored'); 
                el.style.transform = `translate(-50%, -50%) scale(${t.scale * 0.8})`; 
                OrkaAudio.play('hit_armor'); createVisualFX(clientX, clientY, false, 'armored'); 
                return; 
            }
            const fxType = t.type === 'armored' ? 'armored' : 'normal';
            createVisualFX(clientX, clientY, true, fxType);
            el.remove();
            state.targetsLeft--;
            if (state.targetsLeft <= 0) setTimeout(() => spawnWave(state.waveIndex + 1), 100);
        };
        el.addEventListener('mousedown', hitHandler);
        el.addEventListener('touchstart', hitHandler);
        els.targets.appendChild(el);
    });
}

function handleMissClick(e) {
    if (!state.isPlaying) return;
    OrkaAudio.play('miss');
    state.penaltyTime += PENALTY_MS;
    OrkaFX.shake('game-wrapper');
    OrkaFX.toast('+1s ERRO!', 'error');
    const flash = document.createElement('div'); flash.className = 'penalty-flash';
    document.body.appendChild(flash); setTimeout(() => flash.remove(), 150);
}

function createVisualFX(x, y, isHit, variant = 'normal') {
    if (isHit) {
        const splat = document.createElement('div');
        const type = 1 + Math.floor(Math.random() * 3);
        splat.className = `splat splat-type-${type}`;
        if (variant === 'armored') splat.classList.add('splat-armored');
        splat.style.left = x + 'px'; splat.style.top = y + 'px';
        splat.style.transform = `translate(-50%, -50%) rotate(${Math.random()*360}deg)`;
        els.splatLayer.appendChild(splat);
    }
    const dropletsCount = 4 + Math.floor(Math.random() * 3);
    for(let i=0; i<dropletsCount; i++) {
        const drop = document.createElement('div');
        drop.className = 'splat-droplet';
        if (variant === 'armored') drop.classList.add('droplet-armored');
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * 25; 
        const size = 3 + Math.random() * 5;
        drop.style.width = size + 'px'; drop.style.height = size + 'px';
        drop.style.left = (x + (Math.cos(angle) * distance)) + 'px';
        drop.style.top = (y + (Math.sin(angle) * distance)) + 'px';
        els.splatLayer.appendChild(drop);
    }
    const ripple = document.createElement('div');
    ripple.className = 'touch-ripple';
    ripple.style.left = x + 'px'; ripple.style.top = y + 'px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
}

// =========================
// 5. FIM DE JOGO (MIGRAÇÃO CRÍTICA)
// =========================
async function finishGame() {
    state.isPlaying = false;
    cancelAnimationFrame(state.timerInterval);
    document.body.classList.remove('game-mode');
    
    const now = performance.now();
    const rawTime = Math.max(0, now - state.startTime + state.penaltyTime - state.bonusTime);
    state.finalTime = (rawTime / 1000).toFixed(3);
    
    // Salva recorde local (UI instantânea)
    saveDailyRecord(state.finalTime);
    
    // Toca som
    OrkaAudio.play('endgame');
    
    // V5: O EndGame faz tudo (Beacon, Analytics, Recompensa)
    // O 'score' aqui é o tempo (quanto menor melhor, mas o manager envia como está)
    // Se o jogo fosse de pontos (maior melhor), funcionaria igual.
    // Nota: Como Eagle Aim é "Menor Tempo", certifique-se que o Leaderboard no Supabase está ordenado ASC.
    // Se ainda não estiver, precisaremos ajustar a view ou a query.
    await Game.endGame('win', { 
        score: parseFloat(state.finalTime), // Importante converter pra float
        wave: TOTAL_WAVES,
        penalties: state.penaltyTime,
        perfect_bonus: state.bonusTime
    });

    els.btnPlay.textContent = 'JOGAR NOVAMENTE';
    switchScreen('menu');

    // V5: Perfil vem do Cloud
    const profile = OrkaCloud.getProfile();
    if (profile && profile.nickname) {
        // Envia Score explicitamente para atualizar ranking IMEDIATO na UI
        // (O Game.endGame já envia, mas aqui garantimos o refresh visual)
        await OrkaCloud.submitScore(GAME_ID, state.bestTime); 
        OrkaFX.toast('Ranking atualizado!', 'success');
        loadLeaderboardInline(); 
        refreshDashboardUI(); 
    } else {
        els.modalNick.classList.add('active'); 
    }
}

function switchScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

function updateDateDisplay() {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    els.dateDisplay.textContent = state.currentDate.toLocaleDateString('pt-BR', options).toUpperCase();
}

async function saveNicknameAndSubmit() {
    const name = els.nickInput.value.trim();
    if (!name) return OrkaFX.shake('modal-nick');
    
    // V5: updateProfile
    await OrkaCloud.updateProfile({ nickname: name });
    
    els.modalNick.classList.remove('active');
    refreshDashboardUI();
    if(state.bestTime) await OrkaCloud.submitScore(GAME_ID, state.bestTime);
    loadLeaderboardInline();
}

async function loadLeaderboardInline() {
    els.inlineRankingList.innerHTML = '<div class="loading-spinner small"></div>';
    // V5: getLeaderboard continua funcionando
    const data = await OrkaCloud.getLeaderboard(GAME_ID, state.currentDate);
    
    els.inlineRankingList.innerHTML = ''; 
    if (data.length === 0) {
        els.inlineRankingList.innerHTML = `<div style="text-align:center; color:#888; font-size:0.8rem; padding:20px;">Seja o primeiro a pontuar hoje!</div>`;
        return;
    }

    data.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = `ranking-row ${entry.isMe ? 'is-me' : ''}`;
        
        // Ajuste Avatar
        const avatarSrc = entry.avatar.includes('/') ? entry.avatar : `../../assets/avatars/${entry.avatar}.png`;

        div.innerHTML = `
            <div class="rank-left">
                <span class="rank-pos">#${index + 1}</span>
                <img src="${avatarSrc}" class="rank-avatar">
                <span class="rank-name">${entry.nickname}</span>
            </div>
            <span class="rank-score">${entry.score.toFixed(3)}s</span>
        `;
        els.inlineRankingList.appendChild(div);
    });
}

async function shareResult() {
    const dateStr = state.currentDate.toLocaleDateString('pt-BR');
    const text = `🦅 EAGLE AIM | ${dateStr}\n⏱️ Tempo: ${state.bestTime || '--'}s\n\n_Entre no pódio ficando entre os melhores nos últimos 7 dias!_\n\nJogue agora: orka-hub.vercel.app/games/eagleaim/`;
    try { await navigator.clipboard.writeText(text); OrkaFX.toast('Copiado!', 'success'); } catch (e) {}
}

init();

document.getElementById('btn-close-calendar')?.addEventListener('click', () => {
    Utils.toggleModal('modal-calendar', false);
});