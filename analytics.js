/**
 * ReceitasZero Analytics Tracker — Supabase Edition
 * Rastreia visitantes humanos e bots, cliques, tempo na página e mais.
 * Dados enviados diretamente ao banco Supabase via REST API.
 */
(function () {
    'use strict';

    // ============================================================
    // CONFIGURAÇÕES SUPABASE
    // ============================================================
    const SUPABASE_URL  = 'https://wonzdrykzwxlavsyleux.supabase.co';
    const ANON_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvbnpkcnlrend4bGF2c3lsZXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjI3NDcsImV4cCI6MjA5NzE5ODc0N30.7LM9VNtLgWVRzhobSF5aP9NzKCeSlTzo0aa9YCxwgns';

    const BASE_HEADERS = {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY,
    };

    // ============================================================
    // DETECÇÃO DE BOTS
    // ============================================================
    const BOT_PATTERNS = [
        /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
        /yandexbot/i, /sogou/i, /exabot/i, /ia_archiver/i,
        /crawler/i, /spider/i, /scraper/i, /bot\b/i, /robot/i, /crawl/i,
        /wget/i, /curl/i, /python-requests/i, /headless/i,
        /phantomjs/i, /selenium/i, /puppeteer/i, /playwright/i,
        /lighthouse/i, /pagespeed/i, /gtmetrix/i, /pingdom/i, /uptime/i,
        /checker/i, /validator/i, /scanner/i, /ahrefsbot/i,
        /semrushbot/i, /mj12bot/i, /dotbot/i, /rogerbot/i, /archive\.org/i,
        // Bots reais do Meta (UAs específicos de crawlers, NÃO do app)
        /facebot/i, /facebookexternalhit/i, /facebookcatalog/i,
        /meta-externalagent/i, /meta-externalfetcher/i, /meta-externalads/i,
        /adsbot-facebook/i, /facebookbot/i,
        /igexternalfetcher/i, /linkedinbot/i
        // ATENÇÃO: /facebook/i, /instagram/i e /whatsapp/i removidos
        // pois o browser interno do app (FBAN, FBIOS) seria detectado como bot
    ];

    function isBot(ua) {
        if (!ua) return true;
        return BOT_PATTERNS.some(p => p.test(ua));
    }

    function getBotName(ua) {
        if (!ua) return 'Unknown Bot';
        const patterns = [
            [/googlebot/i,              'Googlebot'],
            [/bingbot/i,               'Bingbot'],
            [/yandexbot/i,             'YandexBot'],
            [/baiduspider/i,           'Baiduspider'],
            [/duckduckbot/i,           'DuckDuckBot'],
            [/ahrefsbot/i,             'AhrefsBot'],
            [/semrushbot/i,            'SemrushBot'],
            [/lighthouse/i,            'Google Lighthouse'],
            [/pagespeed/i,             'PageSpeed'],
            [/puppeteer/i,             'Puppeteer'],
            [/selenium/i,              'Selenium'],
            [/playwright/i,            'Playwright'],
            [/headless/i,              'Headless Browser'],
            [/python-requests/i,       'Python Requests'],
            [/curl/i,                  'cURL'],
            [/wget/i,                  'Wget'],
            // Facebook Ads / Meta
            [/adsbot-facebook/i,           'Facebook AdsBot'],
            [/facebookcatalog/i,           'Facebook Catalog Bot'],
            [/meta-externalagent/i,        'Meta ExternalAgent'],
            [/meta-externalfetcher/i,      'Meta ExternalFetcher'],
            [/facebookexternalhit/i,       'Facebook Link Preview'],
            [/facebookbot/i,               'FacebookBot'],
            [/facebot/i,                   'Facebot'],
            [/facebook/i,                  'Facebook Bot'],
            // Instagram / WhatsApp
            [/igexternalfetcher/i,         'Instagram Fetcher'],
            [/instagram/i,                 'Instagram Bot'],
            [/whatsapp/i,                  'WhatsApp Bot'],
        ];
        for (const [pat, name] of patterns) {
            if (pat.test(ua)) return name;
        }
        return 'Unknown Bot';
    }

    // ============================================================
    // DETECÇÃO DE DISPOSITIVO / NAVEGADOR / OS
    // ============================================================
    function getDeviceInfo() {
        const ua = navigator.userAgent;

        const device = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
            ? (/iPad/i.test(ua) ? 'Tablet' : 'Mobile')
            : 'Desktop';

        let browser = 'Unknown';
        if (/Edg\//i.test(ua))                                    browser = 'Edge';
        else if (/OPR\/|Opera/i.test(ua))                         browser = 'Opera';
        else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua))   browser = 'Chrome';
        else if (/Firefox\//i.test(ua))                            browser = 'Firefox';
        else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua))     browser = 'Safari';
        else if (/Trident\/|MSIE/i.test(ua))                       browser = 'Internet Explorer';

        let os = 'Unknown';
        if (/Windows/i.test(ua))           os = 'Windows';
        else if (/Mac OS X/i.test(ua))     os = 'macOS';
        else if (/Android/i.test(ua))      os = 'Android';
        else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
        else if (/Linux/i.test(ua))        os = 'Linux';

        return { device, browser, os };
    }

    // ============================================================
    // SESSION ID
    // ============================================================
    function getSessionId() {
        let sid = sessionStorage.getItem('rz_sid');
        if (!sid) {
            sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
            sessionStorage.setItem('rz_sid', sid);
        }
        return sid;
    }

    // ============================================================
    // SUPABASE REST API HELPERS
    // ============================================================

    /** INSERT ou UPDATE (upsert) por chave primária */
    async function sbUpsert(table, record) {
        return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
                ...BASE_HEADERS,
                'Prefer': 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify(record),
        });
    }

    /** PATCH (atualização parcial) com filtro */
    async function sbPatch(table, filter, updates, keepalive = false) {
        return fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
            method: 'PATCH',
            headers: { ...BASE_HEADERS, 'Prefer': 'return=minimal' },
            body: JSON.stringify(updates),
            keepalive,
        });
    }

    /** INSERT simples */
    async function sbInsert(table, record) {
        return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: { ...BASE_HEADERS, 'Prefer': 'return=minimal' },
            body: JSON.stringify(record),
        });
    }

    // ============================================================
    // GEOLOCALIZAÇÃO (com fallback para mobile/Facebook browser)
    // ============================================================
    async function getGeoInfo() {
        const apis = [
            // API 1: ipapi.co (HTTPS)
            async () => {
                const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
                if (!r.ok) throw new Error();
                const d = await r.json();
                if (!d.ip || d.error) throw new Error();
                return { ip: d.ip || null, country: d.country_name || null, country_code: d.country_code || null, city: d.city || null, region: d.region || null, org: d.org || null };
            },
            // API 2: ipwho.is (HTTPS, fallback)
            async () => {
                const r = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) });
                if (!r.ok) throw new Error();
                const d = await r.json();
                if (!d.success) throw new Error();
                return { ip: d.ip || null, country: d.country || null, country_code: d.country_code || null, city: d.city || null, region: d.region || null, org: d.connection?.org || null };
            },
            // API 3: ipinfo.io (HTTPS, fallback — funciona em in-app browsers)
            async () => {
                const r = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(4000) });
                if (!r.ok) throw new Error();
                const d = await r.json();
                if (!d.ip) throw new Error();
                // ipinfo retorna: country="BR", region="São Paulo", city="São Paulo"
                return { ip: d.ip || null, country: null, country_code: d.country || null, city: d.city || null, region: d.region || null, org: d.org || null };
            },
            // API 4: freeipapi.com (HTTPS, segundo fallback)
            async () => {
                const r = await fetch('https://freeipapi.com/api/json', { signal: AbortSignal.timeout(4000) });
                if (!r.ok) throw new Error();
                const d = await r.json();
                if (!d.ipAddress) throw new Error();
                return { ip: d.ipAddress || null, country: d.countryName || null, country_code: d.countryCode || null, city: d.cityName || null, region: d.regionName || null, org: null };
            },
        ];
        for (const api of apis) {
            try { return await api(); } catch (_) {}
        }
        return { ip: null, country: null, country_code: null, city: null, region: null, org: null };
    }

    // ============================================================
    // REGISTRAR VISITA
    // ============================================================
    async function trackVisit() {
        const ua           = navigator.userAgent;
        const botDetected  = isBot(ua);
        const { device, browser, os } = getDeviceInfo();
        const sessionId    = getSessionId();

        // Geolocalização com fallback automático
        const { ip, country, country_code, city, region, org } = await getGeoInfo();

        const record = {
            id:           sessionId,
            type:         botDetected ? 'bot' : 'human',
            bot_name:     botDetected ? getBotName(ua) : null,
            ua,
            device,
            browser,
            os,
            referrer:     document.referrer || 'direct',
            page:         location.pathname,
            screen_w:     screen.width,
            screen_h:     screen.height,
            lang:         navigator.language,
            ip,
            country,
            country_code,
            city,
            region,
            org,
            time_on_page: 0,
            clicks:       0,
            scroll_depth: 0,
        };

        try {
            await sbUpsert('visits', record);
        } catch (_) { /* falha silenciosa */ }

        return sessionId;
    }

    // ============================================================
    // RASTREAR ENGAJAMENTO (tempo, scroll, cliques CTA)
    // ============================================================
    function trackEngagement(sessionId) {
        const startTime = Date.now();
        let maxScroll   = 0;
        let clicks      = 0;

        async function pushUpdate(keepalive = false) {
            const timeOnPage = Math.round((Date.now() - startTime) / 1000);
            try {
                await sbPatch(
                    'visits',
                    `id=eq.${encodeURIComponent(sessionId)}`,
                    { time_on_page: timeOnPage, scroll_depth: maxScroll, clicks },
                    keepalive
                );
            } catch (_) {}
        }

        // Profundidade de scroll
        window.addEventListener('scroll', () => {
            const pct = Math.round(
                ((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100
            );
            if (pct > maxScroll) maxScroll = Math.min(pct, 100);
        }, { passive: true });

        // Cliques — detecta CTAs
        document.addEventListener('click', async (e) => {
            clicks++;
            const target = e.target.closest('a, button');
            if (!target) return;

            const href  = target.href || '';
            const text  = (target.innerText || '').trim().slice(0, 80);
            const isCTA = /quero|comprar|garantir|pegar|acessar|pedido|oferta/i.test(text);

            const isAffiliate = href.includes('hotmart') ||
                                 href.includes('kiwify')  ||
                                 href.includes('eduzz')   ||
                                 href.includes('monetizze');

            if (isCTA || isAffiliate) {
                try {
                    await sbInsert('events', {
                        session_id: sessionId,
                        type:       'cta_click',
                        label:      text.slice(0, 60),
                        href:       href.slice(0, 200),
                    });
                } catch (_) {}
            }
        });

        // Atualizar a cada 30s
        const interval = setInterval(() => pushUpdate(false), 30000);

        // visibilitychange: funciona no iOS Safari, Facebook in-app browser e Android
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                pushUpdate(true);
            }
        });

        // beforeunload + pagehide como backup (desktop e alguns Androids)
        window.addEventListener('beforeunload', () => { clearInterval(interval); pushUpdate(true); });
        window.addEventListener('pagehide',     () => { clearInterval(interval); pushUpdate(true); });
    }

    // ============================================================
    // INICIALIZAÇÃO
    // ============================================================
    async function init() {
        try {
            const sessionId = await trackVisit();
            trackEngagement(sessionId);
        } catch (_) {
            // Falha silenciosa — nunca impacta o site
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
