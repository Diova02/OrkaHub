import DethroneEngine from './engine.js';
import { ZONES, TURN_PHASE } from './constants.js';

class UIManager {
    constructor() {
        this.engine = new DethroneEngine('p1', 'p2');
        this.init();
    }

    init() {
        // Mock de Decks para teste
        const mockDeck = ["AU - 001", "AU - 002", "AU - 003", "AU - 004", "AU - 005", "AU - 006"];
        this.engine.startGame(mockDeck, [...mockDeck]);

        document.getElementById('btn-next-phase').addEventListener('click', () => {
            this.engine.dispatchAction({ type: 'NEXT_PHASE', playerId: this.engine.state.activePlayerId });
            this.render();
        });

        this.render();
    }

    // Lógica de Cor Baseada no Custo
    _getCardColor(identity) {
        const cores = Object.keys(identity.custo || {});
        if (cores.length === 0) return '#ccc'; // Sem custo / Incolor
        
        // Mapeamento de cores do jogo para CSS hex
        const colorMap = {
            red: '#e74c3c',
            green: '#2ecc71',
            blue: '#3498db',
            yellow: '#f1c40f',
            purple: '#9b59b6',
            gray: '#95a5a6'
        };

        // Se for custo misto, pegamos a primeira cor (ou poderíamos fazer um gradiente)
        return colorMap[cores[0]] || '#95a5a6';
    }

    createCardHTML(cardInstance) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${cardInstance.isHidden ? 'hidden' : ''}`;
        
        // Só mostra cores e dados se não estiver oculta
        if (!cardInstance.isHidden || cardInstance.ownerId === 'p1') {
            cardDiv.style.backgroundColor = this._getCardColor(cardInstance.identity);
            cardDiv.innerHTML = `
                <div class="card-name">${cardInstance.identity.nome.pt}</div>
                <div class="card-stats">
                    ATK: ${cardInstance.identity.ataque || 0} <br>
                    DEF: ${cardInstance.getCurrentDefense()}
                </div>
            `;
        } else {
            cardDiv.style.backgroundColor = '#2c3e50'; // Cor de "verso" da carta
            cardDiv.innerHTML = `<span>Dethrone</span>`;
        }

        // Evento de clique simplificado para teste (Invocação/Energia)
        cardDiv.onclick = () => this.handleCardClick(cardInstance);
        
        return cardDiv;
    }

    handleCardClick(card) {
        const playerId = this.engine.state.activePlayerId;
        try {
            if (this.engine.state.phase === TURN_PHASE.ENERGY) {
                this.engine.dispatchAction({ type: 'PLAY_ENERGY', playerId, payload: { cardId: card.id } });
            } else if (this.engine.state.phase === TURN_PHASE.SUMMON) {
                this.engine.dispatchAction({ type: 'SUMMON_CREATURE', playerId, payload: { cardId: card.id } });
            }
            this.render();
        } catch (e) {
            alert(e.message);
        }
    }

    render() {
        const state = this.engine.state;
        
        // Atualiza cabeçalhos
        document.getElementById('current-phase').innerText = `FASE: ${Object.keys(TURN_PHASE)[state.phase - 1]}`;
        document.getElementById('game-status').innerText = `STATUS: ${state.status}`;

        // Limpa e Redesenha Zonas
        this._renderZone('p1-hand', 'p1', ZONES.HAND);
        this._renderZone('p1-royal', 'p1', ZONES.ROYAL_LINE);
        this._renderZone('p1-front', 'p1', ZONES.FRONT_LINE);
        
        this._renderZone('p2-hand', 'p2', ZONES.HAND);
        this._renderZone('p2-royal', 'p2', ZONES.ROYAL_LINE);
        this._renderZone('p2-front', 'p2', ZONES.FRONT_LINE);

        // Stats
        document.getElementById('p1-stats').innerText = `Royal Points: ${state.players.p1.royaltyPoints}`;
        document.getElementById('p2-stats').innerText = `Royal Points: ${state.players.p2.royaltyPoints}`;
    }

    _renderZone(elementId, playerId, zone) {
        const container = document.getElementById(elementId);
        container.innerHTML = '';
        Object.values(this.engine.state.cards)
            .filter(c => c.ownerId === playerId && c.zone === zone)
            .forEach(card => container.appendChild(this.createCardHTML(card)));
    }
}

new UIManager();