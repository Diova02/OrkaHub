/**
 * OrkaAudio API v2.0
 * Desenvolvido por Geovani Costa || A.k.a: Diova - Orka
 */
// --- CLASSE PRINCIPAL ---
class OrkaAudioEngine {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.buffers = new Map();
        this.buses = {};
        this.activeInstances = new Set();
        this.rates = { master: 1, sfx: 1, music: 1 };
        this.config = {
            saveEnabled: true,
            storageKey: 'OrkaAudio_Volumes'
        };
        this.volumes = { master: 0.5, sfx: 1.0, music: 1.0 };
        this.currentMusic = null;
        this.analysers = {};
    }
    // --- CICLO DE VIDA ---
    async init() {
        if (this.context)
            return;
        const AudioContext = (window.AudioContext || window.webkitAudioContext);
        this.context = new AudioContext();
        // Restaurar volumes do LocalStorage
        if (this.config.saveEnabled) {
            const saved = localStorage.getItem(this.config.storageKey);
            if (saved)
                this.volumes = { ...this.volumes, ...JSON.parse(saved) };
        }
        // Criar Master Bus
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = this.volumes.master;
        this.masterGain.connect(this.context.destination);
        // Criar Buses Padrão
        this.createBus('sfx');
        this.createBus('music');
        console.log("🔊 OrkaAudio Inicializado.");
        // Chama o blindagem para Mobile
        this._unlockAudio();
        // Tenta dar um resume imediato caso o init já tenha sido chamado por um clique
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
    }
    createBus(name) {
        if (this.buses[name])
            return;
        if (!this.context || !this.masterGain)
            return;
        const gainNode = this.context.createGain();
        gainNode.gain.value = this.volumes[name] || 1.0;
        // Nó de efeito (inicialmente limpo/pass-through)
        const effectNode = this.context.createBiquadFilter();
        effectNode.type = 'lowpass';
        effectNode.frequency.value = 22000;
        // Conexão: Bus Gain -> Bus Effect -> Master
        gainNode.connect(effectNode);
        effectNode.connect(this.masterGain);
        this.buses[name] = {
            gain: gainNode,
            effect: effectNode,
            currentEffect: 'normal'
        };
        const analyser = this.context.createAnalyser();
        analyser.fftSize = 256;
        effectNode.connect(analyser); // Conecta o efeito no analisador
        analyser.connect(this.masterGain);
        this.analysers[name] = analyser;
    }
    enableConfigSave(bool) {
        this.config.saveEnabled = bool;
    }
    // --- CARREGAMENTO ---
    async load(key, path) {
        try {
            if (!this.context)
                return false;
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.buffers.set(key, audioBuffer);
            return true;
        }
        catch (e) {
            console.error(`🔇 Erro ao carregar: ${key}`, e);
            return false;
        }
    }
    async loadAll(soundMap) {
        if (!this.context)
            await this.init();
        const promises = Object.entries(soundMap).map(([k, v]) => this.load(k, v));
        return Promise.all(promises);
    }
    // --- MIXAGEM E EFEITOS ---
    setVolume(bus, val) {
        this.volumes[bus] = val;
        if (!this.context)
            return;
        if (bus === 'master' && this.masterGain) {
            this.masterGain.gain.setTargetAtTime(val, this.context.currentTime, 0.05);
        }
        else if (this.buses[bus]) {
            this.buses[bus].gain.gain.setTargetAtTime(val, this.context.currentTime, 0.05);
        }
        if (this.config.saveEnabled) {
            localStorage.setItem(this.config.storageKey, JSON.stringify(this.volumes));
        }
    }
    getVolume(bus = 'master') {
    // Retorna o valor que está na memória da API
    return this.volumes[bus] !== undefined ? this.volumes[bus] : 1.0;
    }
    // Útil para quando o Dev quer saber se um efeito está ativo antes de mudar o ícone na UI
    getBusSettings(busName) {
        const bus = this.buses[busName];
        if (!bus) return null;
        return {
            volume: this.volumes[busName],
            effect: bus.currentEffect,
            playbackRate: this.rates[busName] || 1
        };
    }
    setEffect(effect, busName) {
        if (!this.context)
            return;
        if (busName === 'master') {
            Object.keys(this.buses).forEach(name => this.setEffect(effect, name));
            return;
        }
        const bus = this.buses[busName];
        if (!bus)
            return;
        bus.currentEffect = effect;
        const node = bus.effect;
        switch (effect) {
            case 'muffled':
                node.frequency.setTargetAtTime(600, this.context.currentTime, 0.1);
                break;
            case 'radio':
                node.type = 'bandpass';
                node.frequency.setTargetAtTime(2000, this.context.currentTime, 0.1);
                break;
            default: // normal
                node.type = 'lowpass';
                node.frequency.setTargetAtTime(22000, this.context.currentTime, 0.1);
        }
    }
    getEffect(bus) {
        return this.buses[bus]?.currentEffect || 'normal';
    }
    setMuffled(bus, active = true) {
    this.setEffect(active ? 'muffled' : 'normal', bus);
    }
    setRadio(bus, active = true) {
        this.setEffect(active ? 'radio' : 'normal', bus);
    }
    // --- REPRODUÇÃO ---
    play(key, busName = 'sfx', options = {}) {
        if (!this.context)
            return null;
        const buffer = this.buffers.get(key);
        if (!buffer)
            return null;
        const bus = this.buses[busName] || this.buses['sfx'];
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = options.loop || false;
        const instanceGain = this.context.createGain();
        instanceGain.gain.value = options.volume !== undefined ? options.volume : 1.0;
        // Conecta: Source -> Instance Gain -> Bus Gain
        source.connect(instanceGain);
        instanceGain.connect(bus.gain);
        source.start(0);
        const instance = { source, gain: instanceGain, bus: busName, key, followTask: null };
        this.activeInstances.add(instance);
        source.onended = () => {
            if (instance.followTask)
                cancelAnimationFrame(instance.followTask);
            this.activeInstances.delete(instance);
        };
        source.playbackRate.value = (this.rates?.[busName] || 1);
        return instance;
    }
    playSFX(key, options = {}) {
        return this.play(key, 'sfx', { ...options, loop: false });
    }
    playMusic(key, options = {}) {
        // fazer com que "switchMusic" só seja ativado caso a música requisitada seja diferente da atual, para evitar reiniciar a mesma música desnecessariamente
        if (this.currentMusic && this.currentMusic.key === key) {
            return this.currentMusic;
        }
        if (this.currentMusic) {
            this.switchMusic(key, options);
        } else {
            const instance = this.play(key, 'music', { ...options, loop: true });
            if (instance)
                this.currentMusic = instance;
            return instance;
        }
    }
    // --- CONTROLE E FADES ---
    stop(instance) {
        if (instance?.source) {
            instance.source.stop();
            this.activeInstances.delete(instance);
        }
    }
    stopAll(busName = null) {
        this.activeInstances.forEach(inst => {
            if (!busName || inst.bus === busName) {
                inst.source.stop();
            }
        });
    }
    fade(target, targetVol, duration) {
        if (!this.context)
            return;
        // Se o alvo for uma string (ex: 'music'), pegamos o ganho do Bus.
        // Se for um objeto, pegamos o gain da instância.
        const node = (typeof target === 'string')
            ? (target === 'master' ? this.masterGain : this.buses[target]?.gain)
            : target?.gain;
        if (!node) {
            return;
        }
        const now = this.context.currentTime;
        const currentVol = node.gain.value;
        node.gain.cancelScheduledValues(now);
        node.gain.setValueAtTime(currentVol, now);
        node.gain.linearRampToValueAtTime(targetVol, now + duration);
    }
    fadeAll(busName, targetVol, duration) {
        if (!this.context)
            return;
        const target = busName === 'master' ? this.masterGain : this.buses[busName]?.gain;
        if (target) {
            const now = this.context.currentTime;
            const currentVol = target.gain.value;
            target.gain.cancelScheduledValues(now);
            target.gain.setValueAtTime(currentVol, now);
            target.gain.linearRampToValueAtTime(targetVol, now + duration);
            //
        }
    }
    // --- SPATIAL AUDIO ---
    setFollow(instance, sourceObj, listenerObj, maxDist = 500) {
        if (!instance || !this.context)
            return;
        const update = () => {
            const dx = sourceObj.x - listenerObj.x;
            const dy = sourceObj.y - listenerObj.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            // Cálculo de atenuação simples (0 a 1)
            let volume = 1 - (distance / maxDist);
            if (volume < 0)
                volume = 0;
            if (this.context)
                instance.gain.gain.setTargetAtTime(volume, this.context.currentTime, 0.1);
            // Re-agenda para o próximo frame
            instance.followTask = requestAnimationFrame(update);
        };
        update();
    }
    setPlaybackRate(busName, rate) {
        if (!this.context)
            return;
        // 1. Atualizamos o valor de referência para futuros sons deste bus
        // (Precisamos adicionar 'playbackRate' no objeto de volumes ou criar um novo mapa de config)
        if (!this.rates)
            this.rates = { master: 1, sfx: 1, music: 1 };
        this.rates[busName] = rate;
        // 2. Aplicamos a mudança em tempo real para todas as instâncias ativas do bus
        this.activeInstances.forEach(inst => {
            if (inst.bus === busName || busName === 'master') {
                // O playbackRate.value permite rampas suaves também!
                if (this.context)
                    inst.source.playbackRate.setTargetAtTime(rate, this.context.currentTime, 0.1);
            }
        });
        console.log(`Velocidade do bus "${busName}" alterada para ${rate}x`);
    }
    async switchMusic(key, options = {}) {
        if (!this.context)
            await this.init();
        if (!this.context)
            return null;
        const duration = options.duration || 1.0;
        const now = this.context.currentTime;
        const targetVol = options.volume || this.volumes.music || 1.0;
        // 1. TRILHA ATUAL (SAÍDA)
        if (this.currentMusic) {
            const oldMusic = this.currentMusic;
            const oldSource = oldMusic.source;
            const oldGain = oldMusic.gain.gain;
            // Ancorar valores atuais para evitar saltos
            oldSource.playbackRate.cancelScheduledValues(now);
            oldSource.playbackRate.setValueAtTime(oldSource.playbackRate.value, now);
            oldGain.cancelScheduledValues(now);
            oldGain.setValueAtTime(oldGain.value, now);
            // Efeito de "Disco Parando" (Pitch Bend Down)
            // Usamos rampal linear para o playbackRate chegar perto de zero
            oldSource.playbackRate.linearRampToValueAtTime(0.1, now + duration);
            // Fade Out do Volume
            oldGain.linearRampToValueAtTime(0, now + duration);
            // Para o som e limpa a instância SÓ depois que a rampa acabar
            setTimeout(() => {
                try {
                    oldSource.stop();
                }
                catch (e) { }
                this.activeInstances.delete(oldMusic);
            }, duration * 1000 + 100);
        }
        // 2. NOVA TRILHA (ENTRADA)
        // Criamos a nova instância com volume 0
        const newMusic = this.play(key, 'music', { loop: true, volume: 0 });
        if (!newMusic)
            return null;
        if (newMusic)
            this.currentMusic = newMusic;
        const newGain = newMusic.gain.gain;
        // Fade In suave da nova música
        newGain.cancelScheduledValues(now);
        newGain.setValueAtTime(0, now);
        newGain.linearRampToValueAtTime(targetVol, now + duration);
        //
        return newMusic;
    }
    getFrequencyData(busName) {
        const analyser = this.analysers[busName];
        if (!analyser) return null;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        return dataArray; // O dev usa isso para desenhar no Canvas
    }
    _unlockAudio() {
        const unlock = async () => {
            if (this.context && this.context.state === 'suspended') {
                await this.context.resume();
                // Uma vez desbloqueado, removemos os listeners para economizar memória
                window.removeEventListener('click', unlock);
                window.removeEventListener('touchstart', unlock);
                window.removeEventListener('touchend', unlock);
                console.log("📱 Áudio desbloqueado para Mobile.");
            }
        };
        window.addEventListener('click', unlock);
        window.addEventListener('touchstart', unlock);
        window.addEventListener('touchend', unlock);
    }
}
export const OrkaAudio = new OrkaAudioEngine();
// Inicialização Automática de Eventos
if (typeof window !== 'undefined') {
    const autoInit = () => {
        OrkaAudio.init(); // Garante que o contexto seja criado/resumido no primeiro clique
        // O próprio init já chama o _unlockAudio que você criou
        window.removeEventListener('click', autoInit);
        window.removeEventListener('touchstart', autoInit);
    };
    window.addEventListener('click', autoInit);
    window.addEventListener('touchstart', autoInit);
}