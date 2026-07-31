const grid = document.getElementById('videoGrid');
const playerModal = document.getElementById('playerModal');
const videoIframe = document.getElementById('videoIframe');
const closeBtn = document.getElementById('closeBtn');

let currentFocusIndex = 0;
let currentSection = 'grid'; // Default directly to grid so items are immediately reachable
let sidebarIndex = 0;

// High-speed static feeds with active working YouTube IDs
const STATIC_FEEDS = {
    trending: [
        { title: "Big Buck Bunny (HD Simulation)", channel: "Blender Foundation", id: "aqz-KE-bpKQ", thumb: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg" },
        { title: "Sintel - Open Movie Project", channel: "Blender Foundation", id: "eRsGyueVLvQ", thumb: "https://i.ytimg.com/vi/eRsGyueVLvQ/hqdefault.jpg" },
        { title: "Tears of Steel - Sci-Fi Movie", channel: "Blender Foundation", id: "R6MlUBN0gxo", thumb: "https://i.ytimg.com/vi/R6MlUBN0gxo/hqdefault.jpg" }
    ]
};

function renderTrending() {
    grid.innerHTML = '';
    STATIC_FEEDS.trending.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'video-card grid-item';
        if (index === 0) card.classList.add('focused');
        card.dataset.id = item.id;
        
        card.innerHTML = `
            <img class="thumbnail" src="${item.thumb}" loading="lazy" decoding="async">
            <div class="info">
                <h3 class="title">${item.title}</h3>
                <p class="channel" style="color:#aaa; font-size:0.9vw; margin:0;">${item.channel}</p>
            </div>
        `;
        
        // DIRECT CLICK/TOUCH LISTENER FOR DESKTOP & MOBILE
        card.addEventListener('click', () => {
            currentFocusIndex = index;
            updateFocus();
            openPlayer(item.id);
        });

        grid.appendChild(card);
    });
    updateFocus();
}

function updateFocus() {
    document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));

    if (currentSection === 'sidebar') {
        const items = document.querySelectorAll('.nav-item');
        if (items[sidebarIndex]) items[sidebarIndex].classList.add('focused');
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

// Click listener on close button for touch devices
closeBtn.addEventListener('click', closePlayer);

document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        e.preventDefault();
    }

    if (currentSection === 'player') {
        if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Menu' || e.key === 'ContextMenu') {
            closePlayer();
        }
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
            if (sidebarIndex === 0) renderTrending();
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
        if (e.key === 'ArrowUp' && currentFocusIndex - cols >= 0) currentFocusIndex -= cols;
        
        if (e.key === 'Enter') {
            const activeCard = cards[currentFocusIndex];
            if (activeCard) openPlayer(activeCard.dataset.id);
        }
    }

    updateFocus();
});

// Initialize on load
renderTrending();