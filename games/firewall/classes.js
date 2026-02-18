import { ENEMIES_DEF, ARTIFACTS_DEF } from "./data.js";
import { OrkaAudio } from "../../orkaAudio/dist/orka-audio.js";
import { checkLevelUp, updateShopUI, endGame } from "./script.js";

// --- CLASSES ---
export class Player {
    constructor() {
        // Inicializa com 0 ou valores padrão caso o canvas não esteja pronto
        this.x = window.canvas ? window.canvas.width / 2 : 0; 
        this.y = window.canvas ? window.canvas.height / 2 : 0;
        this.size = 60; 
        this.color = '#00ffcc';
        this.sprite = new Image();
        this.sprite.src = '../../assets/imagens/firewall/player.png';
        
        // Proteção contra undefined no objeto game
        const upgrades = window.game ? window.game.upgrades : null;
        this.maxHp = upgrades ? upgrades.hp.currentVal : 100; 
        this.hp = this.maxHp;
        this.range = upgrades ? upgrades.range.currentVal : 200;
        this.damage = upgrades ? upgrades.damage.currentVal : 10;
        this.fireRate = upgrades ? upgrades.speed.currentVal : 50;
        
        this.angle = 0; 
        this.cooldown = 0; 
        this.regenTimer = 0;
        this.shieldActive = false; 
        this.shieldTimer = 0; 
        this.poisonTimer = 0;
        this.firstShieldActivated = false;
        this.currentSkin = 'player';
    }

    update() {
        if (window.game.state === 'MENU') return; // Bloqueia lógica de combate no menu
    
        this.x = window.canvas.width/2; 
        this.y = window.canvas.height/2;

        // Regen
        if (Date.now() - this.regenTimer > 3000 && this.hp < this.maxHp) {
            this.hp += 0.05; this.updateHpUI();
        }

        // Power: SHIELD
        if (window.game.artifacts.shield) {
            const def = ARTIFACTS_DEF.shield;
            const cd = Math.max(600, def.cooldown - (window.game.artifacts.shield * 200));
            if (this.firstShieldActivated) {cd = 1;}
            if (!this.shieldActive) {
                this.shieldTimer++;
                if (this.shieldTimer >= cd) { this.shieldActive = true; showNotification("ESCUDO PRONTO", "#0072ff"); }
            }
        }

        // Power: ZAPP (Raio)
        if (window.game.artifacts.zapp) {
            if (!this.zappTimer) this.zappTimer = 0;
            this.zappTimer++;
            const cd = ARTIFACTS_DEF.zapp.cooldown - (window.game.artifacts.zapp * 20);
            if (this.zappTimer >= cd && window.entities.enemies.length > 0) {
                this.zappTimer = 0;
                // Pega inimigo aleatório no range
                const targets = window.entities.enemies.filter(e => Math.hypot(e.x-this.x, e.y-this.y) <= this.range);
                if (targets.length > 0) {
                    const target = targets[Math.floor(Math.random() * targets.length)];
                    target.takeDamage(50 + (window.game.artifacts.zapp * 20)); // Dano alto
                    // Desenha raio visual (simples linha amarela)
                    const ctx = window.ctx;
                    ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(target.x, target.y); ctx.stroke();
                    OrkaAudio.playSFX('shoot', { volume: 0.7 });
                }
            }
        }

        // Power: POISON
        if (window.game.artifacts.poison) {
            this.poisonTimer++;
            if (this.poisonTimer > 20) {
                this.poisonTimer = 0;
                const radius = this.range * ARTIFACTS_DEF.poison.rangePct;
                // Dano baseado no nível do artefato, aplicado a cada inimigo dentro do raio
                const dmg = ARTIFACTS_DEF.poison.baseDmg * window.game.artifacts.poison * 5;
                // Deixar inimigos dentro do raio de veneno mais lentos também

                window.entities.enemies.forEach(e => {
                    if (Math.hypot(e.x - this.x, e.y - this.y) < radius) {
                        e.takeDamage(dmg); e.speed = e.baseSpeed * 0.8; window.entities.particles.push(new Particle(e.x, e.y, '#0f0'));
                    }
                });
            }
        }

        // Shoot Logic
        let nearest = null; let minDist = Infinity;
        window.entities.enemies.forEach(e => {
            const d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d < minDist && d <= this.range) { minDist = d; nearest = e; }
        });

        if (nearest) {
            this.angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
            if (this.cooldown <= 0) {
                window.entities.bullets.push(new Bullet(this.x, this.y, this.angle, this.damage));
                this.cooldown = this.fireRate;
                OrkaAudio.playSFX('shoot');
            }
        }
        if (this.cooldown > 0) this.cooldown--;
    }
    takeDamage(amount) {
        if (this.shieldActive) {
            this.shieldActive = false; this.shieldTimer = 0;
            for(let i=0; i<10; i++) window.entities.particles.push(new Particle(this.x, this.y, '#0072ff'));
            return;
        }
        this.hp -= amount; this.regenTimer = Date.now();
        //aplicar a classe "glitch" no sprite do player para indicar dano sofrido
        this.sprite.classList.add('damage-glitch');
        setTimeout(() => this.sprite.classList.remove('damage-glitch'), 500);
        window.ui.dmgOverlay.style.opacity = 0.5; setTimeout(() => window.ui.dmgOverlay.style.opacity = 0, 100);
        this.updateHpUI();
        OrkaAudio.playSFX('hit');

        if (this.hp <= 0) endGame();
    }

    updateHpUI() {
        const pct = (this.hp / this.maxHp) * 100;
        window.ui.hpBar.style.width = Math.max(0, pct) + '%';
        window.ui.hpBar.style.backgroundColor = pct < 30 ? '#f00' : '#0f0';
    }

    draw() {
        //desenhar sprite ao invés do quadrado, centralizado na posição do player
        const ctx = window.ctx;
        ctx.save(); ctx.translate(this.x, this.y); 
        if (window.game.artifacts.poison) {
            ctx.beginPath(); ctx.arc(0, 0, this.range * ARTIFACTS_DEF.poison.rangePct, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)'; ctx.fill();
        }
        ctx.rotate(this.angle);
        //if (this.spriteLoaded)
        ctx.drawImage(this.sprite, -this.size/2, -this.size/2, this.size, this.size);
        //como centralizar o eixo de rotação no meio do sprite, considerando que o sprite tem 28x28 pixels?

        //else {
        //    ctx.fillStyle = '#fff'; ctx.fillRect(-14, -14, 28, 28);
        //}
        //ctx.fillStyle = '#fff'; ctx.fillRect(5, -4, 20, 8);
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

export class Enemy {
    constructor(wave, enemyType = null, spawnX = null, spawnY = null) {
        const key = enemyType || game.spawnPool[Math.floor(Math.random() * game.spawnPool.length)];
        const def = ENEMIES_DEF[key];

        // --- LÓGICA DE ELITE ---
        this.isElite = Math.random() < (def.eliteChance || 0);
        const eliteMult = this.isElite ? 1.5 : 1;
        const sizeMult = this.isElite ? 1.25 : 1;
        const dmgMult = this.isElite ? 1.5 : 1;

        // Atributos Base (aplicando multiplicadores se for elite)
        this.key = key;
        this.name = def.name;
        this.size = def.size * sizeMult;
        this.speed = def.speed;
        this.baseSpeed = def.speed;
        this.goldChance = def.goldChance * eliteMult; // 1.5x mais chance de ouro
        this.color = def.color;
        this.dmg = def.dmg * dmgMult; // 1.5x mais dano
        
        // Vida escalável
        this.maxHp = ((5 + (wave * 3)) * (def.hpMult || 1)) * eliteMult; // 1.5x de HP
        this.hp = this.maxHp;

        // Estados e Timers
        this.freezeTimer = 0;
        this.hitTimer = 0;
        this.specialTimer = 0;
        this.angle = 0;

        // Carregamento do Sprite
        this.loadSprite();

        // Força o uso das coordenadas calculadas pela função centralizada
        this.x = spawnX;
        this.y = spawnY;
        
        // Se por algum motivo vier nulo (fallback de segurança)
        if (this.x === null || this.y === null) {
            const angle = Math.random() * Math.PI * 2;
            this.x = window.player.x + Math.cos(angle) * 1000;
            this.y = window.player.y + Math.sin(angle) * 1000;
        }

        OrkaAudio.playSFX('glitch', { volume: 0.5 });
        this.spawning = true;
        this.spawnTimer = 10;
    }

    loadSprite() {
        const candidates = [
            `../../assets/imagens/firewall/${this.name}.png`,
            `./assets/${this.name}.png`,
            `../../assets/icons/${this.name}.png`,
            `../../assets/imagens/${this.name}.png`,
            `../../assets/imagens/${this.name.toLowerCase()}.png`
        ];

        if (!ENEMY_SPRITES[this.name]) {
            // marca como carregando para evitar reentrância
            ENEMY_SPRITES[this.name] = "LOADING";

            const tryNext = (idx) => {
                if (idx >= candidates.length) {
                    console.warn(`⚠️ Sprite não encontrado (tente adicionar o arquivo em games/firewall/assets): ${this.name}`);
                    ENEMY_SPRITES[this.name] = "FAILED";
                    return;
                }

                const path = candidates[idx];
                const img = new Image();
                img.onload = () => { ENEMY_SPRITES[this.name] = img; };
                img.onerror = () => { tryNext(idx + 1); };
                img.src = path;
            };

            tryNext(0);
        }
    }

    draw() {
        const ctx = window.ctx;
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.isElite && !this.spawning) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 4;
            // Desenha um círculo ou retângulo de aura dependendo do feedback que preferir
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 1.2, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (this.spawning) {
            // Efeito Glitch: Desenha pedaços do sprite ou quadrados em posições levemente erradas
            for (let i = 0; i < 3; i++) {
                const shiftX = (Math.random() - 0.5) * 20;
                const shiftY = (Math.random() - 0.5) * 20;
                ctx.globalAlpha = Math.random();
                ctx.fillStyle = Math.random() > 0.5 ? this.color : '#fff';
                ctx.fillRect(-this.size/2 + shiftX, -this.size/2 + shiftY, this.size, this.size);
            }
        } else {

        ctx.rotate(this.angle + Math.PI/2);

        if (this.hitTimer > 0) ctx.filter = 'brightness(3) grayscale(1)';

        const sprite = ENEMY_SPRITES[this.name];
        
        // SÓ desenha se for um objeto de imagem REAL e se estiver pronto
        // Se for "FAILED", "LOADING" ou null, ele pula direto pro fallback
        if (sprite instanceof HTMLImageElement && sprite.complete && sprite.naturalWidth > 0) {
            try {
                ctx.drawImage(sprite, -this.size/2, -this.size/2, this.size, this.size);
            } catch (e) {
                // Falha silenciosa: se ainda assim der erro, desenha o quadrado
                this.drawFallback();
            }
        } else {
            this.drawFallback();
        }
    }

        ctx.restore();
        if (this.hp < this.maxHp) this.drawHealthBar();
    }

    drawFallback() {
        const ctx = window.ctx;
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        // Uma bordinha preta pra não ficar feio no Hub
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);
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
        if (this.spawning) {
            this.spawnTimer--;
            if (this.spawnTimer <= 0) this.spawning = false;
            return; // Sai da função para não mover nem girar
        }

        if (this.hitTimer > 0) this.hitTimer--;
        if (this.freezeTimer > 0) { this.freezeTimer--; return; }

        const def = ENEMIES_DEF[this.key];

        // Lógica de Comportamento Especial
        if (def.behavior === 'healer') {
            // desenhar uma aura verde ao redor do inimigo curandeiro para indicar seu poder de cura
            const ctx = window.ctx;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.beginPath();
            ctx.arc(0, 0, def.healRange, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.08)';
            ctx.fill();
            ctx.restore();
            
            this.specialTimer++;
            if (this.specialTimer > def.healCooldown) {
                this.specialTimer = 0;
                this.executeHeal(def.healRange, def.healAmount);
            }
        }

        if (def.behavior === 'dash') {
            // Fazer com que o inimigo triplique a velocidade ao entrar no range do player.
            const player = window.player;
            this.range = player.range; // Garantir que o inimigo use o range atualizado do player
            const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
            if (distToPlayer < this.range) {
                this.speed = def.dashSpeed;
            }
        }

        // Movimento e Rotação em direção ao player
        const player = window.player;
        if (!player) return;
        this.angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    }

    executeHeal(range, amount) {
        window.entities.enemies.forEach(e => {
            if (e !== this && Math.hypot(e.x - this.x, e.y - this.y) < range) {
                e.hp = Math.min(e.maxHp, e.hp + amount);
                window.entities.particles.push(new Particle(e.x, e.y, '#00ff00'));
            }
        });
    }

    takeDamage(amt) {
        this.hp -= amt;
        this.hitTimer = 5; // Frame de feedback visual (piscar branco)
        if (this.hp <= 0) this.die();
        //se tiver o atributo 'dash', faz com que o inimigo se teletransporte para a borda do range do player ao tomar dano, apenas no primeiro hit sofrido
            if (ENEMIES_DEF[this.key].behavior === 'dash' && this.specialTimer === 0) {
                this.specialTimer = 1; // Ativa o teletransporte
                // definir "range" para evitar bugs
                this.range = window.player.range || 150;
                const player = window.player;
                const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
                this.x = player.x - Math.cos(angleToPlayer) * this.range; // Teletransporta para a borda do range
                this.y = player.y - Math.sin(angleToPlayer) * this.range; 
            }
    }

    die() {
        // Vampirismo (Regra de gameplay baseada em artefatos)
        if (window.game.artifacts.vampire) {
            const healAmt = ARTIFACTS_DEF.vampire.heal + (window.game.artifacts.vampire * 2);
            const player = window.player;
            player.hp = Math.min(player.maxHp, player.hp + healAmt);
            player.updateHpUI();
            window.entities.particles.push(new Particle(player.x, player.y, '#ff0000'));
        }

        // Multiplicador de XP para Elites
        const xpAmount = this.isElite ? 22 : 15; // 1.5x aproximado de 15
        
        // --- PREPARAÇÃO PARA O SISTEMA DE TECH ---
        const techChance = this.isElite ? 0.3 : 0.05; // Elites dropam muito mais
        if (Math.random() < techChance) {
             // window.entities.drops.push(new Drop(this.x, this.y, 'tech')); 
             console.log("Dropou TECH (Lógica futura)");
        }

        // Efeitos visuais (mais partículas se for elite)
        const particleCount = this.isElite ? 20 : 8;
        for(let i=0; i < particleCount; i++) window.entities.particles.push(new Particle(this.x, this.y, this.isElite ? '#ff0000' : this.color));

        OrkaAudio.playSFX('explosion');

        // Drops de Ouro e XP
        if (Math.random() < this.goldChance) window.entities.drops.push(new Drop(this.x, this.y, 'gold'));
        
        // Criamos o drop de XP passando o valor customizado
        const xpDrop = new Drop(this.x, this.y, 'xp');
        xpDrop.value = xpAmount; // Atribuindo o valor ao drop
        window.entities.drops.push(xpDrop);

        window.game.score++;
        window.ui.score.innerText = window.game.score;
    }

    drawHealthBar() {
        const ctx = window.ctx;
        const pct = this.hp / this.maxHp;
        const barWidth = this.size;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - barWidth/2, this.y - this.size/2 - 10, barWidth, 4);
        ctx.fillStyle = pct > 0.3 ? '#0f0' : '#f00';
        ctx.fillRect(this.x - barWidth/2, this.y - this.size/2 - 10, barWidth * pct, 4);
    }
}

export class Bullet {
    constructor(x,y,a,dmg) { 
        this.x=x; this.y=y; this.startX=x; this.startY=y; // Salva origem para Sniper
        this.vx=Math.cos(a)*12; this.vy=Math.sin(a)*12; 
        this.dmg=dmg; this.r=4; this.del=false;
        
        // Power: PIERCING
        this.pierce = 0;
        if (window.game.artifacts.piercing) this.pierce = ARTIFACTS_DEF.piercing.count + (window.game.artifacts.piercing - 1);
        
        this.hitList = []; // Lista de IDs de inimigos já acertados (para não acertar o mesmo 2x no piercing)
    }
    update() { 
        this.x+=this.vx; this.y+=this.vy; 
        const canvas = window.canvas;
        if(this.x<0||this.x>canvas.width||this.y<0||this.y>canvas.height) this.del=true; 
    }
    draw() { const ctx = window.ctx; ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fillStyle='#fffa'; ctx.fill(); }
}

export class Particle {
    constructor(x,y,c) { this.x=x; this.y=y; this.c=c; this.life=1; this.vx=(Math.random()-0.5)*5; this.vy=(Math.random()-0.5)*5; }
    update() { this.x+=this.vx; this.y+=this.vy; this.life-=0.05; }
    draw() { const ctx = window.ctx; ctx.globalAlpha=this.life; ctx.fillStyle=this.c; ctx.beginPath(); ctx.arc(this.x,this.y,Math.random()*4,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
}

export class Drop {
    constructor(x, y, t) { 
        this.x=x; this.y=y; this.t=t; 
        this.timer=30; this.del=false; 
        this.vx=(Math.random()-0.5)*5; this.vy=(Math.random()-0.5)*5;
        this.value = t === 'gold' ? 10 : 15; // Valor padrão
    }
    update() {
        // ... lógica de movimento ...
        if(Math.hypot(player.x-this.x, player.y-this.y)<30) {
            this.del=true;
            if(this.t==='gold') { 
                game.gold += this.value; 
                OrkaAudio.playSFX('coin'); 
                ui.gold.innerText=game.gold; 
                updateShopUI(); 
            }
            else if(this.t === 'xp') { 
                game.xp += this.value; 
                checkLevelUp(); 
            }
            // Lógica futura para TECH
            else if(this.t === 'tech') {
                // game.tech += 1;
                showNotification("+1 TECH DATA", "#a020f0");
            }
        }
    }
 
    update() {
        const player = window.player;
        const game = window.game;
        const ui = window.ui;
        this.x+=this.vx; this.y+=this.vy; this.vx*=0.9; this.vy*=0.9;
        if(this.timer>0) this.timer--;
        else {
            const a=Math.atan2(player.y-this.y, player.x-this.x); this.x+=Math.cos(a)*9; this.y+=Math.sin(a)*9;
            if(Math.hypot(player.x-this.x, player.y-this.y)<30) {
                this.del=true;
                if(this.t==='gold') { game.gold+=10; OrkaAudio.playSFX('coin'); ui.gold.innerText=game.gold; updateShopUI(); }
                else { game.xp+=15; checkLevelUp(); }
            }
        }
    }
    draw() { 
        const ctx = window.ctx;
        ctx.fillStyle = this.t==='gold'?'#ffd700':'#00c6ff';
        if(this.t==='gold') ctx.fillRect(this.x-4,this.y-4,8,8); else { ctx.beginPath(); ctx.arc(this.x,this.y,5,0,Math.PI*2); ctx.fill(); }
    }
}
