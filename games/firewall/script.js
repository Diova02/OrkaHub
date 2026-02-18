//incluir o sistema de sessões simples da OrkaCloud.js
import { OrkaCloud } from  '../../core/scripts/orka-cloud.js';
import { OrkaFX, OrkaStorage, OrkaUI, OrkaMath, Utils } from '../../core/scripts/orka-lib.js';
import { UPGRADES_DEF, ARTIFACTS_DEF, ENEMIES_DEF, AUDIOS_DEF, waveMap, SKINS_CONFIG, userInventory } from './data.js';
import { Drop, Bullet, Enemy, Player } from './classes.js';
import { OrkaAudio } from '../../orkaAudio/dist/orka-audio.js';

// --- 2. CONFIGURAÇÕES GERAIS ---
let canvas, ctx, ui;

const player = new Player();
window.player = player;

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
            gameOver: document.getElementById('game-over-screen'),
            mainMenu: document.getElementById('main-menu-screen')
        },
        newEnemy: {
            visual: document.getElementById('new-enemy-visual'),
            name: document.getElementById('new-enemy-name'),
            desc: document.getElementById('new-enemy-desc')
        }
    };
    window.ui = ui;

    //fazer com que os inimigos sempre fiquem na distância correta do centro da tela, quando a tela for redimensionada, para isso, precisamos atualizar a posição dos inimigos com base no novo centro da tela. Podemos fazer isso dentro do evento de resize, iterando sobre os inimigos e ajustando suas posições relativas ao novo centro.
    function resize() { 
        canvas.width = window.innerWidth; canvas.height = window.innerHeight; 
        // Atualiza posições dos inimigos com base no novo centro
        entities.enemies.forEach(e => {
            //a posição do inimigo é relativa ao centro da tela, cada inimigo deve manter a mesma distância do centro E o mesmo ângulo em relação a ele, então podemos calcular a nova posição usando a fórmula: novaX = centroX + (velhaX - centroX) * (novaDistância / velhaDistância) e novaY = centroY + (velhaY - centroY) * (novaDistância / velhaDistância). Mas como queremos manter a mesma distância, podemos simplificar para novaX = centroX + (velhaX - centroX) e novaY = centroY + (velhaY - centroY), o que é equivalente a dizer que a posição do inimigo é relativa ao centro da tela, então podemos simplesmente recalcular a posição do inimigo com base no novo centro da tela, usando a fórmula: novaX = canvas.width / 2 + (velhaX - canvas.width / 2) e novaY = canvas.height / 2 + (velhaY - canvas.height / 2).
            e.x = canvas.width / 2 + (e.x - canvas.width / 2);
            e.y = canvas.height / 2 + (e.y - canvas.height / 2);
        });
    }
    window.addEventListener('resize', resize);
    resize();

    startAudio();
    await OrkaAudio.loadAll(AUDIOS_DEF);
    startMusic(); 
}

// --- GAME STATE (Updated) ---
let game = {
    state: 'MENU', score: 0, gold: 0, level: 1, xp: 0, xpNext: 100,
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
        OrkaAudio.playMusic('bgm-menu', { volume: 0.8 }); 
        OrkaAudio.setEffect("muffled", "music");
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

// function clearData() {
//     OrkaUI.confirm("Tem certeza, frangote?", "Isso apagará seu recorde para sempre.", () => {
//         localStorage.removeItem('firewall_rank');
//         OrkaFX.toast("Ranking resetado!", "info");
//         toggleSettings();
//     });
// }

function getLeaderboardHTML(rankData) {
    return '<div style="color:#666; margin-top:10px;">...</div>'; //desativado por enquanto
    // if (!rankData || rankData.length === 0) return '<div style="color:#666; margin-top:10px;">Sem registros...</div>';
    // let html = '<div class="leaderboard-box"><div class="lb-header">TOP 5 JOGADORES</div>';
    // rankData.forEach((r, i) => {
    //     html += `<div class="lb-row"><span>#${i+1} ${r.date}</span><span>W:${r.wave} PTS:${r.score}</span></div>`;
    // });
    // html += '</div>';
    // return html;
}

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
        
        // Estilo novo: Valor real acima, Emoji/Nível no centro, Preço embaixo
        btn.innerHTML = `
            <div class="btn-stat-val">${upg.currentVal.toFixed(1)}</div>
            <div class="btn-main-info">
                <span class="btn-icon">${upg.icon}</span>
                <span class="btn-big-lvl">${upg.level}</span>
            </div>
            <div class="btn-cost-tag">$${upg.cost}</div>
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
        
        // escolha de classe pausada por enquanto.
        // ESPECIAL LEVEL 5: ESCOLHA DE CLASSE
        // if (game.level === 5) {
        //     generateClassCards();
        // } else {
        generateCards();
        //}
        
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

        ui.newEnemy.visual.innerHTML = `<img src="../../assets/imagens/firewall/${def.name}.png" 
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
        <button class="continue-btn" onclick="goToMenu()" style="margin-top:20px">Voltar ao Menu Principal</button>
    `;
    goScreen.classList.add('visible');
    OrkaAudio.fadeAll('music', 0, 1); // Abaixa a música até 0 suavemente em 1s
}

function startWaveSpawning() {
    game.currentWaveSet = 0;
    game.currentCrowdIndex = 0;
    game.crowdSpawning = false;
    game.crowdTimer = 0;
    spawnNextCrowd();
}

function spawnNextCrowd() {
    //por algum motivo, quando passa do n de ondas máximos do waveMap, o array de sets gera só 1 set de 4 multidões, ao invés de repetir as 4 multidões 4 vezes como esperado
    
    const waveSets = waveMap[game.wave] || [game.wave - 8, game.wave - 8, game.wave - 8, game.wave - 8].map(w => Math.max(1, w)); // fallback para ondas acima do definido, usando a fórmula (onda - 8) para manter a dificuldade crescente
    
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
    // Definimos uma distância fixa que é garantidamente fora da tela 
    // independente do dispositivo (ex: 1000 pixels do centro)
    const spawnDistance = 500; 
    const angle = Math.random() * Math.PI * 2; // Ângulo aleatório de 0 a 360°

    return {
        x: player.x + Math.cos(angle) * spawnDistance,
        y: player.y + Math.sin(angle) * spawnDistance
    };
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
    
    // Fundo sempre limpo
    ctx.fillStyle = 'rgb(4, 4, 17)'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (game.state === 'MENU') {
        renderMenuScene();
        return; 
    }

    if (game.state !== 'PLAYING') return;

    if (now - game.lastTime >= 1000) {
        game.waveTimer--; ui.timer.innerText = game.waveTimer;
        //se o número de inimigos for 0 OU o timer acabar, começa a próxima onda
        if (game.waveTimer <= 0 || entities.enemies.length === 0) nextWave();
        game.lastTime = now;
    }

    // NEW: Update crowd spawning instead of random spawnRate
    updateCrowdSpawning();

    player.update(); player.draw();

    entities.enemies.forEach((e, i) => {
        e.update(); e.draw();
        // Colisão Player
        if (Math.hypot(player.x-e.x, player.y-e.y) < player.size/2.5 + e.size/2) {
            if (game.artifacts.midas) entities.drops.push(new Drop(e.x, e.y, 'gold'));
            //player tomará dano igual ao atributo 'dmg' do inimigo:
            //"e" não está definido dentro desse trecho!
            e = entities.enemies[i]; // Re-define "e" para garantir que temos a referência correta após possíveis mutações
            //o que é "i"? É o índice do inimigo atual no loop, necessário para acessar o inimigo correto na lista de entidades após possíveis mutações (como morte ou remoção).
            console.log(`Player hit by ${e.name} for ${e.dmg} damage!`);
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
                    const mult = .8 + (dist * (ARTIFACTS_DEF.sniper.mult * game.artifacts.sniper));
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

function renderMenuScene() {
    // Limpa o fundo com a cor do jogo
    ctx.fillStyle = 'rgba(21, 21, 21, 1)'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!player) return;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.angle += 0.005; // Rotação lenta

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    
    // Tamanho unificado (120 ou o dobro do player.size para destaque)
    const displaySize = player.size * 10; 

    if (player.sprite.complete) {
        ctx.drawImage(player.sprite, -displaySize/2, -displaySize/2, displaySize, displaySize);
    }
    ctx.restore();
}

// Funções de Transição
window.goToMenu = function() {
    game.state = 'MENU';
    // 1. Interrompe o loop de animação atual
    if (animationId) cancelAnimationFrame(animationId);
    game.isRunning = false;

    ui.screens.gameOver.classList.remove('visible');
    ui.screens.mainMenu.classList.add('visible');
    // Esconder UI de gameplay
    document.getElementById('ui-layer').style.display = 'none';
    document.getElementById('hp-container').style.display = 'none';

     // 3. Esvazia as entidades para que não fiquem processando no fundo
    entities.enemies = [];
    entities.bullets = [];
    entities.drops = [];
    entities.particles = [];
    
    OrkaAudio.switchMusic('bgm-menu'); // Troca para música de menu
    OrkaAudio.fadeAll('music', 0.8, 1); // Aumenta o volume da música de menu suavemente
};

function startGameFromMenu() {
    ui.screens.mainMenu.classList.remove('visible');
    
    // Feedback visual de início
    ui.dmgOverlay.style.opacity = 1;
    OrkaAudio.playSFX('levelup'); // Som de confirmação
    OrkaAudio.setEffect("normal", "master");
    OrkaAudio.setVolume('music', OrkaAudio.volumes.music);

    
    setTimeout(() => {
        ui.dmgOverlay.style.opacity = 0;
        // Exibir UI de gameplay
        document.getElementById('ui-layer').style.display = 'flex';
        document.getElementById('hp-container').style.display = 'block';
        
        init(); // Reinicia os atributos da partida
        game.state = 'PLAYING';
        OrkaAudio.switchMusic('bgm'); // Troca para música de ação
        OrkaAudio.setEffect("normal", "music");
    }, 200);
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
    //document.getElementById('btn-clear-rank').addEventListener('click', clearData);
    //btn-clear-rank vai ativar as funções "goToMenu" e "toggleSettings", para fechar o modal de configurações.
    document.getElementById('btn-clear-rank').addEventListener('click', function() {
        goToMenu();
        toggleSettings();
    });
    //document.getElementById('btn-back-menu').addEventListener('click', goToMenu);
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

    //updateMenuCannon();
    
    document.getElementById('btn-custom-skin').onclick = openSkinModal;

    // Inicia o jogo
    //init();
});

//quando o jogador sair da aba ou minimizar, abre o menu de pausa (configurações)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'PLAYING') {
        toggleSettings();
    }
});

document.getElementById('btn-play').addEventListener('click', startGameFromMenu);

let menuCannonAngle = 0;
const menuCannonCanvas = document.getElementById('menu-cannon-canvas');
const menuCannonCtx = menuCannonCanvas.getContext('2d');

function updateMenuCannon() {
    if (game.state !== 'MENU') return;

    menuCannonCtx.clearRect(0, 0, menuCannonCanvas.width, menuCannonCanvas.height);
    menuCannonAngle += 0.01;

    menuCannonCtx.save();
    menuCannonCtx.translate(75, 75); // Metade do tamanho do canvas (150/2)
    menuCannonCtx.rotate(menuCannonAngle);
    
    if (player.sprite.complete) {
        menuCannonCtx.drawImage(player.sprite, -30, -30, 60, 60);
    }
    menuCannonCtx.restore();

    requestAnimationFrame(updateMenuCannon);
}

function openSkinModal() {
    const modal = document.getElementById('skin-modal');
    const list = document.getElementById('skin-list');
    modal.classList.add('visible');
    
    list.innerHTML = '';

    for (const [id, info] of Object.entries(SKINS_CONFIG)) {
        const isOwned = userInventory.ownedSkins.includes(id);
        const isSelected = userInventory.currentSkin === id;
        
        const div = document.createElement('div');
        div.className = `skin-item ${isOwned ? '' : 'locked'} ${isSelected ? 'selected' : ''}`;
        
        div.innerHTML = `
            <img src="${info.path}" style="width: 60px; height: 60px;">
            <p style="margin: 5px 0 0; color: #fff;">${info.name}</p>
            ${!isOwned ? `<p style="color: #ffd700; font-size: 1.2rem;">🍰 ${info.price}</p>` : ''}
        `;

        if (isOwned) {
            div.onclick = () => selectSkin(id);
        } else {
            div.onclick = () => {
                OrkaAudio.playSFX('error'); // Som de erro se quiser adicionar
                alert("Você precisa comprar esta skin com fatias de bolo!");
            };
        }
        
        list.appendChild(div);
    }
}

function selectSkin(skinId) {
    userInventory.currentSkin = skinId;
    player.sprite.src = SKINS_CONFIG[skinId].path;
    
    // Feedback visual imediato no menu
    updateMenuCannon(); 
    
    closeSkinModal();
}

function closeSkinModal() {
    document.getElementById('skin-modal').classList.remove('visible');
    
    // Retoma o áudio/estado se estava pausado
    if (game.state === 'PAUSED_SKIN') {
        game.state = 'PLAYING';
        OrkaAudio.setEffect("normal", "master");
    }
}

// Lembre-se de registrar as funções no window para o HTML acessar
window.openSkinModal = openSkinModal;
window.selectSkin = selectSkin;
window.closeSkinModal = closeSkinModal;