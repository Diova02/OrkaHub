//incluir o sistema de sessões simples da OrkaCloud.js
import { OrkaCloud } from  '../../core/scripts/orka-cloud.js';
import { OrkaFX, OrkaStorage, OrkaUI, OrkaMath, Utils } from '../../core/scripts/orka-lib.js';
import { UPGRADES_DEF, ARTIFACTS_DEF, ENEMIES_DEF, CLASSES_DEF, AUDIOS_DEF } from './data.js';
import { Drop, Bullet, Enemy, Player } from './classes.js';
import { OrkaAudio } from '../../orkaAudio/dist/orka-audio.js';

// --- 2. CONFIGURAÇÕES GERAIS ---
let canvas, ctx, ui;

async function initializeDOM() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Make canvas globally accessible to modules
    window.canvas = canvas;
    window.ctx = ctx;

    // Referências de UI Unificadas
    ui = {
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
    window.ui = ui;

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resize);
    resize();

    startAudio();
    await OrkaAudio.loadAll(AUDIOS_DEF);
    startMusic(); 
}

// --- GAME STATE (Updated) ---
let game = {
    state: 'PLAYING', score: 0, gold: 0, level: 1, xp: 0, xpNext: 100,
    wave: 1, waveTimer: 30, spawnRate: 160, lastTime: 0,
    upgrades: {}, artifacts: {}, spawnPool: ['square'], isRunning: true,
    // NEW: Wave spawning system
    currentWaveSet: 0,
    currentCrowdIndex: 0,
    crowdSpawning: false,
    crowdTimer: 0,
    crowdSpawnInterval: 8, // ms between each enemy in a crowd
    crowdWaitTime: 4000, // 4 seconds between crowd sets
};
let player;
let entities = { bullets: [], enemies: [], particles: [], drops: [] };
window.entities = entities; // Acesso global pelas classes
let spawnTimer = 0;
let animationId; // Para controle do loop

// --- FUNÇÕES GLOBAIS ---

async function startAudio() {
    await OrkaAudio.init();
}

window.addEventListener('click', startAudio, { once: true });

function init() {
    if (animationId) cancelAnimationFrame(animationId); // Evita loop duplicado

    // Reset
    game = {
        state: 'PLAYING', score: 0, gold: 0, level: 1, xp: 0, xpNext: 100,
        wave: 1, waveTimer: 30, spawnRate: 160, lastTime: 0,
        upgrades: JSON.parse(JSON.stringify(UPGRADES_DEF)), 
        artifacts: {}, spawnPool: ['square'], isRunning: true,
        currentWaveSet: 0,
        currentCrowdIndex: 0,
        crowdSpawning: false,
        crowdTimer: 0,
        crowdSpawnInterval: 8,
        crowdWaitTime: 4000,
    };

    window.game = game;
    
    // Inicializa upgrades
    for(let k in game.upgrades) {
        game.upgrades[k].level = 1; game.upgrades[k].currentVal = game.upgrades[k].val; game.upgrades[k].cost = game.upgrades[k].baseCost;
    }

    player = new Player();
    window.player = player; // Acesso global para colisões e lógica de inimigos
    entities = { bullets: [], enemies: [], particles: [], drops: [] };
    window.entities = entities;
    spawnTimer = 0;
    
    // UI Reset
    Object.values(ui.screens).forEach(s => s.classList.remove('visible'));
    ui.score.innerText = 0; ui.gold.innerText = 0; ui.wave.innerText = 1;
    ui.xpBar.style.width = '0%'; ui.hpBar.style.width = '100%'; ui.hpBar.style.backgroundColor='#0f0';
    
    updateShopUI();
    updateArtifactsUI();

    startWaveSpawning();
    loop(0);
}

let bgmSource = null;

async function startMusic() {
    // Garante que o contexto de áudio saiu do modo 'suspended'
    if (OrkaAudio.context && OrkaAudio.context.state === 'suspended') {
        await OrkaAudio.context.resume();
    }
    
    if (!game.currentMusic) {
        // Use a chave correta que está no seu AUDIOS_DEF (provavelmente 'bgm')
        OrkaAudio.playMusic('bgm', { volume: 0.5 }); 
    }
}

// // Tenta tocar música
// document.body.onclick = () => { 
//     startMusic(); 
//     document.body.onclick = null; 
// };

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
    return '<div style="color:#666; margin-top:10px;">...</div>';
    if (!rankData || rankData.length === 0) return '<div style="color:#666; margin-top:10px;">Sem registros...</div>';
    let html = '<div class="leaderboard-box"><div class="lb-header">TOP 5 JOGADORES</div>';
    rankData.forEach((r, i) => {
        html += `<div class="lb-row"><span>#${i+1} ${r.date}</span><span>W:${r.wave} PTS:${r.score}</span></div>`;
    });
    html += '</div>';
    return html;
}

// Atualize sua função toggleSettings existente
function toggleSettings() {
    const modal = ui.settingsModal;
    modal.classList.toggle('visible');

    if (modal.classList.contains('visible')) {
        // Pausa o jogo e ativa o som abafado
        game.state = 'PAUSED_SETTINGS';
        OrkaAudio.setEffect("muffled", "master");
    } else {
        // Retoma o jogo e volta o som ao normal (By-pass)
        game.state = 'PLAYING';
        OrkaAudio.setEffect("normal", "master");
    }
}

// --- SHOP & UPGRADES ---
export function updateShopUI() {
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
export function checkLevelUp() {
    if (game.xp >= game.xpNext) {
        game.xp = 0; game.level++; game.xpNext = Math.floor(game.xpNext * 1.3);
        ui.xpBar.style.width = '0%';
        game.state = 'PAUSED_LVL'; OrkaAudio.setEffect("muffled", "master"); OrkaAudio.playSFX('levelup');
        
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
    game.state = 'PLAYING'; OrkaAudio.setEffect("normal", "master");
}

// --- GAMEPLAY HELPERS ---
function nextWave() {
    game.wave++; 
    game.waveTimer = 30;
    
    ui.wave.innerText = game.wave;
    let newEnemyKey = null;

    // Novo inimigo só aparece após ondas 2, 5 e 8 (ou seja, nas ondas 3, 6 e 9)
    const waveShowsNewEnemy = [3, 6, 9, 12, 15];
    
    if (waveShowsNewEnemy.includes(game.wave)) {
        let availableEnemies = [];
       //NÃO incluir inimigos que já foram sorteados 
        
        for (let key in ENEMIES_DEF) {
            const enemyDef = ENEMIES_DEF[key];
            
            // Inimigo deve ter minWave igual ou menor à onda atual
            if (enemyDef.minWave <= game.wave && !game.spawnPool.includes(key)) {
                // Se o inimigo tem childEnemy, verificar se já foi descoberto
                if (enemyDef.childEnemy) {
                    if (game.spawnPool.includes(enemyDef.childEnemy)) {
                        availableEnemies.push(key);
                    }
                } else {
                    // Se não tem childEnemy, pode aparecer normalmente
                    availableEnemies.push(key);
                }
            }
        }

        if (availableEnemies.length > 0) {
            newEnemyKey = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
        }
    }

    // Se tiver um novo inimigo, pausa o jogo e mostra a tela de introdução
    if (newEnemyKey) {
        game.state = 'PAUSED_ENEMY'; 
        OrkaAudio.setEffect("muffled", "master");
        OrkaAudio.playSFX('newenemy');

        const def = ENEMIES_DEF[newEnemyKey];
        
        ui.newEnemy.name.innerText = def.name.toUpperCase(); 
        ui.newEnemy.name.style.color = def.color;
        ui.newEnemy.desc.innerText = def.desc;

        ui.newEnemy.visual.innerHTML = `<img src="./assets/${def.name}.png" 
            style="width:100%; height:100%; object-fit:contain;" 
            onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIlMjNmNDQ0NCIvPjwvc3ZnPg=='">`;
        
        ui.newEnemy.visual.style.backgroundColor = 'transparent';
        ui.newEnemy.visual.style.clipPath = 'none';
        ui.newEnemy.visual.style.borderRadius = '0';

        game.spawnPool.push(newEnemyKey);
        ui.screens.newEnemy.classList.add('visible');
    } else {
        showNotification(`ONDA ${game.wave}`, '#ff0055');
    }
    
    // Start spawning crowds for the new wave
    startWaveSpawning();
    saveScoreLocal();
}

window.resumeGame = function() {
    ui.screens.newEnemy.classList.remove('visible');
    game.state = 'PLAYING'; OrkaAudio.setEffect("normal", "master");
}

window.restartGame = function() {
    OrkaAudio.setEffect("normal", "master");
    OrkaAudio.setVolume('music', OrkaAudio.volumes.music);
    init();
};


export function endGame() {
    //Ranking removido temporariamente.

    game.isRunning = false; game.state = 'GAMEOVER'; OrkaAudio.setEffect("muffled", "master"); OrkaAudio.playSFX('gameover');
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
    OrkaAudio.fadeAll('music', 0, 1); // Abaixa a música até 0 suavemente em 1s
}

// --- NEW: Wave Spawning System ---
const waveMap = {
    1: [1],
    2: [1, 1],
    3: [2],
    4: [1, 2],
    5: [2, 1],
    6: [2, 2],
    7: [2, 2, 1],
    8: [1, 3, 2],
    9: [3, 2, 2],
    10: [3, 3, 2],
    11: [3, 3, 3]
};

function startWaveSpawning() {
    game.currentWaveSet = 0;
    game.currentCrowdIndex = 0;
    game.crowdSpawning = false;
    game.crowdTimer = 0;
    spawnNextCrowd();
}

function spawnNextCrowd() {
    const waveSets = waveMap[game.wave] || [4,4,4,4];
    
    // Verifica se terminamos todos os sets da wave atual
    if (game.currentCrowdIndex >= waveSets.length) return;
    
    const numberOfCrowdsInSet = waveSets[game.currentCrowdIndex];
    game.crowdSpawning = true;
    game.crowdTimer = 0;

    // Criamos uma fila de sub-multidões para este set
    game.currentSetQueue = [];

    for (let i = 0; i < numberOfCrowdsInSet; i++) {
        const selectedEnemy = selectRandomEnemy();
        const enemyDef = ENEMIES_DEF[selectedEnemy];
        const crowdVolume = enemyDef.crowdVol || 1; // Multiplicador do inimigo
        const crowdSize = 1; // Deixei fixo para 1, mas pode ser ajustado conforme necessário
        
        const crowdCenter = getRandomSpawnPoint();

        game.currentSetQueue.push({
            enemyType: selectedEnemy,
            count: Math.floor(crowdSize * crowdVolume),
            spawned: 0,
            centerX: crowdCenter.x,
            centerY: crowdCenter.y,
            spreadRadius: 100 + (crowdVolume * 20) // Inimigos em massa espalham mais
        });
    }
    
    game.currentCrowdIndex++;
}

function selectRandomEnemy() {
    // Select from available enemies in spawnPool
    return game.spawnPool[Math.floor(Math.random() * game.spawnPool.length)];
}

function getRandomSpawnPoint() {
    // Spawn from edges (top, bottom, left, right)
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    
    switch(edge) {
        case 0: // Top
            x = Math.random() * canvas.width;
            y = -50;
            break;
        case 1: // Bottom
            x = Math.random() * canvas.width;
            y = canvas.height + 50;
            break;
        case 2: // Left
            x = -50;
            y = Math.random() * canvas.height;
            break;
        case 3: // Right
            x = canvas.width + 50;
            y = Math.random() * canvas.height;
            break;
    }
    
    return { x, y };
}

function updateCrowdSpawning() {
    if (!game.crowdSpawning || !game.currentSetQueue) return;
    
    game.crowdTimer += 16; 
    let allSpawnedInThisSet = true;

    game.currentSetQueue.forEach(crowd => {
        const shouldSpawn = Math.floor(game.crowdTimer / game.crowdSpawnInterval) > crowd.spawned;
        
        if (shouldSpawn && crowd.spawned < crowd.count) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * crowd.spreadRadius;
            const spawnX = crowd.centerX + Math.cos(angle) * distance;
            const spawnY = crowd.centerY + Math.sin(angle) * distance;
            
            const enemy = new Enemy(game.wave, crowd.enemyType, spawnX, spawnY);
            entities.enemies.push(enemy);
            crowd.spawned++;
        }

        if (crowd.spawned < crowd.count) allSpawnedInThisSet = false;
    });
    
    // Se todos os inimigos do SET ATUAL (ex: o primeiro '1' do [1,1]) já nasceram 
    if (allSpawnedInThisSet) {
        game.crowdSpawning = false; // Para o update temporariamente
        
        const waveSets = waveMap[game.wave] || [1];
        
        // Verifica se ainda existe um próximo set no array (ex: o segundo '1')
        if (game.currentCrowdIndex < waveSets.length) {
            // Agenda o próximo spawn para daqui a X segundos
            // Usei 5000ms (5s) como você mencionou, ou o seu game.crowdWaitTime
            setTimeout(() => {
                spawnNextCrowd();
            }, game.crowdWaitTime); 
        } else {
            // Se não houver mais sets, apenas aguarda o jogador derrotar os inimigos restantes
            // E então, quando o jogador derrotar o último inimigo, a próxima onda começará normalmente pelo timer ou pela lógica de waveTimer
        }
    }
}

// --- LOOP ---
function loop(now) {
    animationId = requestAnimationFrame(loop);
    if (game.state !== 'PLAYING') return;

    if (now - game.lastTime >= 1000) {
        game.waveTimer--; ui.timer.innerText = game.waveTimer;
        //se o número de inimigos for 0 OU o timer acabar, começa a próxima onda
        if (game.waveTimer <= 0 || entities.enemies.length === 0) nextWave();
        game.lastTime = now;
    }

    ctx.fillStyle = 'rgba(21, 21, 21, 0.3)'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // NEW: Update crowd spawning instead of random spawnRate
    updateCrowdSpawning();

    player.update(); player.draw();

    entities.enemies.forEach((e, i) => {
        e.update(); e.draw();
        // Colisão Player
        if (Math.hypot(player.x-e.x, player.y-e.y) < player.size + e.size/2) {
            if (game.artifacts.midas) entities.drops.push(new Drop(e.x, e.y, 'gold'));
            //player tomará dano igual ao atributo 'dmg' do inimigo:
            player.takeDamage(e.dmg);
            //OrkaAudio.playSFX('playerhit');
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
                    OrkaAudio.playSFX('explosion');
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
    // Initialize DOM first
    initializeDOM();

    // Carrega todos os áudios antes de começar
    //await OrkaAudio.loadAll(SOUND_FILES);

    // Listeners de UI
    document.getElementById('settings-btn').addEventListener('click', toggleSettings);
    document.getElementById('btn-back-game').addEventListener('click', toggleSettings);
    document.getElementById('btn-clear-rank').addEventListener('click', clearData);
    document.getElementById('btn-continue').addEventListener('click', resumeGame);
    
    // Referências dos Sliders
    const sliders = {
        master: document.querySelector('.setting-row:nth-child(2) input'),
        music: document.querySelector('.setting-row:nth-child(3) input'),
        sfx: document.querySelector('.setting-row:nth-child(4) input')
    };

    // Listener para Volume Geral
    sliders.master.addEventListener('input', (e) => {
        OrkaAudio.setVolume('master', e.target.value);
    });

    // Listener para Música
    sliders.music.addEventListener('input', (e) => {
        OrkaAudio.setVolume('music', e.target.value);
    });

    // Listener para Efeitos (SFX)
    sliders.sfx.addEventListener('input', (e) => {
        OrkaAudio.setVolume('sfx', e.target.value);
    });

    const handleFirstInteraction = async () => {
        await startAudio(); // Inicializa o engine
        startMusic();       // Toca a música
        window.removeEventListener('click', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);

    // Inicia o jogo
    init();
});