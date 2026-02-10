/**
 * OrkaAudio API v2.0
 * Desenvolvido por Geovani (Orka Hub)
 */

// --- INTERFACES DE CONTRATO ---

interface AudioVolumes {
    master: number;
    sfx: number;
    music: number;
    [key: string]: number; // Suporte para buses customizados
}

interface PlayOptions {
    loop?: boolean;
    volume?: number;
}

interface SwitchOptions extends PlayOptions {
    duration?: number;
}

interface AudioInstance {
    source: AudioBufferSourceNode;
    gain: GainNode;
    bus: string;
    key: string;
    followTask?: number | null;
}

interface Bus {
    gain: GainNode;
    effect: BiquadFilterNode;
    currentEffect: 'normal' | 'muffled' | 'radio' | string;
}

// --- CLASSE PRINCIPAL ---

class OrkaAudioEngine {
    private context: AudioContext | null;
    private masterGain: GainNode | null;
    private buffers: Map<string, AudioBuffer>;
    private buses: Record<string, Bus>;
    private activeInstances: Set<AudioInstance>;
    private currentMusic: AudioInstance | null;
    private rates: Record<string, number>;

    public volumes: AudioVolumes;
    public config: {
        saveEnabled: boolean;
        storageKey: string;
    };

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
    }

    // --- CICLO DE VIDA ---

    async init() {
        if (this.context) return;

        const AudioContext = (window.AudioContext || (window as any).webkitAudioContext) as typeof window.AudioContext;
        this.context = new AudioContext();

        // Restaurar volumes do LocalStorage
        if (this.config.saveEnabled) {
            const saved = localStorage.getItem(this.config.storageKey);
            if (saved) this.volumes = { ...this.volumes, ...JSON.parse(saved) };
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

    createBus(name: string) {
        if (this.buses[name]) return;
        if (!this.context || !this.masterGain) return;

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
    }

    enableConfigSave(bool: boolean) {
        this.config.saveEnabled = bool;
    }

    // --- CARREGAMENTO ---

    async load(key: string, path: string) {
        try {
            if (!this.context) return false;
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.buffers.set(key, audioBuffer);
            return true;
        } catch (e) {
            console.error(`🔇 Erro ao carregar: ${key}`, e);
            return false;
        }
    }

    async loadAll(soundMap: Record<string, string>) {
        if (!this.context) await this.init();
        const promises = Object.entries(soundMap).map(([k, v]) => this.load(k, v));
        return Promise.all(promises);
    }

    // --- MIXAGEM E EFEITOS ---

    setVolume(bus: string, val: number) {
        this.volumes[bus] = val;
        if (!this.context) return;
        if (bus === 'master' && this.masterGain) {
            this.masterGain.gain.setTargetAtTime(val, this.context.currentTime, 0.05);
        } else if (this.buses[bus]) {
            this.buses[bus].gain.gain.setTargetAtTime(val, this.context.currentTime, 0.05);
        }

        if (this.config.saveEnabled) {
            localStorage.setItem(this.config.storageKey, JSON.stringify(this.volumes));
        }
    }

    setEffect(effect: string, busName: string) {
        if (!this.context) return;
        const bus = this.buses[busName === 'master' ? 'sfx' : busName]; // Simplificado p/ exemplo
        if (!bus) return;

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

    getEffect(bus: string) {
        return this.buses[bus]?.currentEffect || 'normal';
    }

    // --- REPRODUÇÃO ---

    play(key: string, busName: string = 'sfx', options: PlayOptions = {}) {
        if (!this.context) return null;
        const buffer = this.buffers.get(key);
        if (!buffer) return null;

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

        const instance: AudioInstance = { source, gain: instanceGain, bus: busName, key, followTask: null };
        this.activeInstances.add(instance);

        source.onended = () => {
            if (instance.followTask) cancelAnimationFrame(instance.followTask);
            this.activeInstances.delete(instance);
        };

        source.playbackRate.value = (this.rates?.[busName] || 1);

        return instance;
    }

    playSFX(key: string, options: PlayOptions = {}) {
        return this.play(key, 'sfx', { ...options, loop: false });
    }

    playMusic(key: string, options: PlayOptions = {}) {
        if (this.currentMusic) {
            return this.switchMusic(key, options);
        }
        const instance = this.play(key, 'music', { ...options, loop: true });
        if (instance) this.currentMusic = instance;
        return instance;
    }

    // --- CONTROLE E FADES ---

    stop(instance: AudioInstance | null) {
        if (instance?.source) {
            instance.source.stop();
            this.activeInstances.delete(instance);
        }
    }

    stopAll(busName: string | null = null) {
        this.activeInstances.forEach(inst => {
            if (!busName || inst.bus === busName) {
                inst.source.stop();
            }
        });
    }

    fade(target: string | AudioInstance, targetVol: number, duration: number) {
        if (!this.context) return;

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

    fadeAll(busName: string, targetVol: number, duration: number) {
        if (!this.context) return;
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

    setFollow(instance: AudioInstance, sourceObj: any, listenerObj: any, maxDist: number = 500) {
        if (!instance || !this.context) return;

        const update = () => {
            const dx = sourceObj.x - listenerObj.x;
            const dy = sourceObj.y - listenerObj.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Cálculo de atenuação simples (0 a 1)
            let volume = 1 - (distance / maxDist);
            if (volume < 0) volume = 0;

            if (this.context) instance.gain.gain.setTargetAtTime(volume, this.context.currentTime, 0.1);

            // Re-agenda para o próximo frame
            instance.followTask = requestAnimationFrame(update);
        };

        update();
    }

    setPlaybackRate(busName: string, rate: number) {
        if (!this.context) return;
        
        // 1. Atualizamos o valor de referência para futuros sons deste bus
        // (Precisamos adicionar 'playbackRate' no objeto de volumes ou criar um novo mapa de config)
        if (!this.rates) this.rates = { master: 1, sfx: 1, music: 1 };
        this.rates[busName] = rate;

        // 2. Aplicamos a mudança em tempo real para todas as instâncias ativas do bus
        this.activeInstances.forEach(inst => {
            if (inst.bus === busName || busName === 'master') {
                // O playbackRate.value permite rampas suaves também!
                if (this.context) inst.source.playbackRate.setTargetAtTime(rate, this.context.currentTime, 0.1);
            }
        });

        console.log(`Velocidade do bus "${busName}" alterada para ${rate}x`);
    }

    async switchMusic(key: string, options: SwitchOptions = {}) {
        if (!this.context) await this.init();
        if (!this.context) return null;
        
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
                try { oldSource.stop(); } catch(e) {}
                this.activeInstances.delete(oldMusic);
            }, duration * 1000 + 100);
        }

        // 2. NOVA TRILHA (ENTRADA)
        // Criamos a nova instância com volume 0
        const newMusic = this.play(key, 'music', { loop: true, volume: 0 });
        if (!newMusic) return null;

        if (newMusic) this.currentMusic = newMusic;
        const newGain = newMusic.gain.gain;

        // Fade In suave da nova música
        newGain.cancelScheduledValues(now);
        newGain.setValueAtTime(0, now);
        newGain.linearRampToValueAtTime(targetVol, now + duration);

        //
        return newMusic;
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