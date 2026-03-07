import { ZONES, POSITION } from './constants.js';

export default class CardInstance {
    /**
     * @param {string} instanceId - ID único gerado para esta partida (ex: 'uuid-123')
     * @param {string} ownerId - ID do jogador dono da carta
     * @param {object} baseIdentity - Os dados estáticos vindos do banco de dados/JSON
     */
    constructor(instanceId, ownerId, baseIdentity) {
        // 1. ESTADOS IDENTITÁRIOS (Imutáveis durante a partida, vêm do "outro arquivo")
        // Exemplo do que tem aqui: id_db, name, color, cost (array/number), attack, defenseA, defenseB, type, isRoyalBlood...
        this.identity = baseIdentity; 

        // 2. ESTADOS VARIÁVEIS (Mudam durante o jogo)
        this.id = instanceId;
        this.ownerId = ownerId;
        this.zone = ZONES.DECK;
        this.position = POSITION.STANDING; 
        
        // Estados de Capitão e Combate
        this.isCaptain = false;
        this.captainBounty = 0; // Valor da cabeça (inicia em 0, ao matar outro capitão, aumenta)
        this.hasAttackedThisTurn = false;
        
        // Estados de Mesa
        this.turnsOnBoard = 0;
        this.summonedThisTurn = false; // Controle de enjoo
        this.isHidden = true; // Cartas na linha real começam ocultas
        this.attachedSeals = []; // Array de IDs de cartas "seladas" nela
        this.currentDefA = baseIdentity.defesaA || 0;
        this.currentDefB = baseIdentity.defesaB || 0;
    }

    // Método auxiliar limpo para pegar a defesa atual baseada na posição
    getCurrentDefense() {
        return this.position === POSITION.STANDING 
            ? this.identity.defenseA 
            : this.identity.defenseB;
    }
}