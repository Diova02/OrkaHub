import { OrkaCloud } from './orka-cloud.js';

export class OrkaGameManager {
    constructor(config) {
        this.config = {
            gameId: config.gameId,
            isDaily: config.isDaily !== false,
            enforceLogin: config.enforceLogin !== false
        };

        this.state = {
            startTime: null,
            score: 0,
            level: 1,
            customContext: {}, 
            dateRef: null
        };
    }

    async init() {
        console.log(`🎮 [Manager] Iniciando lógica de ${this.config.gameId}...`);
        
        if (this.config.isDaily) {
            this.state.dateRef = new Date().toISOString().split('T')[0];
        }

        // O login já foi feito pelo Console/Hub, aqui apenas pegamos os dados
        const user = OrkaCloud.getUser();
        let profile = OrkaCloud.getProfile();

        this.state.startTime = Date.now();

        // Carrega save específico (se houver)
        const saveData = await OrkaCloud.loadSave(this.config.gameId, this.state.dateRef);

        return { user, profile, saveData };
    }

    async saveProgress(data) {
        // Salva passando a referência de data (Daily vs Contínuo)
        await OrkaCloud.saveGame(this.config.gameId, data, this.state.dateRef);
    }

    /**
     * Finaliza o ciclo do jogo e processa recompensas.
     * @param {string} result - 'win', 'lose', ou 'abandoned'
     */
    async endGame(result, finalData = {}) {
        if (finalData.score !== undefined) this.state.score = finalData.score;

        if (result === 'win') {
            try {
                const alreadyClaimed = await OrkaCloud.checkDailyClaim(this.config.gameId);
                
                if (!alreadyClaimed) {
                    console.log('🎁 [Manager] Processando recompensa diária...');
                    await OrkaCloud.claimDaily(this.config.gameId);
                }
                
                if (this.state.score > 0) {
                    await OrkaCloud.submitScore(this.config.gameId, this.state.score);
                }
            } catch (e) {
                console.warn("⚠️ Falha ao processar vitória:", e);
            }
        }

        if (this.config.isDaily && result !== 'abandoned') {
            await this.saveProgress({ ...finalData, status: 'finished', result });
        }
        
        console.log(`🏁 Jogo encerrado: ${result}`);
    }
}