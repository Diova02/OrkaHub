// core/scripts/orka-game-manager.js
import { OrkaCloud } from './orka-cloud.js';

export class OrkaGameManager {
    constructor(config) {
        this.config = {
            gameId: config.gameId,
            isDaily: config.isDaily !== false, // [NOVO] Padrão true para seus jogos atuais (Wordle style)
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
            history: [],
            dateRef: null // [NOVO] Guarda a data de referência da sessão
        };

        this.timers = { heartbeat: null };
    }

    async init() {
        console.log(`🎮 Inicializando ${this.config.gameId}...`);
        
        // Define a data de referência (Hoje YYYY-MM-DD se for diário, ou null)
        if (this.config.isDaily) {
            this.state.dateRef = new Date().toISOString().split('T')[0];
        }

        const user = await OrkaCloud.initAuth();
        let profile = OrkaCloud.getProfile();

        if (this.config.enforceLogin && (!profile || !profile.nickname)) {
            // Lógica de guest...
            const randomNick = `Explorador ${Math.floor(Math.random() * 9999)}`;
            await OrkaCloud.updateProfile({ nickname: randomNick });
        }

        this.state.sessionId = await OrkaCloud.startSession(this.config.gameId);
        this.state.startTime = Date.now();

        this._startHeartbeat();
        this._setupListeners();

        // [NOVO] Carrega save específico da data (se houver)
        const saveData = await OrkaCloud.loadSave(this.config.gameId, this.state.dateRef);

        return { user, profile, saveData };
    }

    // [NOVO] Método auxiliar para salvar progresso
    async saveProgress(data) {
        // Salva passando a referência de data
        await OrkaCloud.saveGame(this.config.gameId, data, this.state.dateRef);
    }

    checkpoint(data = {}) {
        this.state.history.push({ t: Date.now(), ...data });
        
        if (data.score !== undefined) this.state.score = data.score;
        if (data.level !== undefined) this.state.level = data.level;
        
        this.state.customContext = { ...this.state.customContext, ...data };
        
        // [OPCIONAL] Se quiser salvar automaticamente no checkpoint:
        // this.saveProgress(this.state.customContext);

        this._syncSession('checkpoint'); 
    }

    async endGame(result, finalData = {}) {
        this._stopHeartbeat();
        const duration = Math.floor((Date.now() - this.state.startTime) / 1000);

        // [CORREÇÃO 1] Atualiza o estado local se o jogo mandou score/level agora
        if (finalData.score !== undefined) this.state.score = finalData.score;
        if (finalData.level !== undefined) this.state.level = finalData.level;

        const metadata = {
            result: result, 
            final_level: this.state.level,
            final_score: this.state.score,
            date_ref: this.state.dateRef,
            ...this.state.customContext,
            ...finalData
        };

        if (result !== 'abandoned') {
            if (result === 'win') {
                try {
                    const alreadyClaimed = await OrkaCloud.checkDailyClaim(this.config.gameId);
                    
                    if (!alreadyClaimed) {
                        console.log('🎁 Claiming daily reward...');
                        await OrkaCloud.claimDaily(this.config.gameId);
                    }
                    
                    // [CORREÇÃO 2] Agora this.state.score tem o valor correto!
                    if (this.state.score > 0) {
                        await OrkaCloud.submitScore(this.config.gameId, this.state.score);
                    }
                } catch (e) {
                    console.warn("Falha ao processar vitória:", e);
                }
            }

            if (this.config.isDaily) {
                await this.saveProgress({ ...this.state.customContext, status: 'finished', result });
            }
        }

        OrkaCloud.endSessionBeacon(this.state.sessionId, {
            duration_seconds: duration,
            metadata: metadata
        });
    }

    _startHeartbeat() {
        if (this.timers.heartbeat) clearInterval(this.timers.heartbeat);
        this.timers.heartbeat = setInterval(() => {
            if (!this.state.isPaused) {
                this._syncSession('heartbeat');
            }
        }, this.config.heartbeatInterval);
    }

    _stopHeartbeat() {
        if (this.timers.heartbeat) clearInterval(this.timers.heartbeat);
    }

    _syncSession(reason) {
        if (!this.state.sessionId) return;
        const duration = Math.floor((Date.now() - this.state.startTime) / 1000);
        
        OrkaCloud.updateSession(this.state.sessionId, {
            duration_seconds: duration,
            metadata: {
                status: 'playing',
                last_update: reason,
                ...this.state.customContext
            }
        });
    }

    _setupListeners() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.state.isPaused = true;
                this._syncSession('paused');
            } else {
                this.state.isPaused = false;
            }
        });

        window.addEventListener('beforeunload', () => {
            // Tenta enviar o beacon final como abandoned
            this.endGame('abandoned'); 
        });
    }
}