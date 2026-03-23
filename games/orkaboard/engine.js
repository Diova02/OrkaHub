class OrkaBoard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.zIndexCounter = 10; // Para garantir que a carta clicada venha para frente
        this.activeCard = null;
        this.offsetX = 0;
        this.offsetY = 0;

        this.initEvents();
    }

    // Cria uma carta em uma posição específica
    spawnCard(id, x, y) {
        const card = document.createElement('div');
        card.classList.add('card');
        card.id = `card-${id}`;
        card.style.left = `${x}px`;
        card.style.top = `${y}px`;

        // Bloqueia o clique direito
        card.addEventListener('contextmenu', e => e.preventDefault());

        this.container.appendChild(card);
    }

    initEvents() {
        // Escuta os eventos no container principal para não perder o mouse se mover muito rápido
        this.container.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.container.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.container.addEventListener('pointerup', (e) => this.onPointerUp(e));
        this.container.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    }

    onPointerDown(e) {
        if (e.target.classList.contains('card')) {
            this.activeCard = e.target;
            
            // Joga a carta para a frente
            this.zIndexCounter++;
            this.activeCard.style.zIndex = this.zIndexCounter;

            // Captura a diferença entre o clique e o canto da carta
            const rect = this.activeCard.getBoundingClientRect();
            this.offsetX = e.clientX - rect.left;
            this.offsetY = e.clientY - rect.top;

            // Captura o pointer para não perder o arrasto se sair da div
            this.activeCard.setPointerCapture(e.pointerId);
        }
    }

    onPointerMove(e) {
        if (!this.activeCard) return;

        // Atualiza a posição
        const newX = e.clientX - this.offsetX;
        const newY = e.clientY - this.offsetY;

        this.activeCard.style.left = `${newX}px`;
        this.activeCard.style.top = `${newY}px`;
    }

    onPointerUp(e) {
        if (this.activeCard) {
            this.activeCard.releasePointerCapture(e.pointerId);
            
            // Futuro: Aqui é onde dispararemos o log para o Supabase
            // ex: logAction('MOVE', this.activeCard.id, newX, newY)

            this.activeCard = null;
        }
    }
}

// Inicializa a Engine
const game = new OrkaBoard('orka-table');

// Spawna algumas cartas brancas de teste no meio da mesa
game.spawnCard('01', 300, 300);
game.spawnCard('02', 320, 320);
game.spawnCard('03', 340, 340);