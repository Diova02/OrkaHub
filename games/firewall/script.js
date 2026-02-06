import { OrkaAudio, OrkaFX, OrkaStorage, OrkaUI, OrkaMath, Utils } from '../../core/scripts/orka-lib.js';

// No seu init ou topo do script:
OrkaAudio.loadAll({
    'shoot': 'sfx/shoot.mp3',
    'hit': 'sfx/playerhit.mp3',
    'explosion': 'sfx/explosion.mp3',
    'coin': 'sfx/coin.mp3',
    'levelup': 'sfx/levelup.mp3',
    'gameover': 'sfx/gameover.mp3',
    'bgm': 'music/back_music.mp3'
});

// --- 1. AUDIO SYSTEM ---
class AudioSystem {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        
        // Filtro Lowpass (Efeito Abafado)
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 22000;
        this.filter.connect(this.masterGain);

        this.volumes = { master: 0.5, music: 0.5, sfx: 0.5 };
        this.bgm = null;
        
        // Simulação de caminhos (Você precisará dos arquivos reais)
        this.files = {
            shoot: 'sfx/shoot.mp3', hit: 'sfx/playerhit.mp3', explosion: 'sfx/explosion.mp3', coin: 'sfx/coin.mp3',
            levelup: 'sfx/levelup.mp3', gameover: 'sfx/gameover.mp3', bgm: 'music/back_music.mp3', newenemy: 'sfx/glitchnewenemy.mp3'
        };

        // Inicializa BGM
        this.bgm = new Audio(this.files.bgm);
        this.bgm.loop = true;
        this.bgm.volume = this.volumes.music * this.volumes.master;
        this.masterGain.gain.value = this.volumes.master;
    }

    playSound(key) {
        // Nota: Se não tiver arquivo, vai dar erro no console (Silent Fail)
        try {
            const audio = new Audio(this.files[key]);
            audio.volume = this.volumes.sfx * this.volumes.master;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => { /* Autoplay block ignorado */ });
            }
        } catch (e) { console.log("Audio file missing: " + key); }
    }

    playMusic() {
        try {
            this.bgm.volume = this.volumes.music * this.volumes.master;
            const playPromise = this.bgm.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => { console.log("Clique no jogo para iniciar a música."); });
            }
        } catch (e) {}
    }

    setMuffled(isMuffled) {
        const freq = isMuffled ? 600 : 22000;
        this.filter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
    }

    setVolume(type, val) {
        this.volumes[type] = parseFloat(val);
        if (type === 'master') {
            this.masterGain.gain.value = this.volumes.master;
            this.bgm.volume = this.volumes.music * this.volumes.master;
        }
        if (type === 'music') {
            this.bgm.volume = this.volumes.music * this.volumes.master;
        }
    }
}
const audioSys = new AudioSystem();

// --- 2. CONFIGURAÇÕES GERAIS ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Referências de UI Unificadas
const ui = {
    score: document.getElementById('score'),
    gold: document.getElementById('gold'),
    wave: document.getElementById('wave'),
    xpBar: document.getElementById('xp-bar'),
    hpBar: document.getElementById('hp-bar'),
    timer: document.getElementById('timer'),
    notif: document.getElementById('notification'),
    dmgOverlay: document.getElementById('damage-overlay'),
    shopContainer: document.getElementById('shop-container'),
    artifactsContainer: document.getElementById('artifacts-container'),
    settingsModal: document.getElementById('settings-modal'),
    cardsWrapper: document.getElementById('cards-wrapper'),
    screens: {
        levelup: document.getElementById('levelup-screen'),
        newEnemy: document.getElementById('new-enemy-screen'),
        gameOver: document.getElementById('game-over-screen')
    },
    newEnemy: {
        visual: document.getElementById('new-enemy-visual'),
        name: document.getElementById('new-enemy-name'),
        desc: document.getElementById('new-enemy-desc')
    }
};

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// --- DADOS ATUALIZADOS ---
const UPGRADES_DEF = {
    damage: { name: "Dano", icon: "⚔️", desc: "+ Dano Base", baseCost: 20, val: 10, inc: 4 }, // Preço reduzido
    speed:  { name: "Velocidade", icon: "⚡", desc: "- Delay Tiro", baseCost: 30, val: 60, dec: 3, min: 4 }, // Bem mais barato
    range:  { name: "Alcance", icon: "🎯", desc: "+ Raio Radar", baseCost: 25, val: 200, inc: 20 },
    hp:     { name: "Resistência", icon: "❤️", desc: "+ Vida Máx", baseCost: 40, val: 100, inc: 20 }
};

const ARTIFACTS_DEF = {
    // --- Clássicos ---
    poison: { name: "Nuvem Tóxica", icon: "☠️", color: "#0f0", maxLvl: 5, desc: "Dano em área constante.", upgDesc: "Aumenta raio e dano.", baseDmg: 0.2, rangePct: 0.35 },
    freeze: { name: "Balas Cryo", icon: "❄️", color: "#00ffff", maxLvl: 5, desc: "Congela inimigos.", upgDesc: "+ Tempo congelado.", duration: 30 },
    shield: { name: "Escudo Eletro", icon: "🛡️", color: "#0072ff", maxLvl: 5, desc: "Bloqueia 1 golpe.", upgDesc: "- Tempo de recarga.", cooldown: 1800 },
    midas: { name: "Toque de Midas", icon: "💰", color: "#ffd700", maxLvl: 5, desc: "Inimigos dropam ouro ao tocar.", upgDesc: "+ Chance de drop.", chance: 1.0 },
    vampire: { name: "Vampirismo", icon: "🩸", color: "#ff0000", maxLvl: 5, desc: "Cura ao matar.", upgDesc: "+ Cura por abate.", heal: 2 },
    explosive: { name: "Munição Explosiva", icon: "💥", color: "#ffaa00", maxLvl: 5, desc: "Dano em área no impacto.", upgDesc: "+ Área e dano.", radius: 60, dmgPct: 0.5 },
    knockback: { name: "Empurrão", icon: "🥊", color: "#ffffff", maxLvl: 5, desc: "Empurra inimigos.", upgDesc: "+ Força.", force: 10 },
    
    // --- NOVOS ---
    piercing: { name: "Perfurante", icon: "🏹", color: "#888", maxLvl: 5, desc: "Atravessa inimigos.", upgDesc: "+1 Inimigo perfurado.", count: 1 },
    orbital: { name: "Orbital", icon: "🪐", color: "#ff00ff", maxLvl: 5, desc: "Esferas giram e dão dano.", upgDesc: "+1 Esfera e velocidade.", count: 1, dmg: 5 },
    zapp: { name: "Super Choque", icon: "⚡", color: "#ffeb3b", maxLvl: 5, desc: "Raio aleatório insta-hit.", upgDesc: "- Cooldown do raio.", cooldown: 180 }, // 3s inicial
    sniper: { name: "Balística", icon: "🔭", color: "#4caf50", maxLvl: 5, desc: "Mais dano longe do canhão.", upgDesc: "+ Multiplicador de distância.", mult: 0.005 }, // 0.5% por pixel
    echo: { name: "Eco", icon: "🔊", color: "#00bcd4", maxLvl: 5, desc: "Tiro ricocheteia ao acertar.", upgDesc: "+ Dano do ricochete.", dmgPct: 0.4 }
};

const CLASSES_DEF = {
    sniper: { name: "Sniper", icon: "🔭", color: "#4caf50", desc: "+30% Range/Dano, -20% Speed/HP", stats: { range: 1.3, damage: 1.3, speed: 1.2, maxHp: 0.8 } }, // Speed maior = mais lento (delay)
    machine: { name: "Metralhadora", icon: "🔫", color: "#ff9800", desc: "+100% Speed, -60% Dano", stats: { speed: 0.5, damage: 0.4 } }, // Speed menor = mais rápido
    shotgun: { name: "Escopeta", icon: "🧨", color: "#795548", desc: "+40% Dano, -30% Range", stats: { damage: 1.4, range: 0.7 } },
    tank: { name: "Tanque", icon: "🛡️", color: "#607d8b", desc: "+50% HP, +30% Dano, -50% Speed", stats: { maxHp: 1.5, damage: 1.3, speed: 1.5 } }
};
const ENEMIES_DEF = {
    square: { 
        name: "Cubo", color: "#ff4444", shape: "square", 
        hpMult: 1.0, speed: 1.5, size: 20, goldChance: 0.2, minWave: 1 
    },
    triangle: { 
        name: "Velocista", color: "#ffff00", shape: "triangle", 
        hpMult: 0.6, speed: 3.5, size: 15, goldChance: 0.1, minWave: 2 
    },
    circle: { 
        name: "Tanque", color: "#aa00ff", shape: "circle", 
        hpMult: 2.5, speed: 0.7, size: 30, goldChance: 0.8, minWave: 4 
    },
    rhombus: { 
        name: "Ladino", color: "#00ffaa", shape: "rhombus", 
        hpMult: 1.2, speed: 0.5, size: 20, goldChance: 0.3, minWave: 5,
        behavior: 'dash', dashChance: 0.05, dashSpeed: 8
    },
    hexagon: { 
        name: "Clérigo", color: "#00ff00", shape: "hexagon", 
        hpMult: 1.5, speed: 1.0, size: 25, goldChance: 0.4, minWave: 6,
        behavior: 'healer', healRange: 100, healAmount: 10, healCooldown: 60
    }
};

// --- GAME STATE ---
let game = {
    state: 'PLAYING', score: 0, gold: 0, level: 1, xp: 0, xpNext: 100,
    wave: 1, waveTimer: 30, spawnRate: 160, lastTime: 0,
    upgrades: {}, artifacts: {}, spawnPool: ['square'], isRunning: true
};
let player;
let entities = { bullets: [], enemies: [], particles: [], drops: [] };
let spawnTimer = 0;
let animationId; // Para controle do loop

// --- FUNÇÕES GLOBAIS ---

function init() {
    if (animationId) cancelAnimationFrame(animationId); // Evita loop duplicado

    // Reset
    game = {
        state: 'PLAYING', score: 0, gold: 0, level: 1, xp: 0, xpNext: 100,
        wave: 1, waveTimer: 30, spawnRate: 160, lastTime: 0,
        upgrades: JSON.parse(JSON.stringify(UPGRADES_DEF)), 
        artifacts: {}, spawnPool: ['square'], isRunning: true
    };
    // Inicializa upgrades
    for(let k in game.upgrades) {
        game.upgrades[k].level = 1; game.upgrades[k].currentVal = game.upgrades[k].val; game.upgrades[k].cost = game.upgrades[k].baseCost;
    }

    player = new Player();
    entities = { bullets: [], enemies: [], particles: [], drops: [] };
    spawnTimer = 0;
    
    // UI Reset
    Object.values(ui.screens).forEach(s => s.classList.remove('visible'));
    ui.score.innerText = 0; ui.gold.innerText = 0; ui.wave.innerText = 1;
    ui.xpBar.style.width = '0%'; ui.hpBar.style.width = '100%'; ui.hpBar.style.backgroundColor='#0f0';
    
    updateShopUI();
    updateArtifactsUI();

    // Tenta tocar música
    document.body.onclick = () => { audioSys.playMusic(); document.body.onclick = null; }

    loop(0);
}

function showNotification(txt, color='#fff') {
    ui.notif.innerText = txt;
    ui.notif.style.color = color;
    ui.notif.style.opacity = 1;
    setTimeout(() => ui.notif.style.opacity = 0, 1500);
}

// --- PERSISTÊNCIA & RANKING ---
function saveScoreLocal() {
    const totalScore = (game.wave * 10) + (game.level * 5) + game.score;
    const record = { date: new Date().toLocaleDateString(), wave: game.wave, score: totalScore };
    let rank = JSON.parse(localStorage.getItem('autoShooter_rank') || "[]");
    rank.push(record);
    rank.sort((a, b) => b.score - a.score);
    rank = rank.slice(0, 5);
    localStorage.setItem('autoShooter_rank', JSON.stringify(rank));
    return rank;
}

function clearData() {
    OrkaUI.confirm("Tem certeza, frangote?", "Isso apagará seu recorde para sempre.", () => {
        localStorage.removeItem('firewall_rank');
        OrkaFX.toast("Ranking resetado!", "info");
        toggleSettings();
    });
}

function getLeaderboardHTML(rankData) {
    if (!rankData || rankData.length === 0) return '<div style="color:#666; margin-top:10px;">Sem registros...</div>';
    let html = '<div class="leaderboard-box"><div class="lb-header">TOP 5 JOGADORES</div>';
    rankData.forEach((r, i) => {
        html += `<div class="lb-row"><span>#${i+1} ${r.date}</span><span>W:${r.wave} PTS:${r.score}</span></div>`;
    });
    html += '</div>';
    return html;
}

function toggleSettings() {
    const modal = ui.settingsModal;
    modal.classList.toggle('visible');
    if (modal.classList.contains('visible')) {
        if (game.state === 'PLAYING') { game.state = 'PAUSED_SETTINGS'; audioSys.setMuffled(true); }
    } else {
        if (game.state === 'PAUSED_SETTINGS') { game.state = 'PLAYING'; audioSys.setMuffled(false); }
    }
}

// --- SHOP & UPGRADES ---
function updateShopUI() {
    ui.shopContainer.innerHTML = '';
    for (let key in game.upgrades) {
        const upg = game.upgrades[key];
        const btn = document.createElement('div');
        btn.className = `shop-btn ${game.gold >= upg.cost ? '' : 'disabled'}`;
        btn.onclick = () => buyBaseUpgrade(key);
        btn.innerHTML = `
            <div class="btn-header"><span class="btn-icon">${upg.icon}</span> <span class="btn-lvl">Lv.${upg.level}</span></div>
            <div class="btn-desc">${upg.desc}</div>
            <div class="btn-cost">$${upg.cost}</div>
        `;
        ui.shopContainer.appendChild(btn);
    }
}

function buyBaseUpgrade(key) {
    if (game.state !== 'PLAYING') return;
    const upg = game.upgrades[key];
    if (game.gold >= upg.cost) {
        game.gold -= upg.cost; ui.gold.innerText = game.gold;
        upg.level++; upg.cost = Math.floor(upg.cost * 1.3);
        
        if (key === 'damage') { upg.currentVal += upg.inc; player.damage = upg.currentVal; }
        else if (key === 'speed') { upg.currentVal = Math.max(upg.min, upg.currentVal - upg.dec); player.fireRate = upg.currentVal; }
        else if (key === 'range') { upg.currentVal += upg.inc; player.range = upg.currentVal; }
        else if (key === 'hp') { 
            upg.currentVal += upg.inc; player.maxHp = upg.currentVal; 
            player.hp += upg.inc; player.updateHpUI();
        }
        updateShopUI(); showNotification(`${upg.name} UP!`);
    }
}

// --- CARDS & LEVEL UP ---
// --- LEVEL UP LOGIC ---
function checkLevelUp() {
    if (game.xp >= game.xpNext) {
        game.xp = 0; game.level++; game.xpNext = Math.floor(game.xpNext * 1.3);
        ui.xpBar.style.width = '0%';
        game.state = 'PAUSED_LVL'; audioSys.setMuffled(true); OrkaAudio.play('levelup',);
        
        // ESPECIAL LEVEL 5: ESCOLHA DE CLASSE
        if (game.level === 5) {
            generateClassCards();
        } else {
            generateCards();
        }
        
        ui.screens.levelup.classList.add('visible');
        saveScoreLocal();
    } else { ui.xpBar.style.width = (game.xp / game.xpNext * 100) + '%'; }
}

function generateClassCards() {
    ui.cardsWrapper.innerHTML = '';
    const title = document.querySelector('#levelup-screen h1');
    title.innerText = "ESPECIALIZAÇÃO";
    title.style.color = "#ff00ff"; // Roxo para destacar
    
    for (let key in CLASSES_DEF) {
        const def = CLASSES_DEF[key];
        const card = document.createElement('div');
        card.className = 'card new-power';
        card.style.borderColor = def.color;
        card.onclick = () => selectClass(key);
        
        card.innerHTML = `
            <div class="card-type" style="color:${def.color}">CLASSE</div>
            <div class="card-icon" style="color:${def.color}">${def.icon}</div>
            <div class="card-title">${def.name}</div>
            <div class="card-desc" style="font-size:0.9rem">${def.desc}</div>
            <div class="card-lvl">Escolha Única</div>
        `;
        ui.cardsWrapper.appendChild(card);
    }
}

function selectClass(key) {
    const def = CLASSES_DEF[key];
    const s = def.stats;
    
    // Aplica modificadores permanentes
    if(s.damage) { player.damage *= s.damage; game.upgrades.damage.currentVal = player.damage; }
    if(s.range) { player.range *= s.range; game.upgrades.range.currentVal = player.range; }
    if(s.maxHp) { player.maxHp *= s.maxHp; player.hp = player.maxHp; game.upgrades.hp.currentVal = player.maxHp; player.updateHpUI(); }
    if(s.speed) { player.fireRate *= s.speed; game.upgrades.speed.currentVal = player.fireRate; }

    showNotification(`CLASSE: ${def.name.toUpperCase()}!`, def.color);
    
    // Reseta titulo do modal
    document.querySelector('#levelup-screen h1').innerText = "LEVEL UP!";
    document.querySelector('#levelup-screen h1').style.color = "#00c6ff";
    
    closeLevelUp();
}

function generateCards() {
    ui.cardsWrapper.innerHTML = '';
    const allKeys = Object.keys(ARTIFACTS_DEF);
    const ownedKeys = Object.keys(game.artifacts);
    
    let pool = [];
    allKeys.forEach(key => {
        if (game.artifacts[key] >= ARTIFACTS_DEF[key].maxLvl) return;
        pool.push(key);
        if (ownedKeys.includes(key)) pool.push(key); // Peso duplo para o que já tem
    });

    if (pool.length === 0) {
            ui.cardsWrapper.innerHTML = `<div class="card upgrade-power" onclick="player.hp=player.maxHp; player.updateHpUI(); closeLevelUp()"><div class="card-icon">❤️</div><div class="card-title">Cura Total</div><div class="card-desc">Maxed Out!</div></div>`;
            return;
    }

    let choices = [];
    while(choices.length < 3 && pool.length > 0) {
        const rand = pool[Math.floor(Math.random() * pool.length)];
        pool = pool.filter(k => k !== rand);
        choices.push(rand);
    }

    choices.forEach(key => {
        const def = ARTIFACTS_DEF[key];
        const currentLvl = game.artifacts[key] || 0;
        const isNew = currentLvl === 0;

        const card = document.createElement('div');
        card.className = `card ${isNew ? 'new-power' : 'upgrade-power'}`;
        card.onclick = () => selectArtifact(key);
        
        // Texto Personalizado
        const desc = isNew ? def.desc : (def.upgDesc || "Melhora o efeito atual.");

        card.innerHTML = `
            <div class="card-type">${isNew ? "NOVO PODER" : "MELHORIA"}</div>
            <div class="card-icon" style="color:${def.color}">${def.icon}</div>
            <div class="card-title">${def.name}</div>
            <div class="card-desc">${desc}</div>
            <div class="card-lvl">${isNew ? 'Desbloquear' : 'Lvl ' + currentLvl + ' ➤ ' + (currentLvl+1)}</div>
        `;
        ui.cardsWrapper.appendChild(card);
    });
}

function selectArtifact(key) {
    if (!game.artifacts[key]) game.artifacts[key] = 0;
    game.artifacts[key]++;
    if (key === 'shield') player.shieldTimer = 0; 
    updateArtifactsUI(); closeLevelUp();
}

function updateArtifactsUI() {
    ui.artifactsContainer.innerHTML = '';
    for (let key in game.artifacts) {
        const def = ARTIFACTS_DEF[key];
        const lvl = game.artifacts[key];
        const div = document.createElement('div');
        div.className = 'artifact-icon';
        div.style.borderColor = def.color;
        div.innerHTML = `${def.icon} <span class="artifact-lvl">${lvl}</span>`;
        ui.artifactsContainer.appendChild(div);
    }
}

function closeLevelUp() {
    ui.screens.levelup.classList.remove('visible');
    game.state = 'PLAYING'; audioSys.setMuffled(false);
}

// --- GAMEPLAY HELPERS ---
function nextWave() {
    game.wave++; game.waveTimer = 30; 
    // APOCALYPSE CURVE: Reduz spawnRate drasticamente
    // Começa em 160. Onda 10 deve ser insana (ex: 20 frames = 3 inimigos por segundo)
    game.spawnRate = Math.max(15, Math.floor(160 * Math.pow(0.85, game.wave))); 
    
    ui.wave.innerText = game.wave;
    let newEnemyKey = null;
    for (let key in ENEMIES_DEF) {
        if (ENEMIES_DEF[key].minWave === game.wave && !game.spawnPool.includes(key)) {
            newEnemyKey = key; break;
        }
    }
    if (newEnemyKey) {
        game.state = 'PAUSED_ENEMY'; audioSys.setMuffled(true);
        OrkaAudio.play('newenemy')
        const def = ENEMIES_DEF[newEnemyKey];
        ui.newEnemy.name.innerText = def.name; ui.newEnemy.name.style.color = def.color;
        ui.newEnemy.desc.innerText = def.desc;
        ui.newEnemy.visual.style.backgroundColor = def.color;
        ui.newEnemy.visual.style.borderRadius = def.shape === 'circle' ? '50%' : '0';
        ui.newEnemy.visual.style.clipPath = def.shape === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none';
        game.spawnPool.push(newEnemyKey);
        ui.screens.newEnemy.classList.add('visible');
    } else {
        showNotification(`ONDA ${game.wave}`, '#ff0055');
    }
    saveScoreLocal();
}

window.resumeGame = function() {
    ui.screens.newEnemy.classList.remove('visible');
    game.state = 'PLAYING'; audioSys.setMuffled(false);
}

window.restartGame = init;

function endGame() {
    game.isRunning = false; game.state = 'GAMEOVER'; audioSys.setMuffled(true); OrkaAudio.play('gameover');
    const rank = saveScoreLocal();
    const rankHTML = getLeaderboardHTML(rank);
    const goScreen = ui.screens.gameOver;
    goScreen.innerHTML = `
        <h1 style="color: #ff0055; font-size: 4rem; margin-bottom: 10px;">GAME OVER</h1>
        <p style="color: #fff; font-size: 1.2rem;">Onda alcançada: <span style="color:#fff; font-weight:bold">${game.wave}</span></p>
        ${rankHTML}
        <button class="continue-btn" onclick="restartGame()" style="margin-top:20px">Tentar Novamente</button>
    `;
    goScreen.classList.add('visible');
}

// --- CLASSES ---
class Player {
    constructor() {
        this.x = canvas.width/2; this.y = canvas.height/2;
        this.size = 25; this.color = '#00ffcc';
        this.maxHp = game.upgrades.hp.currentVal; this.hp = this.maxHp;
        this.range = game.upgrades.range.currentVal;
        this.damage = game.upgrades.damage.currentVal;
        this.fireRate = game.upgrades.speed.currentVal;
        this.angle = 0; this.cooldown = 0; this.regenTimer = 0;
        this.shieldActive = false; this.shieldTimer = 0; this.poisonTimer = 0;
    }

    update() {
        this.x = canvas.width/2; this.y = canvas.height/2;

        // Regen
        if (Date.now() - this.regenTimer > 3000 && this.hp < this.maxHp) {
            this.hp += 0.05; this.updateHpUI();
        }

        // Power: SHIELD
        if (game.artifacts.shield) {
            const def = ARTIFACTS_DEF.shield;
            const cd = Math.max(600, def.cooldown - (game.artifacts.shield * 200));
            if (!this.shieldActive) {
                this.shieldTimer++;
                if (this.shieldTimer >= cd) { this.shieldActive = true; showNotification("ESCUDO PRONTO", "#0072ff"); }
            }
        }

        // Power: ZAPP (Raio)
        if (game.artifacts.zapp) {
            if (!this.zappTimer) this.zappTimer = 0;
            this.zappTimer++;
            const cd = ARTIFACTS_DEF.zapp.cooldown - (game.artifacts.zapp * 20);
            if (this.zappTimer >= cd && entities.enemies.length > 0) {
                this.zappTimer = 0;
                // Pega inimigo aleatório no range
                const targets = entities.enemies.filter(e => Math.hypot(e.x-this.x, e.y-this.y) <= this.range);
                if (targets.length > 0) {
                    const target = targets[Math.floor(Math.random() * targets.length)];
                    target.takeDamage(50 + (game.artifacts.zapp * 20)); // Dano alto
                    // Desenha raio visual (simples linha amarela)
                    ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(target.x, target.y); ctx.stroke();
                    OrkaAudio.play('shoot'); // Som de zap
                }
            }
        }

        // Power: POISON
        if (game.artifacts.poison) {
            this.poisonTimer++;
            if (this.poisonTimer > 20) {
                this.poisonTimer = 0;
                const radius = this.range * ARTIFACTS_DEF.poison.rangePct;
                const dmg = ARTIFACTS_DEF.poison.baseDmg * game.artifacts.poison * 2;
                entities.enemies.forEach(e => {
                    if (Math.hypot(e.x - this.x, e.y - this.y) < radius) {
                        e.takeDamage(dmg); entities.particles.push(new Particle(e.x, e.y, '#0f0'));
                    }
                });
            }
        }

        // Shoot Logic
        let nearest = null; let minDist = Infinity;
        entities.enemies.forEach(e => {
            const d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d < minDist && d <= this.range) { minDist = d; nearest = e; }
        });

        if (nearest) {
            this.angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
            if (this.cooldown <= 0) {
                entities.bullets.push(new Bullet(this.x, this.y, this.angle, this.damage));
                this.cooldown = this.fireRate;
                OrkaAudio.play('shoot');
            }
        }
        if (this.cooldown > 0) this.cooldown--;
    }
    takeDamage(amount) {
        if (this.shieldActive) {
            this.shieldActive = false; this.shieldTimer = 0;
            for(let i=0; i<10; i++) entities.particles.push(new Particle(this.x, this.y, '#0072ff'));
            return;
        }
        this.hp -= amount; this.regenTimer = Date.now();
        ui.dmgOverlay.style.opacity = 0.5; setTimeout(() => ui.dmgOverlay.style.opacity = 0, 100);
        this.updateHpUI();
        OrkaAudio.play('hit');

        if (this.hp <= 0) endGame();
    }

    updateHpUI() {
        const pct = (this.hp / this.maxHp) * 100;
        ui.hpBar.style.width = Math.max(0, pct) + '%';
        ui.hpBar.style.backgroundColor = pct < 30 ? '#f00' : '#0f0';
    }

    draw() {
        ctx.save(); ctx.translate(this.x, this.y); 
        if (game.artifacts.poison) {
            ctx.beginPath(); ctx.arc(0, 0, this.range * ARTIFACTS_DEF.poison.rangePct, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)'; ctx.fill();
        }
        ctx.rotate(this.angle);
        ctx.fillStyle = '#222'; ctx.fillRect(-14, -14, 28, 28);
        ctx.fillStyle = this.color; ctx.fillRect(-12, -12, 24, 24);
        ctx.fillStyle = '#fff'; ctx.fillRect(5, -4, 20, 8);
        ctx.restore();
        if (this.shieldActive) {
            ctx.strokeStyle = '#0072ff'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this.x, this.y, 35, 0, Math.PI*2); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.range, 0, Math.PI*2); ctx.stroke();
    }
}

// Cache global de imagens para evitar re-carregamento
const ENEMY_SPRITES = {};

class Enemy {
    constructor(wave) {
        const key = game.spawnPool[Math.floor(Math.random() * game.spawnPool.length)];
        const def = ENEMIES_DEF[key];

        // Atributos Base
        this.key = key;
        this.name = def.name;
        this.size = def.size;
        this.speed = def.speed;
        this.baseSpeed = def.speed;
        this.goldChance = def.goldChance;
        this.color = def.color; // Mantido para partículas e efeitos
        
        // Vida escalável
        this.maxHp = (10 + (wave * 3)) * (def.hpMult || 1);
        this.hp = this.maxHp;

        // Estados e Timers
        this.freezeTimer = 0;
        this.hitTimer = 0;
        this.specialTimer = 0;
        this.angle = 0;

        // Carregamento do Sprite
        this.loadSprite();

        // Posição inicial
        this.initSpawnPosition();
    }

    loadSprite() {
        const spritePath = `./assets/${this.name}.png`;
        if (!ENEMY_SPRITES[this.name]) {
            const img = new Image();
            img.src = spritePath;
            ENEMY_SPRITES[this.name] = img;
            
            // Tratamento de erro para evitar o estado 'broken'
            img.onerror = () => {
                console.warn(`⚠️ Sprite não encontrado: ${spritePath}. Usando fallback.`);
                ENEMY_SPRITES[this.name] = "ERROR"; // Marca como erro para o draw ignorar
            };
        }    
            
        this.sprite = ENEMY_SPRITES[this.name];
    }

    initSpawnPosition() {
        const edge = Math.floor(Math.random() * 4);
        const padding = 50;
        if(edge === 0) { this.x = Math.random() * canvas.width; this.y = -padding; }
        else if(edge === 1) { this.x = canvas.width + padding; this.y = Math.random() * canvas.height; }
        else if(edge === 2) { this.x = Math.random() * canvas.width; this.y = canvas.height + padding; }
        else { this.x = -padding; this.y = Math.random() * canvas.height; }
    }

    update() {
        if (this.hitTimer > 0) this.hitTimer--;
        if (this.freezeTimer > 0) { this.freezeTimer--; return; }

        const def = ENEMIES_DEF[this.key];

        // Lógica de Comportamento Especial
        if (def.behavior === 'healer') {
            this.specialTimer++;
            if (this.specialTimer > def.healCooldown) {
                this.specialTimer = 0;
                this.executeHeal(def.healRange, def.healAmount);
            }
        }

        if (def.behavior === 'dash') {
            this.speed = (Math.random() < def.dashChance) ? def.dashSpeed : this.baseSpeed;
        }

        // Movimento e Rotação em direção ao player
        this.angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    }

    executeHeal(range, amount) {
        entities.enemies.forEach(e => {
            if (e !== this && Math.hypot(e.x - this.x, e.y - this.y) < range) {
                e.hp = Math.min(e.maxHp, e.hp + amount);
                entities.particles.push(new Particle(e.x, e.y, '#00ff00'));
            }
        });
    }

    takeDamage(amt) {
        this.hp -= amt;
        this.hitTimer = 5; // Frame de feedback visual (piscar branco)
        if (this.hp <= 0) this.die();
    }

    die() {
        // Vampirismo (Regra de gameplay baseada em artefatos)
        if (game.artifacts.vampire) {
            const healAmt = ARTIFACTS_DEF.vampire.heal + (game.artifacts.vampire * 2);
            player.hp = Math.min(player.maxHp, player.hp + healAmt);
            player.updateHpUI();
            entities.particles.push(new Particle(player.x, player.y, '#ff0000'));
        }

        game.score++;
        ui.score.innerText = game.score;

        // Efeitos visuais e sonoros
        for(let i=0; i<8; i++) entities.particles.push(new Particle(this.x, this.y, this.color));
        OrkaAudio.play('explosion');

        // Drops
        if (Math.random() < this.goldChance) entities.drops.push(new Drop(this.x, this.y, 'gold'));
        entities.drops.push(new Drop(this.x, this.y, 'xp'));
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI/2); // Ajusta rotação se o sprite estiver virado para cima

        // Feedback de Dano (Piscar Branco)
        if (this.hitTimer > 0) {
            ctx.filter = 'brightness(3) grayscale(1)'; 
        } else if (this.freezeTimer > 0) {
            ctx.filter = 'hue-rotate(180deg) brightness(1.2)'; // Efeito azulado
        }

        // Desenha o Sprite
        if (this.sprite.complete) {
            ctx.drawImage(this.sprite, -this.size/2, -this.size/2, this.size, this.size);
        } else {
            // Fallback caso a imagem ainda não tenha carregado
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        }

        ctx.restore();

        // Barra de vida (fora do save/rotate para não girar junto com o inimigo)
        if (this.hp < this.maxHp) this.drawHealthBar();
    }

    drawHealthBar() {
        const pct = this.hp / this.maxHp;
        const barWidth = this.size;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - barWidth/2, this.y - this.size/2 - 10, barWidth, 4);
        ctx.fillStyle = pct > 0.3 ? '#0f0' : '#f00';
        ctx.fillRect(this.x - barWidth/2, this.y - this.size/2 - 10, barWidth * pct, 4);
    }
}

class Bullet {
    constructor(x,y,a,dmg) { 
        this.x=x; this.y=y; this.startX=x; this.startY=y; // Salva origem para Sniper
        this.vx=Math.cos(a)*12; this.vy=Math.sin(a)*12; 
        this.dmg=dmg; this.r=4; this.del=false;
        
        // Power: PIERCING
        this.pierce = 0;
        if (game.artifacts.piercing) this.pierce = ARTIFACTS_DEF.piercing.count + (game.artifacts.piercing - 1);
        
        this.hitList = []; // Lista de IDs de inimigos já acertados (para não acertar o mesmo 2x no piercing)
    }
    update() { 
        this.x+=this.vx; this.y+=this.vy; 
        if(this.x<0||this.x>canvas.width||this.y<0||this.y>canvas.height) this.del=true; 
    }
    draw() { ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fillStyle='#fffa'; ctx.fill(); }
}

class Particle {
    constructor(x,y,c) { this.x=x; this.y=y; this.c=c; this.life=1; this.vx=(Math.random()-0.5)*5; this.vy=(Math.random()-0.5)*5; }
    update() { this.x+=this.vx; this.y+=this.vy; this.life-=0.05; }
    draw() { ctx.globalAlpha=this.life; ctx.fillStyle=this.c; ctx.beginPath(); ctx.arc(this.x,this.y,Math.random()*4,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
}

class Drop {
    constructor(x,y,t) { this.x=x; this.y=y; this.t=t; this.timer=30; this.del=false; this.vx=(Math.random()-0.5)*5; this.vy=(Math.random()-0.5)*5; }
    update() {
        this.x+=this.vx; this.y+=this.vy; this.vx*=0.9; this.vy*=0.9;
        if(this.timer>0) this.timer--;
        else {
            const a=Math.atan2(player.y-this.y, player.x-this.x); this.x+=Math.cos(a)*9; this.y+=Math.sin(a)*9;
            if(Math.hypot(player.x-this.x, player.y-this.y)<30) {
                this.del=true;
                if(this.t==='gold') { game.gold+=10; OrkaAudio.play('coin'); ui.gold.innerText=game.gold; updateShopUI(); }
                else { game.xp+=15; checkLevelUp(); }
            }
        }
    }
    draw() { 
        ctx.fillStyle = this.t==='gold'?'#ffd700':'#00c6ff';
        if(this.t==='gold') ctx.fillRect(this.x-4,this.y-4,8,8); else { ctx.beginPath(); ctx.arc(this.x,this.y,5,0,Math.PI*2); ctx.fill(); }
    }
}

// --- LOOP ---
function loop(now) {
    animationId = requestAnimationFrame(loop);
    if (game.state !== 'PLAYING') return;

    if (now - game.lastTime >= 1000) {
        game.waveTimer--; ui.timer.innerText = game.waveTimer;
        if (game.waveTimer <= 0) nextWave();
        game.lastTime = now;
    }

    ctx.fillStyle = 'rgba(21, 21, 21, 0.3)'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    spawnTimer++;
    if (spawnTimer >= game.spawnRate) { entities.enemies.push(new Enemy(game.wave)); spawnTimer = 0; }

    player.update(); player.draw();

    entities.enemies.forEach((e, i) => {
        e.update(); e.draw();
        // Colisão Player
        if (Math.hypot(player.x-e.x, player.y-e.y) < player.size + e.size/2) {
            if (game.artifacts.midas) entities.drops.push(new Drop(e.x, e.y, 'gold'));
            player.takeDamage(15);
            e.die(); entities.enemies.splice(i, 1); return;
        }
        // Colisão Bala
        entities.bullets.forEach(b => {
            // Checa se já acertou esse inimigo (para piercing)
            if (!b.del && !b.hitList.includes(e) && Math.hypot(b.x-e.x, b.y-e.y) < e.size/2+b.r) {
                
                // Power: SNIPER (Dano por distância)
                let finalDmg = b.dmg;
                if (game.artifacts.sniper) {
                    const dist = Math.hypot(b.x - b.startX, b.y - b.startY);
                    const mult = 1 + (dist * (ARTIFACTS_DEF.sniper.mult * game.artifacts.sniper));
                    finalDmg *= mult;
                }

                e.takeDamage(finalDmg);
                b.hitList.push(e); // Marca inimigo como atingido

                // Lógica de PIERCING
                if (b.pierce > 0) {
                    b.pierce--; // Continua vivo, mas perde 1 carga
                } else {
                    b.del = true; // Morre
                }

                // Power: ECHO (Ricochete)
                if (game.artifacts.echo && Math.random() < 0.5) { // 50% chance para não lagar
                    const echoDmg = finalDmg * (ARTIFACTS_DEF.echo.dmgPct + (game.artifacts.echo * 0.1));
                    // Cria bala nova indo pro inimigo mais próximo (exceto o atual)
                    const others = entities.enemies.filter(en => en !== e);
                    if (others.length > 0) {
                        const nearest = others.reduce((prev, curr) => Math.hypot(curr.x-b.x, curr.y-b.y) < Math.hypot(prev.x-b.x, prev.y-b.y) ? curr : prev);
                        const ang = Math.atan2(nearest.y - b.y, nearest.x - b.x);
                        entities.bullets.push(new Bullet(b.x, b.y, ang, echoDmg));
                    }
                }

                // Efeitos existentes (Freeze, Knockback, Explosive)...
                if (game.artifacts.freeze) e.freezeTimer = ARTIFACTS_DEF.freeze.duration + (game.artifacts.freeze * 10);
                if (game.artifacts.knockback) {
                    const force = ARTIFACTS_DEF.knockback.force + (game.artifacts.knockback * 3);
                    const a = Math.atan2(e.y-b.y, e.x-b.x); e.x+=Math.cos(a)*force; e.y+=Math.sin(a)*force;
                }
                if (game.artifacts.explosive) {
                    const range = ARTIFACTS_DEF.explosive.radius + (game.artifacts.explosive * 15);
                    const dmg = finalDmg * ARTIFACTS_DEF.explosive.dmgPct;
                    ctx.beginPath(); ctx.arc(b.x,b.y,range,0,Math.PI*2); ctx.fillStyle='rgba(255,170,0,0.3)'; ctx.fill();
                    OrkaAudio.play('explosion');
                    entities.enemies.forEach(o => { if(o!==e && Math.hypot(o.x-b.x,o.y-b.y)<range) o.takeDamage(dmg); });
                }
            }
        });
        if(e.hp<=0 && !e.markedForDeletion) entities.enemies.splice(i,1);
    });

    entities.bullets = entities.bullets.filter(b => { b.update(); b.draw(); return !b.del; });
    entities.drops = entities.drops.filter(d => { d.update(); d.draw(); return !d.del; });
    entities.particles = entities.particles.filter(p => { p.update(); p.draw(); return p.life>0; });
}

// --- INICIALIZAÇÃO E LISTENERS ---
document.addEventListener('DOMContentLoaded', async () => {
    // Carrega todos os áudios antes de começar
    //await OrkaAudio.loadAll(SOUND_FILES);

    // Listeners de UI
    document.getElementById('settings-btn').addEventListener('click', toggleSettings);
    document.getElementById('btn-back-game').addEventListener('click', toggleSettings);
    document.getElementById('btn-clear-rank').addEventListener('click', clearData);
    document.getElementById('btn-continue').addEventListener('click', resumeGame);
    
    // Sliders de Volume (Usando OrkaAudio para aplicar)
    //document.getElementById('vol-master').addEventListener('input', (e) => {
        // A OrkaLib gerencia o gain do contexto global
    //    if (OrkaAudio.context) OrkaAudio.context.resume();
    //});

    // Inicia o jogo
    init();
});