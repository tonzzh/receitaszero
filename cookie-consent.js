/**
 * ReceitasZero Cookie Consent & Consent Mode (LGPD)
 * Gerencia a aceitação de cookies e controle de privacidade.
 * Integra-se diretamente ao Meta Pixel e ao custom analytics.js.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'cookie_consent';

    // Namespace global para compartilhamento de status
    window.CookieConsent = {
        status: localStorage.getItem(STORAGE_KEY),
        hasInteracted: localStorage.getItem(STORAGE_KEY) !== null,
        
        accept: function () {
            localStorage.setItem(STORAGE_KEY, 'accepted');
            this.status = 'accepted';
            this.hasInteracted = true;
            hideBanner();
            document.dispatchEvent(new CustomEvent('cookieConsent', { detail: 'accepted' }));
        },
        
        reject: function () {
            localStorage.setItem(STORAGE_KEY, 'rejected');
            this.status = 'rejected';
            this.hasInteracted = true;
            hideBanner();
            document.dispatchEvent(new CustomEvent('cookieConsent', { detail: 'rejected' }));
        }
    };

    function hideBanner() {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.classList.remove('show');
            // Remove do DOM após a transição terminar
            setTimeout(() => {
                banner.remove();
            }, 400);
        }
    }

    function injectBanner() {
        // Se já interagiu e tomou uma decisão, não mostra o banner
        if (window.CookieConsent.hasInteracted) {
            return;
        }

        // Criar o elemento do banner
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        
        // Define o HTML interno
        banner.innerHTML = `
            <div class="consent-title">
                <span class="consent-icon">🍪</span>
                Controle de Privacidade
            </div>
            <div class="consent-text">
                Nós usamos cookies para melhorar sua experiência, analisar o tráfego do site e personalizar anúncios. 
                Ao continuar navegando, você concorda com o uso de cookies de acordo com a nossa 
                <a href="politica-de-privacidade.html">Política de Privacidade</a>.
            </div>
            <div class="consent-actions">
                <button class="btn-consent-reject" id="btn-consent-reject">Rejeitar</button>
                <button class="btn-consent-accept" id="btn-consent-accept">Aceitar Todos</button>
            </div>
        `;

        document.body.appendChild(banner);

        // Adiciona event listeners aos botões
        document.getElementById('btn-consent-accept').addEventListener('click', () => {
            window.CookieConsent.accept();
        });

        document.getElementById('btn-consent-reject').addEventListener('click', () => {
            window.CookieConsent.reject();
        });

        // Trigger reflow para iniciar animação
        setTimeout(() => {
            banner.classList.add('show');
        }, 100);
    }

    // Inicialização ao carregar o DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectBanner);
    } else {
        injectBanner();
    }
})();
