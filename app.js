const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = localStorage.getItem('padel_name');
let currentTournamentId = null;
let currentTournament = null;
let realtimeChannel = null;

// PWA Service Worker Registration & Auto-Update
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
        // Tjek for ny version med det samme ved opstart
        reg.update();

        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    window.location.reload();
                }
            });
        });
    }).catch(err => console.error("SW registration error:", err));

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            window.location.reload();
        }
    });

    // Tjek for ny version hver gang appen åbnes/fokuseres på telefonen
    window.addEventListener('focus', () => {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) reg.update();
        });
    });
}

// --------------------------------------------------------------------------
// THEME MANAGEMENT (LIGHT & DARK MODE)
// --------------------------------------------------------------------------
function initTheme() {
    const savedTheme = localStorage.getItem('padel_theme');
    if (savedTheme) {
        setTheme(savedTheme, false);
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light', false);
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('padel_theme')) {
            setTheme(e.matches ? 'dark' : 'light', false);
        }
    });
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme, true);
}

function setTheme(theme, save = true) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.innerText = theme === 'dark' ? '☀️' : '🌙';
        btn.title = theme === 'dark' ? 'Skift til lyst tema' : 'Skift til mørkt tema';
    }
    if (save) {
        localStorage.setItem('padel_theme', theme);
    }
}

// PWA Installation & Device Detection
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    checkPwaBanner();
});

function checkPwaBanner() {
    const isStandalone = window.navigator.standalone || 
                         window.matchMedia('(display-mode: standalone)').matches ||
                         window.matchMedia('(display-mode: minimal-ui)').matches;

    const banner = document.getElementById('pwa-install-banner');
    if (!banner) return;

    // SKJUL BANNER HELT NÅR APPEN KØRER SOM PWA / STANDALONE!
    if (isStandalone) {
        banner.style.display = 'none';
        return;
    }

    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);

    const bannerTitle = document.getElementById('pwa-banner-title');
    const bannerBtn = document.getElementById('pwa-banner-btn');

    if (isIos) {
        if (bannerTitle) bannerTitle.innerText = "Installér appen på din iPhone";
        if (bannerBtn) bannerBtn.innerText = "Vejledning 📱";
        banner.style.display = 'flex';
    } else if (isAndroid || deferredPrompt) {
        if (bannerTitle) bannerTitle.innerText = "Installér appen på din mobil";
        if (bannerBtn) bannerBtn.innerText = "Installér / Vejledning 📱";
        banner.style.display = 'flex';
    } else {
        if (bannerTitle) bannerTitle.innerText = "Gem Padel-Cup som app";
        if (bannerBtn) bannerBtn.innerText = "Vejledning 💻";
        banner.style.display = 'flex';
    }
}

function openPwaInstallModal() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                const banner = document.getElementById('pwa-install-banner');
                if (banner) banner.style.display = 'none';
            }
            deferredPrompt = null;
        });
        return;
    }

    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);

    const modalTitle = document.getElementById('pwa-modal-title');
    const modalSteps = document.getElementById('pwa-modal-steps');

    if (isIos) {
        if (modalTitle) modalTitle.innerText = "Installér på iPhone / iPad 📱";
        if (modalSteps) {
            modalSteps.innerHTML = `
                <div class="ios-step">
                    <div class="ios-step-num">1</div>
                    <div style="font-size: 13px;">Tryk på <strong>Del-knappen</strong> (firkant med pil op ⎕↑) i Safari-menuen i bunden.</div>
                </div>
                <div class="ios-step">
                    <div class="ios-step-num">2</div>
                    <div style="font-size: 13px;">Rul ned og tryk på <strong>"Tilføj til hjemmeskærm"</strong> (➕).</div>
                </div>
                <div class="ios-step">
                    <div class="ios-step-num">3</div>
                    <div style="font-size: 13px;">Tryk på <strong>"Tilføj"</strong> i øverste højre hjørne. 🎉</div>
                </div>`;
        }
    } else if (isAndroid) {
        if (modalTitle) modalTitle.innerText = "Installér på Android 📱";
        if (modalSteps) {
            modalSteps.innerHTML = `
                <div class="ios-step">
                    <div class="ios-step-num">1</div>
                    <div style="font-size: 13px;">Tryk på <strong>menu-knappen (⋮)</strong> i øverste højre hjørne af Chrome.</div>
                </div>
                <div class="ios-step">
                    <div class="ios-step-num">2</div>
                    <div style="font-size: 13px;">Vælg <strong>"Tilføj til startskærm"</strong> eller <strong>"Installér app"</strong> (📲).</div>
                </div>
                <div class="ios-step">
                    <div class="ios-step-num">3</div>
                    <div style="font-size: 13px;">Tryk <strong>"Installér"</strong> for at tilføje appen til din telefon. 🎉</div>
                </div>`;
        }
    } else {
        if (modalTitle) modalTitle.innerText = "Installér på Computer 💻";
        if (modalSteps) {
            modalSteps.innerHTML = `
                <div class="ios-step">
                    <div class="ios-step-num">1</div>
                    <div style="font-size: 13px;">Kig i browserens adresselinje øverst til højre.</div>
                </div>
                <div class="ios-step">
                    <div class="ios-step-num">2</div>
                    <div style="font-size: 13px;">Tryk på <strong>Installér-ikonet (⊕)</strong> eller menuen (⋮) > <strong>"Installér Padel-Cup"</strong>.</div>
                </div>
                <div class="ios-step">
                    <div class="ios-step-num">3</div>
                    <div style="font-size: 13px;">Bekræft installationen. 🎉</div>
                </div>`;
        }
    }

    document.getElementById('ios-install-modal').style.display = 'flex';
}

function checkInAppBrowser() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isInApp = /FBAN|FBAV|Instagram|Messenger|LinkedIn|Twitter|ByteDance|TikTok/i.test(ua);
    const warning = document.getElementById('in-app-browser-warning');
    if (!warning) return;

    if (isInApp) {
        warning.style.display = 'block';
        const isAndroid = /Android/.test(ua);
        const actionContainer = document.getElementById('in-app-action-container');
        
        if (actionContainer) {
            if (isAndroid) {
                const currentUrl = window.location.href.replace(/^https?:\/\//, '');
                actionContainer.innerHTML = `
                    <a href="intent://${currentUrl}#Intent;scheme=https;package=com.android.chrome;end" style="background:#ffffff; color:#b45309; font-weight:800; font-size:13px; text-align:center; display:block; text-decoration:none; padding:10px 14px; border-radius: var(--radius-sm);">
                        🌐 Åbn i Chrome med 1 klik
                    </a>`;
            } else {
                actionContainer.innerHTML = `
                    <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: 8px; font-size: 12px;">
                        <strong>📱 På iPhone:</strong> Tryk på <strong>tre prikker (⋮)</strong> eller <strong>del-ikonet (⎕↑)</strong> øverst/nederst i højre hjørne og vælg <strong>"Åbn i Safari"</strong>.
                    </div>`;
            }
        }
    } else {
        warning.style.display = 'none';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// CUSTOM DESIGN DIALOG SYSTEM (Erstatter grimme native browser alerts/confirms med Netlify URL)
function showCustomAlert(message, title = "🎾 Svigermors Padel-Cup", icon = "🎾") {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-dialog-modal');
        const titleEl = document.getElementById('custom-dialog-title');
        const messageEl = document.getElementById('custom-dialog-message');
        const iconEl = document.getElementById('custom-dialog-icon');
        const actionsEl = document.getElementById('custom-dialog-actions');

        if (!modal) {
            window.alert(message);
            resolve();
            return;
        }

        iconEl.innerText = icon;
        titleEl.innerText = title;
        messageEl.innerText = message;

        actionsEl.innerHTML = `
            <button class="btn-primary" style="flex:1; padding:12px; font-size:14px;" id="custom-alert-ok-btn">OK</button>
        `;

        modal.style.display = 'flex';

        document.getElementById('custom-alert-ok-btn').onclick = () => {
            modal.style.display = 'none';
            resolve();
        };
    });
}

function showCustomConfirm(message, title = "🎾 Bekræft handling", icon = "❓") {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-dialog-modal');
        const titleEl = document.getElementById('custom-dialog-title');
        const messageEl = document.getElementById('custom-dialog-message');
        const iconEl = document.getElementById('custom-dialog-icon');
        const actionsEl = document.getElementById('custom-dialog-actions');

        if (!modal) {
            const res = window.confirm(message);
            resolve(res);
            return;
        }

        iconEl.innerText = icon;
        titleEl.innerText = title;
        messageEl.innerText = message;

        actionsEl.innerHTML = `
            <button class="btn-secondary btn-sm" style="flex:1; padding:12px; font-size:13px;" id="custom-confirm-cancel-btn">Afbryd</button>
            <button class="btn-primary btn-sm" style="flex:1; padding:12px; font-size:13px;" id="custom-confirm-ok-btn">Ja, fortsæt</button>
        `;

        modal.style.display = 'flex';

        document.getElementById('custom-confirm-cancel-btn').onclick = () => {
            modal.style.display = 'none';
            resolve(false);
        };

        document.getElementById('custom-confirm-ok-btn').onclick = () => {
            modal.style.display = 'none';
            resolve(true);
        };
    });
}

// Global fallback override for eventuelle uventede browser alerts
window.alert = function(msg) {
    showCustomAlert(msg);
};

// App Initialization
function init() {
    initTheme();
    checkInAppBrowser();
    checkPwaBanner();

    if (!currentUser) {
        showView('login-view');
        document.getElementById('header-user-badge').style.display = 'none';
        document.getElementById('app-nav').style.display = 'none';
    } else {
        document.getElementById('user-display-name').innerText = currentUser;
        document.getElementById('header-user-badge').style.display = 'flex';
        goToMyTournaments();
    }
}

let pendingLoginName = null;

async function login() {
    const nameInput = document.getElementById('username-input');
    const errDiv = document.getElementById('login-error');
    const existingWarning = document.getElementById('login-existing-warning');
    
    errDiv.style.display = 'none';
    if (existingWarning) existingWarning.style.display = 'none';
    
    const name = nameInput.value.trim();
    if (name.length < 2) {
        errDiv.innerText = "Brugernavnet skal være på mindst 2 tegn.";
        errDiv.style.display = 'block';
        return;
    }

    // Tjek om brugernavnet findes i databasen
    const { data: existingUser } = await client
        .from('users')
        .select('*')
        .ilike('username', name)
        .maybeSingle();

    if (existingUser) {
        // Hvis brugeren findes, viser vi en venlig besked med mulighed for at fortsætte eller skifte navn
        pendingLoginName = existingUser.username;
        document.getElementById('existing-name-span').innerText = existingUser.username;
        document.getElementById('confirm-name-span').innerText = existingUser.username;
        document.getElementById('suggested-name-span').innerText = existingUser.username + " S";
        if (existingWarning) existingWarning.style.display = 'block';
    } else {
        // Opret helt ny bruger i databasen og log ind
        await client.from('users').insert({ username: name });
        completeLogin(name);
    }
}

function confirmLoginExisting() {
    if (pendingLoginName) {
        completeLogin(pendingLoginName);
    }
}

function cancelLoginExisting() {
    pendingLoginName = null;
    const warning = document.getElementById('login-existing-warning');
    if (warning) warning.style.display = 'none';
    const input = document.getElementById('username-input');
    if (input) {
        input.focus();
        input.select();
    }
}

function completeLogin(name) {
    localStorage.setItem('padel_name', name);
    currentUser = name;
    pendingLoginName = null;
    const warning = document.getElementById('login-existing-warning');
    if (warning) warning.style.display = 'none';
    init();
}

async function logout() {
    const confirmed = await showCustomConfirm("Vil du skifte brugernavn eller logge ud?", "Skift bruger / Log ud", "👤");
    if (!confirmed) return;
    localStorage.removeItem('padel_name');
    currentUser = null;
    currentTournamentId = null;
    init();
}

function showView(viewId) {
    ['login-view', 'my-tournaments-view', 'tournament-view'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === viewId) ? 'block' : 'none';
    });
    const nav = document.getElementById('app-nav');
    if (nav) nav.style.display = (viewId === 'tournament-view') ? 'flex' : 'none';
}

function switchTab(tab) {
    const isMatches = tab === 'matches';
    const isLeaderboard = tab === 'leaderboard';
    const isRegistration = tab === 'registration';

    document.getElementById('matches-section').style.display = isMatches ? 'block' : 'none';
    document.getElementById('leaderboard-section').style.display = isLeaderboard ? 'block' : 'none';
    document.getElementById('registration-section').style.display = isRegistration ? 'block' : 'none';

    document.getElementById('nav-matches').classList.toggle('active', isMatches);
    document.getElementById('nav-leaderboard').classList.toggle('active', isLeaderboard);
    document.getElementById('nav-teams').classList.toggle('active', isRegistration);
}

// --------------------------------------------------------------------------
// MY TOURNAMENTS LOGIC
// --------------------------------------------------------------------------
async function goToMyTournaments() {
    currentTournamentId = null;
    currentTournament = null;
    if (realtimeChannel) {
        client.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
    showView('my-tournaments-view');
    await fetchMyTournaments();
}

let cachedMyTournaments = [];
let cachedMyTournamentIds = [];
let showFinishedTournaments = false;

function toggleFinishedTournaments() {
    showFinishedTournaments = !showFinishedTournaments;
    renderMyTournaments();
}

async function fetchMyTournaments() {
    const listDiv = document.getElementById('my-tournaments-list');
    if (!listDiv) return;

    const { data: myTeams } = await client
        .from('teams')
        .select('tournament_id')
        .or(`player1.ilike.${currentUser},player2.ilike.${currentUser}`);

    cachedMyTournamentIds = myTeams ? [...new Set(myTeams.map(t => t.tournament_id))] : [];

    const { data: tournaments, error } = await client
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        listDiv.innerHTML = '<p style="color: var(--accent-red); text-align: center;">Kunne ikke hente turneringer. Tjek Supabase forbindelsen.</p>';
        return;
    }

    cachedMyTournaments = tournaments || [];
    renderMyTournaments();
}

function renderMyTournaments() {
    const listDiv = document.getElementById('my-tournaments-list');
    if (!listDiv) return;

    if (cachedMyTournaments.length === 0) {
        listDiv.innerHTML = `
            <div class="card" style="text-align: center; padding: 30px 20px;">
                <p style="font-size: 18px; margin-bottom: 8px;">Ingen turneringer endnu 🎾</p>
                <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 20px;">Opret en ny turnering eller deltag i en eksisterende!</p>
                <div style="display:flex; gap:10px;">
                    <button class="btn-primary" onclick="openCreateTournamentModal()">➕ Opret Turnering</button>
                    <button class="btn-secondary" onclick="openJoinTournamentModal()">🔍 Deltag</button>
                </div>
            </div>`;
        return;
    }

    const activeTournaments = cachedMyTournaments.filter(t => t.status !== 'finished');
    const finishedTournaments = cachedMyTournaments.filter(t => t.status === 'finished');

    const renderCard = (t) => {
        const isAdmin = t.admin_username.toLowerCase() === currentUser.toLowerCase();
        const isParticipant = cachedMyTournamentIds.includes(t.id);
        const formatBadgeClass = t.format === 'single' ? 'badge-single' : 'badge-double';
        const formatText = t.format === 'single' ? 'Single' : 'Double';

        let statusText = "Tilmeldingsfase";
        if (t.status === 'matches') statusText = "I gang 🎾";
        if (t.status === 'finished') statusText = "Afsluttet 🏆";

        return `
            <div class="card card-interactive" onclick="openTournament('${t.id}')" style="margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                    <div style="flex:1; min-width:0;">
                        <h3 style="margin:0 0 6px 0; font-size:16px; color:var(--text-main); text-transform:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.name}</h3>
                        <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
                            <span class="badge ${formatBadgeClass}">${formatText}</span>
                            <span class="badge badge-status">${statusText}</span>
                            ${isAdmin ? '<span class="badge badge-admin">Admin</span>' : (isParticipant ? '<span class="badge badge-single">Deltager</span>' : '')}
                        </div>
                    </div>
                    <div style="font-size: 18px; color: var(--text-muted); flex-shrink:0; align-self:center;">→</div>
                </div>
                <div style="margin-top:12px; padding-top:8px; border-top:1px solid var(--border-card); font-size:12px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">Admin: ${t.admin_username} | ${t.max_teams} hold</span>
                    ${isAdmin ? `<button class="btn-danger btn-sm" style="padding:4px 10px; font-size:11px;" onclick="event.stopPropagation(); deleteTournament('${t.id}')">🗑️ Slet</button>` : ''}
                </div>
            </div>`;
    };

    let html = '';

    if (activeTournaments.length > 0) {
        activeTournaments.forEach(t => { html += renderCard(t); });
    } else {
        html += `<div class="card" style="text-align:center; padding:20px; color:var(--text-muted); margin-bottom:10px;">Ingen aktive turneringer i øjeblikket.</div>`;
    }

    if (finishedTournaments.length > 0) {
        html += `
            <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-card);">
                <button class="btn-secondary" onclick="toggleFinishedTournaments()" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding: 12px 14px; font-size:13px; font-weight:700;">
                    <span>🏆 Afsluttede turneringer (${finishedTournaments.length})</span>
                    <span>${showFinishedTournaments ? '▲ Skjul' : '▼ Vis'}</span>
                </button>
            </div>`;

        if (showFinishedTournaments) {
            html += `<div style="margin-top: 10px; display:flex; flex-direction:column;">`;
            finishedTournaments.forEach(t => { html += renderCard(t); });
            html += `</div>`;
        }
    }

    listDiv.innerHTML = html;
}

// Open Tournament View
async function openTournament(tournamentId) {
    currentTournamentId = tournamentId;
    const { data: t } = await client.from('tournaments').select('*').eq('id', tournamentId).single();
    if (!t) return showCustomAlert("Kunne ikke hente turnering.", "Fejl", "⚠️");

    currentTournament = t;
    showView('tournament-view');

    const isAdmin = t.admin_username === currentUser;

    document.getElementById('t-detail-name').innerText = t.name;
    document.getElementById('t-detail-format-badge').innerText = t.format.toUpperCase();
    document.getElementById('t-detail-format-badge').className = 'badge ' + (t.format === 'single' ? 'badge-single' : 'badge-double');
    
    let statusText = t.status === 'registration' ? 'Tilmeldingsfase' : (t.status === 'matches' ? 'Kampprogram i gang 🎾' : 'Afsluttet 🏆');
    document.getElementById('t-detail-status-badge').innerText = statusText;

    document.getElementById('t-detail-admin').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
                👤 <strong>Admin:</strong> ${t.admin_username} &nbsp;|&nbsp; 📞 <strong>Kontakt:</strong> ${t.admin_contact}
            </div>
            ${isAdmin ? `<button class="btn-danger btn-sm" onclick="deleteTournament('${t.id}')">🗑️ Slet Turnering</button>` : ''}
        </div>
    `;

    setupTournamentRealtime(tournamentId);

    if (t.status === 'registration') {
        switchTab('registration');
    } else {
        switchTab('matches');
    }

    fetchTeams();
    fetchMatches();
}

async function deleteTournament(tournamentId) {
    const confirmed = await showCustomConfirm("ADVARSEL: Er du helt sikker på, at du vil slette denne turnering? Alle tilmeldinger, kampe og stillinger vil blive permanent slettet!", "Slet turnering 🗑️", "⚠️");
    if (!confirmed) return;

    const { error } = await client.from('tournaments').delete().eq('id', tournamentId);
    if (error) {
        showCustomAlert("Kunne ikke slette turnering: " + error.message, "Fejl", "❌");
        return;
    }

    await showCustomAlert("Turneringen er nu slettet.", "Slettet 🗑️", "✅");
    goToMyTournaments();
}

function setupTournamentRealtime(tId) {
    if (realtimeChannel) client.removeChannel(realtimeChannel);

    realtimeChannel = client.channel('tournament-' + tId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tId}` }, () => fetchTeams())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tId}` }, () => fetchMatches())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${tId}` }, async (payload) => {
            const oldStatus = currentTournament ? currentTournament.status : null;
            currentTournament = payload.new;

            const badge = document.getElementById('t-detail-status-badge');
            if (badge) {
                let statusText = currentTournament.status === 'registration' ? 'Tilmeldingsfase' : (currentTournament.status === 'matches' ? 'Kampprogram i gang 🎾' : 'Afsluttet 🏆');
                badge.innerText = statusText;
            }

            if (oldStatus === 'registration' && currentTournament.status === 'matches') {
                switchTab('matches');
                fetchMatches();
            }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tournaments', filter: `id=eq.${tId}` }, async () => {
            await showCustomAlert("Turneringen er blevet slettet af admin.", "Turnering Slettet", "ℹ️");
            goToMyTournaments();
        })
        .subscribe();
}

// Modal Handlers
function openCreateTournamentModal() {
    document.getElementById('create-t-name').value = '';
    document.getElementById('create-t-contact').value = '';
    document.getElementById('create-tournament-modal').style.display = 'flex';
}

async function submitCreateTournament() {
    const name = document.getElementById('create-t-name').value.trim();
    const contact = document.getElementById('create-t-contact').value.trim();
    const format = document.getElementById('create-t-format').value;
    const maxTeams = parseInt(document.getElementById('create-t-max-teams').value);

    if (!name || !contact) {
        return showCustomAlert("Udfyld venligst både turneringsnavn og kontakt-oplysninger.", "Manglende oplysninger", "⚠️");
    }

    const { data: newT, error } = await client.from('tournaments').insert({
        name: name,
        admin_username: currentUser,
        admin_contact: contact,
        format: format,
        max_teams: maxTeams,
        status: 'registration'
    }).select().single();

    if (error) {
        showCustomAlert("Fejl ved oprettelse af turnering: " + error.message, "Fejl", "❌");
        return;
    }

    const teamsToInsert = [];
    for (let i = 1; i <= maxTeams; i++) {
        teamsToInsert.push({
            tournament_id: newT.id,
            team_number: i,
            player1: null,
            player2: null
        });
    }

    await client.from('teams').insert(teamsToInsert);

    closeModal('create-tournament-modal');
    openTournament(newT.id);
}

let cachedOpenTournaments = [];

async function openJoinTournamentModal() {
    document.getElementById('join-tournament-modal').style.display = 'flex';
    const searchInput = document.getElementById('join-search-input');
    if (searchInput) searchInput.value = '';

    const listDiv = document.getElementById('open-tournaments-list');
    listDiv.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Henter åbne turneringer...</p>';

    const { data: openTs } = await client
        .from('tournaments')
        .select('*')
        .eq('status', 'registration')
        .order('created_at', { ascending: false });

    if (!openTs || openTs.length === 0) {
        cachedOpenTournaments = [];
        listDiv.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Der er i øjeblikket ingen åbne turneringer med ledige pladser.</p>';
        return;
    }

    cachedOpenTournaments = [];
    for (const t of openTs) {
        const { data: teams } = await client.from('teams').select('*').eq('tournament_id', t.id);
        let filledPlayers = 0;
        let totalCapacity = t.format === 'single' ? t.max_teams : t.max_teams * 2;
        if (teams) {
            teams.forEach(tm => {
                if (tm.player1) filledPlayers++;
                if (tm.player2) filledPlayers++;
            });
        }
        cachedOpenTournaments.push({
            ...t,
            filledPlayers,
            totalCapacity
        });
    }

    renderFilteredJoinTournaments(cachedOpenTournaments);
}

function filterJoinTournaments() {
    const query = (document.getElementById('join-search-input')?.value || '').toLowerCase().trim();
    if (!query) {
        renderFilteredJoinTournaments(cachedOpenTournaments);
        return;
    }

    const filtered = cachedOpenTournaments.filter(t => 
        t.name.toLowerCase().includes(query) || 
        t.admin_username.toLowerCase().includes(query) ||
        (t.admin_contact && t.admin_contact.toLowerCase().includes(query))
    );

    renderFilteredJoinTournaments(filtered);
}

function renderFilteredJoinTournaments(tournamentsList) {
    const listDiv = document.getElementById('open-tournaments-list');
    if (!listDiv) return;

    if (!tournamentsList || tournamentsList.length === 0) {
        listDiv.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Ingen turneringer matchede din søgning. 🔍</p>';
        return;
    }

    listDiv.innerHTML = '';
    tournamentsList.forEach(t => {
        const card = document.createElement('div');
        card.className = 'team-card';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'stretch';
        card.style.gap = '10px';
        card.style.marginBottom = '10px';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:15px; color:var(--text-main);">${t.name}</strong>
                <span class="badge ${t.format === 'single' ? 'badge-single' : 'badge-double'}">${t.format.toUpperCase()} (${t.max_teams} Hold)</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted);">
                👤 Admin: ${t.admin_username} (📞 ${t.admin_contact})<br>
                📊 Pladser: ${t.filledPlayers} / ${t.totalCapacity} spillere
            </div>
            <button class="btn-primary btn-sm" onclick="closeModal('join-tournament-modal'); openTournament('${t.id}')">Se / Deltag →</button>
        `;
        listDiv.appendChild(card);
    });
}

// Initial start
init();
