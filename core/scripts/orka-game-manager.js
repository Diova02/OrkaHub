import { OrkaCloud } from './orka-cloud.js';

export class OrkaGameManager {
    constructor(config) {
        console.log('🧱 OrkaGameManager constructor', config);

        this.config = {
            gameId: config.gameId,
            enforceLogin: config.enforceLogin !== false,
            heartbeatInterval: config.heartbeatInterval || 30000
        };

        this.state = {
            sessionId: null,
            startTime: null,
            isPaused: false,
            score: 0,
            level: 1,
            customContext: {}, 
            history: [] 
        };

        this.timers = { heartbeat: null };
    }

    async init() {
        console.log(`🎮 Inicializando ${this.config.gameId}...`);
        
        const user = await OrkaCloud.initAuth();
        console.log('🔐 Auth OK:', user);

        let profile = OrkaCloud.getProfile();
        console.log('👤 Perfil atual:', profile);

        if (this.config.enforceLogin && (!profile || !profile.nickname)) {
            const randomNick = `Explorador ${Math.floor(Math.random() * 9999)}`;
            console.log('✏️ Gerando nickname automático:', randomNick);

            await OrkaCloud.updateProfile({ nickname: randomNick, language: 'pt-BR' });
            profile = OrkaCloud.getProfile();
            console.log('✅ Perfil atualizado:', profile);
        }

        this.state.sessionId = await OrkaCloud.startSession(this.config.gameId);
        this.state.startTime = Date.now();

        console.log('🆔 Sessão iniciada:', this.state.sessionId);

        this._startHeartbeat();
        this._setupListeners();

        return { user, profile };
    }

    checkpoint(data = {}) {
        console.log('📍 Checkpoint recebido:', data);

        this.state.history.push({ t: Date.now(), ...data });
        
        if (data.score !== undefined) {
            this.state.score = data.score;
            console.log('🎯 Score atualizado:', this.state.score);
        }

        if (data.level !== undefined) {
            this.state.level = data.level;
            console.log('🪜 Level atualizado:', this.state.level);
        }
        
        this.state.customContext = { ...this.state.customContext, ...data };
        console.log('🧠 customContext atual:', this.state.customContext);
        
        this._syncSession('checkpoint'); 
    }

    async endGame(result, finalData = {}) {
        console.log('🏁 endGame chamado:', { result, finalData });

        this._stopHeartbeat();
        
        const duration = Math.floor((Date.now() - this.state.startTime) / 1000);
        console.log('⏱️ Duração da sessão:', duration, 'segundos');

        const metadata = {
            result: result, 
            final_level: this.state.level,
            final_score: this.state.score,
            ...this.state.customContext,
            ...finalData
        };

        console.log('📦 Metadata final da sessão:', metadata);

        if (result === 'win') {
            console.log('🎁 Tentando claimDaily...');
            await OrkaCloud.claimDaily(this.config.gameId);

            if (this.state.score > 0) {
                console.log('🏆 Enviando score:', this.state.score);
                await OrkaCloud.submitScore(this.config.gameId, this.state.score);
            }
        }

        OrkaCloud.endSessionBeacon(this.state.sessionId, {
            duration_seconds: duration,
            metadata: metadata
        });
        
        console.log("✅ Sessão encerrada e beacon enviado.");
    }

    _startHeartbeat() {
        console.log('💓 Iniciando heartbeat a cada', this.config.heartbeatInterval, 'ms');

        if (this.timers.heartbeat) clearInterval(this.timers.heartbeat);

        this.timers.heartbeat = setInterval(() => {
            if (!this.state.isPaused) {
                console.log('💓 Heartbeat disparado');
                this._syncSession('heartbeat');
            }
        }, this.config.heartbeatInterval);
    }

    _stopHeartbeat() {
        console.log('🛑 Parando heartbeat');
        if (this.timers.heartbeat) clearInterval(this.timers.heartbeat);
    }

    _syncSession(reason) {
        if (!this.state.sessionId) {
            console.warn('⚠️ Tentativa de sync sem sessionId');
            return;
        }

        const duration = Math.floor((Date.now() - this.state.startTime) / 1000);

        const payload = {
            duration_seconds: duration,
            metadata: {
                status: 'playing',
                last_update: reason,
                ...this.state.customContext
            }
        };

        console.log('🔄 SyncSession:', reason, payload);

        OrkaCloud.updateSession(this.state.sessionId, payload);
    }

    _setupListeners() {
        console.log('👂 Configurando listeners de visibilidade e unload');

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                console.log('🙈 Aba ficou oculta → pausando sessão');
                this.state.isPaused = true;
                this._syncSession('paused');
            } else {
                console.log('👀 Aba voltou → retomando sessão');
                this.state.isPaused = false;
            }
        });

        window.addEventListener('beforeunload', () => {
            console.log('🚪 beforeunload disparado → encerrando como abandoned');
            this.endGame('abandoned'); 
        });
    }
}
