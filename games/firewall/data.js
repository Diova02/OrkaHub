export const UPGRADES_DEF = {
    damage: { name: "Dano", icon: "⚔️", desc: "+ Dano Base", baseCost: 15, val: 10, inc: 4 }, // Preço reduzido
    speed:  { name: "Velocidade", icon: "⚡", desc: "- Delay Tiro", baseCost: 20, val: 50, dec: 3, min: 4 }, // Bem mais barato
    range:  { name: "Alcance", icon: "🎯", desc: "+ Raio Radar", baseCost: 22, val: 200, inc: 20 },
    hp:     { name: "Resistência", icon: "❤️", desc: "+ Vida Máx", baseCost: 35, val: 100, inc: 20 }
};
// Se eu remover itens dessa constante, os itens sumirão autmaticamente?
// 
export const ARTIFACTS_DEF = {
    poison: { name: "Nuvem Tóxica", icon: "☠️", color: "#0f0", maxLvl: 5, desc: "Cria toxina ao redor.", upgDesc: "Ainda mais mortal.", baseDmg: 0.2, rangePct: 0.35 },
    freeze: { name: "Balas Cryo", icon: "❄️", color: "#00ffff", maxLvl: 5, desc: "Congela seus alvos.", upgDesc: "+ Tempo congelado.", duration: 30 },
    shield: { name: "Escudo Eletro", icon: "🛡️", color: "#0072ff", maxLvl: 5, desc: "Te protege de um golpe por recarga.", upgDesc: "Recarrega + rápido.", cooldown: 900 },
    midas: { name: "Toque de Midas", icon: "💰", color: "#ffd700", maxLvl: 5, desc: "Transforma dor em lucro.", upgDesc: "+ Chance de dropar dinheiro ao contato.", chance: 1.0 },
    vampire: { name: "Vampirismo", icon: "🩸", color: "#ff0000", maxLvl: 5, desc: "Cura ao matar.", upgDesc: "+ Cura por abate.", heal: 2 },
    explosive: { name: "Munição Explosiva", icon: "💥", color: "#ffaa00", maxLvl: 5, desc: "Explode em área no impacto.", upgDesc: "+ Área e dano.", radius: 30, dmgPct: 0.5 },
    knockback: { name: "Empurrão", icon: "🥊", color: "#ffffff", maxLvl: 5, desc: "Empurre inimigos atingidos.", upgDesc: "+ Força da repulsão.", force: 10 },
    piercing: { name: "Perfurante", icon: "🏹", color: "#888", maxLvl: 5, desc: "Tiros atravessam inimigos.", upgDesc: "+1 Inimigo perfurado.", count: 1 },
    zapp: { name: "Super Choque", icon: "⚡", color: "#ffeb3b", maxLvl: 5, desc: "A cada 3 segundos, dispara um raio aleatório e mortal.", upgDesc: "Relâmpagos mais frequentes.", cooldown: 180 }, // 3s inicial
    //sniper: { name: "Balística", icon: "🔭", color: "#4caf50", maxLvl: 5, desc: "Inimigos distantes sangram mais.", upgDesc: "+ Multiplicador de dano/distância.", mult: 0.001 }, // 0.1% por pixel
    //echo: { name: "Eco", icon: "🔊", color: "#00bcd4", maxLvl: 5, desc: "Tiro ricocheteia ao acertar.", upgDesc: "+ Dano do ricochete.", dmgPct: 0.4 }
};

export const CLASSES_DEF = {
    sniper: { name: "Sniper", icon: "🔭", color: "#4caf50", desc: "+30% Range/Dano, -20% Speed/HP", stats: { range: 1.3, damage: 1.3, speed: 1.2, maxHp: 0.8 } }, // Speed maior = mais lento (delay)
    machine: { name: "Metralhadora", icon: "🔫", color: "#ff9800", desc: "+100% Speed, -60% Dano", stats: { speed: 0.5, damage: 0.4 } }, // Speed menor = mais rápido
    shotgun: { name: "Escopeta", icon: "🧨", color: "#795548", desc: "+40% Dano, -30% Range", stats: { damage: 1.4, range: 0.7 } },
    tank: { name: "Tanque", icon: "🛡️", color: "#607d8b", desc: "+50% HP, +30% Dano, -50% Speed", stats: { maxHp: 1.5, damage: 1.3, speed: 1.5 } }
};
export const ENEMIES_DEF = {
    square: { 
        name: "Cubo", color: "#ff4444", desc: "Este é o seu inimigo. Estoure os miolos dele.",
        hpMult: 1.0, speed: 1.5, size: 20, dmg: 15, goldChance: 0.2, minWave: 1, crowdVol: 3, eliteChance: 0.1
    },
    triangle: { 
        name: "Velocista", color: "#ffff00", desc: "Rápido e chato, igual pernilongo.",
        hpMult: 0.6, speed: 3.5, size: 15, dmg: 10, goldChance: 0.1, minWave: 3, crowdVol: 4, eliteChance: 0.15
    },
    circle: { 
        name: "Tanque", color: "#aa00ff", desc: "Ele não se importa com seus sentimentos.",
        hpMult: 2.5, speed: 0.7, size: 30, dmg: 25, goldChance: 0.8, minWave: 3, crowdVol: 3, eliteChance: 0.05
    },
    rhombus: { 
        name: "Ladino", color: "#ff9d00", desc: "Parece imbecil, mas não se engane.",
        hpMult: 1.2, speed: 0.5, size: 20, dmg: 12, goldChance: 0.3, minWave: 6, crowdVol: 3, eliteChance: 0.2,
        behavior: 'dash', dashChance: 0.05, dashSpeed: 3.0
    },
    hexagon: { 
        name: "Clérigo", color: "#00ff00", desc: "Dificulta o seu trabalho.",
        hpMult: 1.5, speed: 0.9, size: 25, dmg: 15, goldChance: 0.4, minWave: 6, crowdVol: 2, eliteChance: 0.1,
        behavior: 'healer', healRange: 150, healAmount: 10, healCooldown: 60
    }
};

export const AUDIOS_DEF = {
    'shoot': 'sfx/shoot.mp3',
    'hit': 'sfx/playerhit.mp3',
    //'explosion': 'sfx/explosion.mp3',
    'coin': 'sfx/coin.mp3',
    'levelup': 'sfx/levelup.mp3',
    'gameover': 'sfx/gameover.mp3',
    'bgm': 'music/back_music.mp3',
    'glitch': 'sfx/glitch_appear.wav',
    'bgm-menu': 'music/menu_music.mp3'
};

// --- NEW: Wave Spawning System ---
export const waveMap = {
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