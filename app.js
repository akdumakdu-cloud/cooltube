const grid = document.getElementById('videoGrid');

// --- STATE MANAGEMENT --- //
let currentContext = 'GRID'; 
let gridFocusIndex = 0;
let menuFocusIndex = 0;
let loginFocusIndex = 0;
let searchFocusIndex = 0;
let COLUMNS = 3;
let isNavigating = false; 

// --- DUAL-ENGINE BACKEND FAILSAFE --- //
// Layer 1: Piped API pool
const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://api.piped.yt',
    'https://pipedapi.drgns.space'
];

// Layer 2: Invidious API pool (Extremely stable alternative backend)
const INVIDIOUS_INSTANCES = [
    'https://invidious.privacyredirect.com',
    'https://vid.priv.au',
    'https://inv.nadeko.net',
    'https://invidious.perennialte.ch'
];

let activeHost = PIPED_INSTANCES[0];
let useInvidious = false; // Automatically flips to true if Piped pool fails completely

// Universal cross-engine fetch wrapper
async function fetchWithFailover(endpoint, options = {}) {
    // Phase 1: Try Piped Network
        for (let host of PIPED_INSTANCES) {
            try {
                const res = await fetch(`${host}${endpoint}`, options);
                if (res.ok) {
                    useInvidious = false;
                    activeHost = host;
                    return await res.json();
                }
            } catch (e) {
                console.warn(`Piped host ${host} failed. Trying next...`);
            }
        }

    console.warn("All Piped servers down. Shifting backend engine to Invidious API pool...");

    // Phase 2: Fallback to Invidious Network (Normalizes data structure instantly)
    for (let host of INVIDIOUS_INSTANCES) {
        try {
            let invEndpoint = endpoint;
            // Map Piped routes to Invidious REST equivalents
            if (endpoint.includes('/trending')) invEndpoint = '/api/v1/trending?region=US';
            else if (endpoint.includes('/search?q=')) invEndpoint = endpoint.replace('/search?q=', '/api/v1/search?q=');
            else if (endpoint.includes('/feed')) invEndpoint = '/api/v1/popular'; // Invidious fallback feed mapping

            const res = await fetch(`${host}${invEndpoint}`, options);
            if (res.ok) {
                useInvidious = true;
                activeHost = host;
                const rawData = await res.json();
                
                // Normalize Invidious JSON array response to match app structure
                if (useInvidious && Array.isArray(rawData)) {
                    return rawData.map(item => ({
                        title: item.title,
                        uploaderName: item.author,
                        thumbnail: item.videoThumbnails ? item.videoThumbnails[0].url : '',
                        url: `/watch?v=${item.videoId}`,
                        type: 'stream'
                    }));
                }
                return rawData;
            }
        } catch (e) {
            console.warn(`Invidious host ${host} failed. Trying next...`);
        }
    }

    throw new Error('All backend API nodes (Piped & Invidious) are completely offline.');
}

// --- DATA LOGIC --- //
async function loadVideos(type = 'trending', query = '') {
    grid.innerHTML = '<p class="loading">Connecting to decentralized nodes...</p>';
    gridFocusIndex = 0; 
    
    let endpoint = '/trending?region=US';
    let options = {};
    const token = localStorage.getItem('pipedToken');
    
    if (type === 'feed') {
        if (!token) {
            grid.innerHTML = '<p class="loading">Please login via Options Menu first.</p>';
            return;
        }
        endpoint = '/feed';
        options.headers = { 'Authorization': token };
    } else if (type === 'search') {
        endpoint = `/search?q=${encodeURIComponent(query)}&filter=all`;
    }

    try {
        let data = await fetchWithFailover(endpoint, options);
        let videos = [];
        if (Array.isArray(data)) videos = data;
        else if (data.items) videos = data.items;
        
        // RAM SAFEGUARD: Streams only, limit 18 items
        const safeData = videos.filter(v => v.type === 'stream' || !v.type).slice(0, 18);
        
        if (safeData.length === 0) throw new Error("Empty dataset received");
        renderGrid(safeData);
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p class="loading">Network failure. All global API mirrors are unreachable.</p>';
    }
}

function renderGrid(videos) {
    grid.innerHTML = '';
    videos.forEach((video) => {
        const card = document.createElement('div');
        card.className = 'video-card focusable-grid';
        card.dataset.url = video.url;
        // decoding="async" prevents thread locks on weak TV hardware
        card.innerHTML = `
            <img class="thumbnail" src="${video.thumbnail}" alt="Thumbnail" loading="lazy" decoding="async">
            <div class="info">
                <h3 class="title">${video.title}</h3>
                <p class="channel">${video.uploaderName}</p>
            </div>
        `;
        grid.appendChild(card);
    });
    updateFocus();
}

function recordHistory(videoUrl) {
    const token = localStorage.getItem('pipedToken');
    if (!token || useInvidious) return; // History sync runs via Piped engine
    
    const videoId = videoUrl.split('v=')[1];
    fetchWithFailover('/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ videoId })
    }).catch(e => {});
}

async function submitLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    if (!user || !pass) return;
    
    document.getElementById('loginBtn').innerText = "Authenticating...";
    try {
        const data = await fetchWithFailover('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        
        if (data && data.token) {
            localStorage.setItem('pipedToken', data.token);
            closeAllModals();
            loadVideos('feed');
        } else {
            alert(data.message || "Login failed");
        }
    } catch (e) {
        alert("Authentication server unreachable.");
    }
    document.getElementById('loginBtn').innerText = "Submit";
}

// --- UI & MODAL MANAGEMENT --- //
function toggleMenu() {
    if (currentContext !== 'GRID') {
        closeAllModals();
    } else {
        document.getElementById('optionsMenu').classList.remove('hidden');
        currentContext = 'MENU';
        menuFocusIndex = 0;
        
        const loginLabel = document.getElementById('loginLabel');
        loginLabel.innerText = localStorage.getItem('pipedToken') ? "Switch Account (Logged In)" : "Login to Piped";
        updateFocus();
    }
}

function closeAllModals() {
    document.getElementById('optionsMenu').classList.add('hidden');
    document.getElementById('loginMenu').classList.add('hidden');
    document.getElementById('searchMenu').classList.add('hidden');
    currentContext = 'GRID';
    updateFocus();
}

// --- FOCUS & INPUT ROUTING --- //
function updateFocus() {
    document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));

    let activeItems, activeIndex;
    if (currentContext === 'MENU') { activeItems = document.querySelectorAll('.focusable-menu'); activeIndex = menuFocusIndex; }
    else if (currentContext === 'LOGIN') { activeItems = document.querySelectorAll('.focusable-login'); activeIndex = loginFocusIndex; }
    else if (currentContext === 'SEARCH') { activeItems = document.querySelectorAll('.focusable-search'); activeIndex = searchFocusIndex; }
    else { activeItems = document.querySelectorAll('.focusable-grid'); activeIndex = gridFocusIndex; }

    if (activeItems.length > 0 && activeItems[activeIndex]) {
        const el = activeItems[activeIndex];
        el.classList.add('focused');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        if (el.tagName !== 'INPUT' && document.activeElement && document.activeElement.tagName === 'INPUT') {
            document.activeElement.blur();
        }
    }
}

function handleEnterKey() {
    let activeItems;
    
    if (currentContext === 'MENU') {
        activeItems = document.querySelectorAll('.focusable-menu');
        const action = activeItems[menuFocusIndex].dataset.action;
        
        if (action === 'trending') { loadVideos('trending'); closeAllModals(); }
        else if (action === 'feed') { loadVideos('feed'); closeAllModals(); }
        else if (action === 'search') {
            closeAllModals();
            document.getElementById('searchMenu').classList.remove('hidden');
            currentContext = 'SEARCH'; searchFocusIndex = 0; updateFocus();
        }
        else if (action === 'login') {
            closeAllModals();
            document.getElementById('loginMenu').classList.remove('hidden');
            currentContext = 'LOGIN'; loginFocusIndex = 0; updateFocus();
        }
        else if (action === 'close') closeAllModals();

    } else if (currentContext === 'LOGIN') {
        activeItems = document.querySelectorAll('.focusable-login');
        const el = activeItems[loginFocusIndex];
        if (el.tagName === 'INPUT') el.focus(); 
        else if (el.id === 'loginBtn') submitLogin();
        else if (el.id === 'cancelLoginBtn') closeAllModals();

    } else if (currentContext === 'SEARCH') {
        activeItems = document.querySelectorAll('.focusable-search');
        const el = activeItems[searchFocusIndex];
        if (el.tagName === 'INPUT') el.focus();
        else if (el.id === 'searchBtn') {
            const query = document.getElementById('searchInput').value;
            if (query) { loadVideos('search', query); closeAllModals(); }
        }
        else if (el.id === 'cancelSearchBtn') closeAllModals();

    } else {
        activeItems = document.querySelectorAll('.focusable-grid');
        if (!activeItems[gridFocusIndex]) return;
        const videoUrl = activeItems[gridFocusIndex].dataset.url;
        recordHistory(videoUrl);
        // Playback target respects active backend engine layout
        const playerBase = useInvidious ? activeHost : 'https://piped.video';
        window.location.href = `${playerBase}${videoUrl}`;
    }
}

document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (isNavigating) { e.preventDefault(); return; }
        isNavigating = true;
        setTimeout(() => { isNavigating = false; }, 150);
    }
    
    COLUMNS = window.innerWidth <= 768 ? 1 : 3;
    
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) e.preventDefault();
    if (['ContextMenu', 'Escape', 'Menu'].includes(e.key)) { toggleMenu(); return; }

    if (currentContext !== 'GRID') {
        const activeItems = document.querySelectorAll(
            currentContext === 'MENU' ? '.focusable-menu' : 
            currentContext === 'LOGIN' ? '.focusable-login' : '.focusable-search'
        );
        const total = activeItems.length;
        let index = currentContext === 'MENU' ? menuFocusIndex : currentContext === 'LOGIN' ? loginFocusIndex : searchFocusIndex;

        if (e.key === 'ArrowDown' && index < total - 1) index++;
        if (e.key === 'ArrowUp' && index > 0) index--;

        if (currentContext === 'MENU') menuFocusIndex = index;
        else if (currentContext === 'LOGIN') loginFocusIndex = index;
        else if (currentContext === 'SEARCH') searchFocusIndex = index;

        if (e.key === 'Enter') handleEnterKey();
    } else {
        const cards = document.querySelectorAll('.focusable-grid');
        const total = cards.length;
        if (total === 0) return;

        if (e.key === 'ArrowRight' && gridFocusIndex < total - 1) gridFocusIndex++;
        if (e.key === 'ArrowLeft' && gridFocusIndex > 0) gridFocusIndex--;
        if (e.key === 'ArrowDown' && gridFocusIndex + COLUMNS < total) gridFocusIndex += COLUMNS;
        if (e.key === 'ArrowUp' && gridFocusIndex - COLUMNS >= 0) gridFocusIndex -= COLUMNS;
        if (e.key === 'Enter') handleEnterKey();
    }
    updateFocus();
});

// Boot Application
loadVideos();