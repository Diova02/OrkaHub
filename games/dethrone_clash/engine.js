import { GAME_STATE, TURN_PHASE, ZONES } from './constants.js';
import CardInstance from './card.js';
import { getCardIdentity } from './cards_db.js';

export default class DethroneEngine {
    constructor(player1Id, player2Id) {
        // Estado Global do Jogo (Esta é a árvore que será enviada para as telas)
        this.state = {
            status: GAME_STATE.PEACE,
            activePlayerId: player1Id,
            turnCount: 1,
            phase: TURN_PHASE.DRAW,
            
            players: {
                [player1Id]: this._createInitialPlayerState(player1Id),
                [player2Id]: this._createInitialPlayerState(player2Id)
            },
            
            // Instâncias de todas as cartas no jogo (Dicionário para busca rápida O(1))
            cards: {} 
        };
        this.player1Id = player1Id;
        this.player2Id = player2Id;
            
    }

    _createInitialPlayerState(playerId) {
        return {
            id: playerId,
            royaltyPoints: 0,
            // Energia dividida em slots (current = disponível no turno, max = capacidade)
            energy: { 
                red: { current: 0, max: 0 }, 
                green: { current: 0, max: 0 }, 
                blue: { current: 0, max: 0 }, 
                yellow: { current: 0, max: 0 }, 
                purple: { current: 0, max: 0 },
                gray: { current: 0, max: 0 } // Para cartas incolores, se houver
            },
            ambassador: null
        };
    }

    // ========================================================================
    // NÚCLEO MULTIPLAYER: O Despachante de Ações
    // Todas as interações dos jogadores DEVEM passar por aqui.
    // ========================================================================
    dispatchAction(actionPayload) {
        const { type, playerId, payload } = actionPayload;

        // Regra de Ouro: O jogador não pode agir fora do turno dele
        // Exceção: O oponente respondendo a um desafio na fase 6
        const isRespondingToChallenge = type === 'RESPOND_CHALLENGE';
        if (playerId !== this.state.activePlayerId && !isRespondingToChallenge) {
            throw new Error("Não é o seu turno.");
        }

        // Roteamento da Ação
        switch (type) {
            case 'PLAY_ENERGY':
                this._handlePlayEnergy(playerId, payload.cardId);
                break;
            case 'SUMMON_CREATURE':
                this._handleSummon(playerId, payload.cardId, payload.vassalId);
                break;
            case 'ADVANCE_CREATURE':
                this._handleAdvance(playerId, payload.cardId);
                break;
            case 'PROPOSE_CHALLENGE':
                this._handleProposeChallenge(playerId, payload.captainCardId);
                break;
            case 'RESPOND_CHALLENGE':
                this._handleRespondChallenge(playerId, payload.accept, payload.captainCardId);
                break;
            case 'NEXT_PHASE':
                this._advancePhase();
                break;
            default:
                throw new Error("Ação desconhecida.");
        }

        this._checkWinCondition();
        
        // Retorna o estado atualizado para ser renderizado no Frontend / salvo no Supabase
        return this.state; 
    }

    // ========================================================================
    // GERAÇÃO E CONSUMO DE ENERGIA
    // ========================================================================

    _handlePlayEnergy(playerId, cardId) {
        if (this.state.phase !== TURN_PHASE.ENERGY) {
            throw new Error("Você só pode gerar energia na Fase 2.");
        }

        const player = this.state.players[playerId];
        const card = this.state.cards[cardId];

        if (card.ownerId !== playerId || card.zone !== ZONES.HAND) {
            throw new Error("Carta inválida para sacrifício.");
        }

        // Regra 1: Vai para o fundo do baralho. 
        // Considerando que puxamos as cartas com .pop() (final do array), 
        // o fundo do baralho é o início do array (.unshift).
        card.zone = ZONES.DECK;
        player.deck.unshift(cardId); 

        // Regra 2: Descobre a cor principal da carta.
        // Pega a primeira cor listada no custo, ou 'gray' se for gratuita/sem cor.
        const cardColors = Object.keys(card.identity.custo || {});
        const mainColor = card.identity.cor_principal || (cardColors.length > 0 ? cardColors[0] : 'gray');

        // Aumenta a capacidade (max) e preenche o slot (current)
        player.energy[mainColor].max += 1;
        player.energy[mainColor].current += 1;

        this._advancePhase(); // Força avanço pois só gera 1x
    }

    _consumeEnergy(playerId, costObject) {
        // costObject vem da carta, ex: { red: 2, green: 1 }
        const player = this.state.players[playerId];

        // Regra 3: Valida se tem todo o custo disponível ANTES de gastar
        for (const [color, amount] of Object.entries(costObject)) {
            if (!player.energy[color] || player.energy[color].current < amount) {
                throw new Error(`Energia insuficiente. Faltam slots de cor ${color}.`);
            }
        }

        // Se passou na validação, desconta a energia (vai para 0/1, 0/2, etc.)
        for (const [color, amount] of Object.entries(costObject)) {
            player.energy[color].current -= amount;
        }
    }

    // ========================================================================
    // FASE 3: INVOCAR CRIATURAS
    // ========================================================================

    _handleSummon(playerId, cardId, vassalId = null) {
        if (this.state.phase !== TURN_PHASE.SUMMON) {
            throw new Error("Invocação permitida apenas na Fase 3.");
        }

        const card = this.state.cards[cardId];
        
        // Validação de Identidade
        if (card.identity.tipo !== 'criatura') {
            throw new Error("Apenas criaturas podem ser invocadas nesta fase.");
        }
        if (card.zone !== ZONES.HAND || card.ownerId !== playerId) {
            throw new Error("A carta deve estar na sua mão.");
        }

        // Validação Metamorfa
        if (card.identity.subtipo === 'metamorfa' && !vassalId) {
            throw new Error("Criaturas metamorfas exigem o sacrifício de um vassalo para evolução.");
        }

        // --- Lógica de Custos e Sacrifício do Vassalo (Omitida aqui por brevidade, idêntica à versão anterior) ---
        // Aqui você abate o custo da energia, manda o vassalo pro cemitério, etc.
        
        // Entra em campo
        card.zone = ZONES.ROYAL_LINE;
        card.isHidden = true;
        card.turnsOnBoard = 0;
        card.summonedThisTurn = vassalId ? false : true; // Evolução anula enjoo
    }

    // ========================================================================
    // FASE 4: ATIVAR AUXILIARES E SELOS
    // ========================================================================

    _handlePlayAuxiliary(playerId, cardId, targetId = null) {
        if (this.state.phase !== TURN_PHASE.AUXILIARY) {
            throw new Error("Auxiliares permitidos apenas na Fase 4.");
        }

        const card = this.state.cards[cardId];
        
        // Validação Básica
        if (card.identity.tipo !== 'auxiliar') {
            throw new Error("Apenas cartas auxiliares podem ser jogadas nesta fase.");
        }
        if (card.zone !== ZONES.HAND || card.ownerId !== playerId) {
            throw new Error("A carta auxiliar deve ser jogada da sua mão.");
        }

        // Validação de Alvo
        const activationType = card.identity.tipo_ativacao;
        if (['aliado', 'inimigo'].includes(activationType) && !targetId) {
            throw new Error("Esta carta auxiliar exige um alvo.");
        }

        const targetCard = targetId ? this.state.cards[targetId] : null;

        if (activationType === 'aliado' && targetCard.ownerId !== playerId) {
            throw new Error("O alvo deve ser uma carta aliada.");
        }
        if (activationType === 'inimigo' && targetCard.ownerId === playerId) {
            throw new Error("O alvo deve ser uma carta inimiga.");
        }

        // --- Pagamento de Custo (Simplificado) ---
        // this._consumeEnergy(playerId, card.identity.custo);

        // Execução do Fluxo de Efeitos (Lendo o array ordenado)
        card.identity.efeito.forEach(effectName => {
            if (effectName === 'selfDestroy') {
                card.zone = ZONES.GRAVEYARD;
            } else {
                // Aqui chamaremos as funções do arquivo effects.js
                // Ex: EffectsResolver.execute(effectName, card, targetCard, this.state);
                this._executeEffect(effectName, card, targetCard); 
            }
        });
    }

    // Método ponte para o effects.js
    _executeEffect(effectName, sourceCard, targetCard) {
        console.log(`Executando efeito: ${effectName} da carta ${sourceCard.identity.nome.pt}`);
        // No futuro, isso delega para um EffectsManager importado.
    }

    _handleAdvance(playerId, cardId) {
        if (this.state.phase !== TURN_PHASE.ADVANCE) {
            throw new Error("Avanço permitido apenas na Fase 5.");
        }

        const card = this.state.cards[cardId];
        if (card.zone !== ZONES.ROYAL_LINE) {
            throw new Error("Apenas cartas na linha real podem avançar.");
        }
        if (card.summonedThisTurn) {
            throw new Error("Criaturas recém geradas não podem avançar (enjoo).");
        }

        // Avança e se revela
        card.zone = ZONES.FRONT_LINE;
        card.isHidden = false;
    }

    // ========================================================================
    // COMBATE E RESOLUÇÃO DE DANO (Fase 6)
    // ========================================================================

    _handleAttack(playerId, attackerId, targetId) {
        if (this.state.phase !== TURN_PHASE.CONFLICT || this.state.status !== GAME_STATE.WAR) {
            throw new Error("Ataques só ocorrem na Fase 6 em estado de Guerra.");
        }

        const attacker = this.state.cards[attackerId];
        const target = this.state.cards[targetId];

        // Validações do Atacante
        if (attacker.ownerId !== playerId || attacker.zone !== ZONES.FRONT_LINE) {
            throw new Error("Atacante inválido. Deve ser seu e estar na Linha de Frente.");
        }
        if (attacker.hasAttackedThisTurn) {
            throw new Error("Esta criatura já atacou neste turno.");
        }

        // Validações do Alvo (Regra de Tangibilidade)
        if (target.ownerId === playerId) throw new Error("Não pode atacar suas próprias cartas.");
        
        const opponentId = target.ownerId;
        const isFrontLineEmpty = this._isZoneEmpty(opponentId, ZONES.FRONT_LINE);
        
        if (target.zone !== ZONES.FRONT_LINE && !(target.zone === ZONES.ROYAL_LINE && isFrontLineEmpty)) {
            throw new Error("Alvo intocável. A linha de frente oponente o protege.");
        }

        // Execução do Dano
        const atkPower = attacker.identity.ataque; // Futuramente pode somar buffs aqui

        if (target.position === POSITION.STANDING) {
            // Regra 3.A: Se o ataque fura a defesa A e a defesa B juntas
            if (atkPower >= (target.currentDefA + target.currentDefB)) {
                this._destroyCreature(target, attacker, playerId);
            } 
            // Regra 3.B: Fura a Defesa A, mas não a B (Criatura Cai e vaza dano)
            else if (atkPower >= target.currentDefA) {
                const spilloverDamage = atkPower - target.currentDefA;
                target.position = POSITION.FALLEN;
                target.currentDefA = 0;
                target.currentDefB -= spilloverDamage;
            } 
            // Regra 3.C: Não fura nem a Defesa A
            else {
                target.currentDefA -= atkPower;
            }
        } 
        else if (target.position === POSITION.FALLEN) {
            // Regra 3.D: Atacando alvo caído
            if (atkPower >= target.currentDefB) {
                this._destroyCreature(target, attacker, playerId);
            } else {
                target.currentDefB -= atkPower;
            }
        }

        attacker.hasAttackedThisTurn = true;
    }

    _destroyCreature(targetCard, killerCard, activePlayerId) {
        targetCard.zone = ZONES.GRAVEYARD;
        targetCard.currentDefA = 0;
        targetCard.currentDefB = 0;

        // Resolução de recompensa de Capitão
        if (targetCard.isCaptain) {
            this.state.players[activePlayerId].royaltyPoints += targetCard.captainBounty;
            
            // Procura se o assassino tem um capitão em campo para aumentar o próprio prêmio
            const myCaptain = Object.values(this.state.cards).find(
                c => c.ownerId === activePlayerId && c.isCaptain && (c.zone === ZONES.FRONT_LINE || c.zone === ZONES.ROYAL_LINE)
            );
            if (myCaptain) {
                myCaptain.captainBounty += 1;
            }
        }
    }

    _isZoneEmpty(playerId, zoneName) {
        return !Object.values(this.state.cards).some(
            card => card.ownerId === playerId && card.zone === zoneName
        );
    }

    // Novo método para iniciar a partida recebendo a lista de decks dos jogadores
    startGame(player1Decklist, player2Decklist) {
        this._buildDeckForPlayer(this.player1Id, player1Decklist);
        this._buildDeckForPlayer(this.player2Id, player2Decklist);

        // Compra 5 cartas iniciais para cada jogador
        this._drawInitialHand(this.player1Id);
        this._drawInitialHand(this.player2Id);
        
        this.state.status = GAME_STATE.PEACE;
        this.state.phase = TURN_PHASE.ENERGY; // Pula o DRAW do turno 1, como você definiu
    }

    _buildDeckForPlayer(playerId, decklistIds) {
        // decklistIds é um array como ["AU - 001", "AU - 001", "AU - 004"...]
        let deck = [];
        
        decklistIds.forEach((dbId, index) => {
            const identity = getCardIdentity(dbId);
            if (!identity) throw new Error(`Carta ${dbId} não encontrada no banco.`);

            // Gera um ID único para a instância da carta nesta partida
            const instanceId = `${playerId}-card-${index}-${Date.now()}`;
            const cardInstance = new CardInstance(instanceId, playerId, identity);
            
            // Registra a carta no dicionário global de cartas
            this.state.cards[instanceId] = cardInstance;
            deck.push(instanceId);
        });

        // Embaralha o deck (Algoritmo de Fisher-Yates)
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        this.state.players[playerId].deck = deck;
    }

    _drawInitialHand(playerId) {
        const player = this.state.players[playerId];
        for (let i = 0; i < 5; i++) {
            if (player.deck.length > 0) {
                const drawnCardId = player.deck.pop(); // Remove do final do array (topo do deck)
                this.state.cards[drawnCardId].zone = ZONES.HAND;
            }
        }
    }

    // ========================================================================
    // SISTEMA DE GUERRA E PAZ (Fase 6)
    // ========================================================================

    _handleProposeChallenge(playerId, captainCardId) {
        if (this.state.phase !== TURN_PHASE.CONFLICT || this.state.status !== GAME_STATE.PEACE) {
            throw new Error("Desafios só podem ser feitos na Fase 6 durante estado de Paz.");
        }

        const card = this.state.cards[captainCardId];
        if (card.zone !== ZONES.FRONT_LINE) {
            throw new Error("O Capitão deve estar na linha de frente.");
        }

        card.isCaptain = true;
        card.captainBounty = 2; // Cabeça vale 2 pontos de realeza

        // O motor agora "trava" esperando a resposta do oponente
        this.state.pendingChallenge = {
            challengerId: playerId,
            captainId: captainCardId
        };
    }

    _handleRespondChallenge(opponentId, accept, opponentCaptainId = null) {
        if (!this.state.pendingChallenge) {
            throw new Error("Não há desafio pendente.");
        }

        const challengerId = this.state.pendingChallenge.challengerId;

        if (accept) {
            // Aceitou a guerra!
            const captain = this.state.cards[opponentCaptainId];
            if (captain.zone !== ZONES.FRONT_LINE) throw new Error("Seu capitão deve estar na frente.");
            
            captain.isCaptain = true;
            captain.captainBounty = 2;

            this.state.status = GAME_STATE.WAR;
            this.state.pendingChallenge = null;
            // O jogador desafiante (ativo) agora pode iniciar seus ataques
            
        } else {
            // Recusou a guerra
            this.state.players[challengerId].royaltyPoints += 1;
            
            // Desmarca o capitão do desafiante
            const challCaptain = this.state.cards[this.state.pendingChallenge.captainId];
            challCaptain.isCaptain = false;
            challCaptain.captainBounty = 0;

            this.state.pendingChallenge = null;
            this._endTurn(); // Passa o turno imediatamente, pois a fase 6 de paz acabou
        }
    }

    // ========================================================================
    // CONTROLE DE TURNOS
    // ========================================================================

    _advancePhase() {
        if (this.state.phase < TURN_PHASE.CONFLICT) {
            this.state.phase += 1;
            // Pula ações baseadas no turno atual (ex: não puxa carta no turno 1)
            if (this.state.phase === TURN_PHASE.DRAW && this.state.turnCount === 1) {
                this.state.phase = TURN_PHASE.ENERGY;
            }
        } else {
            this._endTurn();
        }
    }

    // ========================================================================
    // RENOVAÇÃO DE TURNO (Cura e Slots)
    // ========================================================================

    _endTurn() {
        const playerIds = Object.keys(this.state.players);
        // Define de quem será o próximo turno
        const nextPlayerId = this.state.activePlayerId === playerIds[0] ? playerIds[1] : playerIds[0];
        
        // 1. Prepara o jogador que vai assumir o turno
        const nextPlayer = this.state.players[nextPlayerId];
        
        // Restaura todos os slots de energia atuais para o valor máximo
        for (const color in nextPlayer.energy) {
            nextPlayer.energy[color].current = nextPlayer.energy[color].max;
        }

        // 2. Cura e limpa estados das cartas do jogador que vai assumir o turno
        Object.values(this.state.cards).forEach(card => {
            if (card.ownerId === nextPlayerId && (card.zone === ZONES.FRONT_LINE || card.zone === ZONES.ROYAL_LINE)) {
                
                // Regra 4: Cura total de dano baseado na identidade (Não levanta se caiu)
                card.currentDefA = card.identity.defesaA;
                card.currentDefB = card.identity.defesaB;
                
                // Remove enjoo e status de "já atacou"
                card.summonedThisTurn = false;
                card.hasAttackedThisTurn = false;

                // Contabilidade para a condição de vitória do "Sangue Real"
                card.turnsOnBoard += 1; 
                if (card.identity.isRoyalBlood && card.zone === ZONES.ROYAL_LINE && card.turnsOnBoard >= 3) {
                    // Lógica do sangue real (adiciona pontos, talvez destrua a carta dependendo do seu design)
                    nextPlayer.royaltyPoints += card.identity.royalBloodValue || 1;
                }
            }
        });

        // Vira a chave do turno
        this.state.activePlayerId = nextPlayerId;
        this.state.turnCount += 1;
        this.state.phase = TURN_PHASE.DRAW;
        
        // Se a Guerra acabou (ex: sem capitães vivos), forçamos o status para PEACE.
        // Omitido para não embolar, mas você pode adicionar uma checagem aqui.
    }

    _checkWinCondition() {
        for (const playerId in this.state.players) {
            if (this.state.players[playerId].royaltyPoints >= 5) {
                this.state.status = GAME_STATE.ENDED;
                this.state.winner = playerId;
            }
        }
    }
}