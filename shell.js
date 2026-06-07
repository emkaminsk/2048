const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
const toggle = document.getElementById('menu-toggle');
const frame = document.getElementById('game-frame');

function openSidebar() {
    sidebar.classList.add('open');
    backdrop.classList.add('visible');
    toggle.setAttribute('aria-expanded', 'true');
    sidebar.setAttribute('aria-hidden', 'false');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('visible');
    toggle.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'true');
}

toggle.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});

backdrop.addEventListener('click', closeSidebar);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
});

document.querySelectorAll('.game-link').forEach((link) => {
    link.addEventListener('click', () => {
        const src = link.dataset.src;
        if (frame.getAttribute('src') !== src) {
            frame.setAttribute('src', src);
        }
        document.querySelectorAll('.game-link').forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
        closeSidebar();
    });
});
