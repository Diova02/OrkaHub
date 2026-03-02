// orka-ads.js
const mockLateralAds = [
    { 
        id: 'placeholder_1', 
        img: 'placeholder.png', 
        link: 'https://orka-hub.vercel.app',
        peso: 1
    }// ,
    // { 
    //     id: 'ad_2', 
    //     img: 'https://via.placeholder.com/300x600/0055ff/ffffff?text=Jogue+Dethrone', 
    //     link: '/?id=dethrone', // Cross-promo para os seus próprios jogos!
    //     peso: 3 
    // },
    // { 
    //     id: 'ad_3', 
    //     img: 'https://via.placeholder.com/300x600/111111/ffcc00?text=Apoie+o+Orka+Hub', 
    //     link: 'https://seusite.com/donate',
    //     peso: 2
    // }
];

export class OrkaAdsManager {
    constructor() {
        this.ads = mockLateralAds;
        // Tempo entre as trocas: 40 segundos
        this.intervalTime = 40000; 
    }

    initLateralAds() {
        // Se a tela for pequena, nem inicia o timer para poupar memória
        if (window.innerWidth < 1000) return;

        this.rotateAds();
        setInterval(() => this.rotateAds(), this.intervalTime);
    }

    rotateAds() {
        const leftContainer = document.getElementById('ad-container-left');
        const rightContainer = document.getElementById('ad-container-right');
        if (!leftContainer || !rightContainer) return;

        // 1. Apaga a luz (Fade Out)
        leftContainer.classList.add('fade-out');
        rightContainer.classList.add('fade-out');

        // 2. Espera o CSS escurecer para trocar a imagem nos bastidores
        setTimeout(() => {
            // Pega dois anúncios aleatórios diferentes
            const adLeft = this.getRandomAd();
            let adRight = this.getRandomAd();
            
            // Garante que não apareça o mesmo banner dos dois lados
            while (adLeft.id === adRight.id && this.ads.length > 1) {
                adRight = this.getRandomAd();
            }

            // Injeta as imagens e os links
            document.getElementById('ad-img-left').src = './assets/ads/' + adLeft.img;
            document.getElementById('ad-link-left').href = adLeft.link;

            document.getElementById('ad-img-right').src = './assets/ads/' + adRight.img;
            document.getElementById('ad-link-right').href = adRight.link;

            // 3. Acende a luz (Fade In) com as novas imagens
            leftContainer.classList.remove('fade-out');
            rightContainer.classList.remove('fade-out');
        }, 900); // 600ms = tempo exato da transição do CSS
    }

    getRandomAd() {
        // Lógica simples de sorteio. Sortear baseado no "peso da propaganda". Peso 2 = 2 vezes mais chances de aparecer do que peso 1.
        const totalPeso = this.ads.reduce((sum, ad) => sum + ad.peso, 0);
        let randomNum = Math.random() * totalPeso;
        let currentWeight = 0;
        for (let i = 0; i < this.ads.length; i++) {
            currentWeight += this.ads[i].peso;
            if (randomNum < currentWeight) {
                return this.ads[i];
            }
        }
        return this.ads[0]; // fallback
    }
}

// Inicia o motor quando o console carregar
const adSystem = new OrkaAdsManager();
adSystem.initLateralAds();