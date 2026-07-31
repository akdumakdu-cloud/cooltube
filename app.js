const grid = document.getElementById('videoGrid');
const playerModal = document.getElementById('playerModal');
const videoIframe = document.getElementById('videoIframe');
const closeBtn = document.getElementById('closeBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

let currentFocusIndex = 0;
let currentSection = 'grid'; // 'sidebar', 'search', 'grid', 'player'
let sidebarIndex = 0;
let currentVideos = [];

// Stable Invidious/Piped public nodes with direct JSON fallbacks to guarantee live data fetching
async function fetchYouTubeFeed(query = '') {
    grid.innerHTML = '<p class="loading-text">Fetching live data from YouTube nodes...</p>';
    
    // Stable primary data provider list using direct instance endpoints
    const endpoints = query 
        ? [
            `https://invidious.privacyredirect.com/api/v1/search?q=${encodeURIComponent(query)}`,
            `https://vid.priv.au/api/v1/search?q=${encodeURIComponent(query)}`
          ]
        : [
            `https://invidious.privacyredirect.com/api/v1/trending?region=US`,
            `https://vid.priv.au/api/v1/trending?region=US`
          ];

    let rawData = null;
    for (let url of endpoints) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                rawData = await res.json();
                break;
            }
        } catch (e) {
            console.warn("Node failed, switching...");
        }
    }

    if (!rawData) {
        grid.innerHTML = '<p class="loading-text">Unable to fetch live feed. Check network configuration.</p>';
        return;
    }

    // Normalize data structure seamlessly
    const items = Array.isArray(rawData) ? rawData : (rawData.items || []);
    currentVideos = items.map(item => ({
        title: item.title || "Untitled Video",
        channel: item.author || item.uploaderName || "Unknown Channel",
        id: item.videoId || (item.url ? item.url.split('v=')[1] : ''),
        thumb: item.videoThumbnails && item.videoThumbnails.length > 0 
            ? item.videoThumbnails[0].url 
            : `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`
    })).filter(v => v.id).slice(0, 15);

    renderGrid();
}

function renderGrid() {
    grid.innerHTML = '';
    if (currentVideos.length === 0) {
        grid.innerHTML = '<p class="loading-text">No videos found.</p>';
        return;
    }

    currentVideos.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'video-card grid-item';
        card.dataset.id = item.id;
        
        card.innerHTML = `
            <img class="thumbnail" src="${item.thumb}" loading="lazy" decoding="async">
            <div class="info">
                <h3 class="title">${item.title}</h3>
                <p class="channel">${item.channel}</p>
            </div>
        `;
        
        // Instant Click and Touch Support for Desktop/Mobile/TV Virtual Cursors
        card.addEventListener('click', () => {
            currentFocusIndex = index;
            currentSection = 'grid';
            updateFocus();
            openPlayer(item.id);
        });

        grid.appendChild(card);
    });
    currentFocusIndex = 0;
    updateFocus();
}

function updateFocus() {
    document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));

    if (currentSection === 'sidebar') {
        const items = document.querySelectorAll('.nav-item');
        if (items[sidebarIndex]) items[sidebarIndex].classList.add('focused');
    } else if (currentSection === 'search') {
        searchInput.classList.add('focused');
        searchInput.focus();
    } else if (currentSection === 'grid') {
        const cards = document.querySelectorAll('.grid-item');
        if (cards[currentFocusIndex]) {
            cards[currentFocusIndex].classList.add('focused');
            cards[currentFocusIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function openPlayer(videoId) {
    currentSection = 'player';
    videoIframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`;
    playerModal.classList.remove('hidden');
}

function closePlayer() {
    videoIframe.src = '';
    playerModal.classList.add('hidden');
    currentSection = 'grid';
    updateFocus();
}

closeBtn.addEventListener('click', closePlayer);
searchBtn.addEventListener('click', () => {
    if (searchInput.value.trim()) fetchYouTubeFeed(searchInput.value.trim());
});

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (searchInput.value.trim()) fetchYouTubeFeed(searchInput.value.trim());
    }
});

document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        if (currentSection !== 'search') e.preventDefault();
    }

    if (currentSection === 'player') {
        if (['Escape', 'Backspace', 'Menu', 'ContextMenu'].includes(e.key)) closePlayer();
        return;
    }

    if (currentSection === 'sidebar') {
        const navs = document.querySelectorAll('.nav-item');
        if (e.key === 'ArrowDown' && sidebarIndex < navs.length - 1) sidebarIndex++;
        if (e.key === 'ArrowUp' && sidebarIndex > 0) sidebarIndex--;
        if (e.key === 'ArrowRight') {
            currentSection = 'grid';
            currentFocusIndex = 0;
        }
        if (e.key === 'Enter') {
            if (sidebarIndex === 0) fetchYouTubeFeed(); // Trending
            if (sidebarIndex === 1) {
                currentSection = 'search';
                updateFocus();
            }
        }
    } else if (currentSection === 'search') {
        if (e.key === 'ArrowLeft') {
            currentSection = 'sidebar';
            updateFocus();
        }
        if (e.key === 'ArrowDown') {
            currentSection = 'grid';
            currentFocusIndex = 0;
            updateFocus();
        }
    } else if (currentSection === 'grid') {
        const cards = document.querySelectorAll('.grid-item');
        const cols = 3;
        
        if (e.key === 'ArrowLeft') {
            if (currentFocusIndex % cols === 0) {
                currentSection = 'sidebar';
            } else {
                currentFocusIndex--;
            }
        }
        if (e.key === 'ArrowRight' && currentFocusIndex < cards.length - 1) currentFocusIndex++;
        if (e.key === 'ArrowDown' && currentFocusIndex + cols < cards.length) currentFocusIndex += cols;
        if (e.key === 'ArrowUp') {
            if (currentFocusIndex - cols >= 0) {
                currentFocusIndex -= cols;
            } else {
                currentSection = 'search';
            }
        }
        if (e.key === 'Enter') {
            const activeCard = cards[currentFocusIndex];
            if (activeCard) openPlayer(activeCard.dataset.id);
        }
    }

    updateFocus();
});

// Initialize on start with live trending feed
fetchYouTubeFeed();