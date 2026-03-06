// ================================================
// Global Strategic News – Main Application
// ================================================
// HOW TO ADD YOUR OWN RSS FEED (no coding):
// 1. Scroll down to the "Feed Manager" on the left.
// 2. Fill in the URL, source name, category, country.
// 3. Click "Add Feed". It will be saved automatically.
// 4. To remove a feed, click the 🗑️ button next to it.
// ================================================

// Default RSS feeds (you can add more by using the Feed Manager)
const DEFAULT_FEEDS = [
    { url: 'http://feeds.bbci.co.uk/news/rss.xml', name: 'BBC', category: 'Global Affairs', country: 'Europe' },
    { url: 'https://www.reutersagency.com/feed/?best-topics=business-finance', name: 'Reuters', category: 'Economics', country: 'United States' },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera', category: 'Global Affairs', country: 'Global' },
    { url: 'https://feeds.bloomberg.com/markets/news.rss', name: 'Bloomberg', category: 'Economics', country: 'United States' },
    { url: 'https://www.ft.com/rss/home', name: 'Financial Times', category: 'Economics', country: 'Europe' },
    { url: 'https://www.theguardian.com/world/rss', name: 'The Guardian', category: 'Global Affairs', country: 'Europe' },
    { url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', name: 'Times of India', category: 'Global Affairs', country: 'India' },
    { url: 'https://indianexpress.com/feed/', name: 'Indian Express', category: 'Politics', country: 'India' },
    { url: 'https://www.dawn.com/feed/', name: 'Dawn', category: 'Politics', country: 'Pakistan' },
    { url: 'https://www.thedailystar.net/frontpage/rss.xml', name: 'Daily Star', category: 'Global Affairs', country: 'Bangladesh' },
    { url: 'http://www.chinadaily.com.cn/rss/world_rss.xml', name: 'China Daily', category: 'Global Affairs', country: 'China' },
    { url: 'https://www.globaltimes.cn/rss/index.html', name: 'Global Times', category: 'Politics', country: 'China' },
    { url: 'https://www.arabnews.com/rss.xml', name: 'Arab News', category: 'Global Affairs', country: 'Saudi Arabia' },
    { url: 'https://www.jpost.com/Rss/RssFeeds.aspx', name: 'Jerusalem Post', category: 'Defense', country: 'Middle East' },
    { url: 'https://gulfnews.com/rss/feed', name: 'Gulf News', category: 'Global Affairs', country: 'UAE' },
    { url: 'https://www.spglobal.com/commodityinsights/en/rss', name: 'S&P Global', category: 'Materials', country: 'United States' },
    { url: 'https://www.ogj.com/rss', name: 'Oil & Gas Journal', category: 'Energy', country: 'United States' },
    { url: 'https://www.defensenews.com/arc/outboundfeeds/rss/', name: 'Defense News', category: 'Defense', country: 'United States' },
];

// Load custom feeds from localStorage, or use defaults if none saved
let feeds = JSON.parse(localStorage.getItem('customFeeds')) || DEFAULT_FEEDS;

// Global variables
let allArticles = [];
let filteredArticles = [];
let activeCategory = 'all';
let activeCountry = 'all';
let searchQuery = '';

// Stopwords for trending topics
const STOPWORDS = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','is','was','are','were','has','have','had','be','been','being','it','its','this','that','these','those','i','you','he','she','we','they','will','would','could','should','may','might','must','their','them','his','her','my','your','our','not','no','yes','up','down','out','into','onto','again','then','than']);

// Bias keywords
const BIAS_KEYWORDS = {
    political: ['election','president','government','parliament','vote','senate','congress','minister','policy','diplomacy'],
    economic: ['stock','economy','inflation','gdp','trade','tariff','market','bank','rate','recession','growth'],
    opinion: ['opinion','analysis','editorial','view','perspective','column']
};

// DOM elements
const newsGrid = document.getElementById('news-grid');
const trendingList = document.getElementById('trending-list');
const dailyBriefDiv = document.getElementById('daily-brief');
const searchInput = document.getElementById('search');
const themeToggle = document.getElementById('theme-toggle');
const categoryFilter = document.getElementById('category-filter');
const countryFilter = document.getElementById('country-filter');
const addFeedForm = document.getElementById('add-feed-form');
const customFeedsDiv = document.getElementById('custom-feeds-list');

// ---------- Helper Functions ----------
function extractImageFromRSS(item) {
    const mediaContent = item.querySelector('media\\:content, content');
    if (mediaContent && mediaContent.getAttribute('url')) return mediaContent.getAttribute('url');
    const enclosure = item.querySelector('enclosure');
    if (enclosure && enclosure.getAttribute('url')) return enclosure.getAttribute('url');
    const description = item.querySelector('description')?.textContent || '';
    const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
    return imgMatch ? imgMatch[1] : 'https://via.placeholder.com/300x160?text=News';
}

function cleanDescription(description) {
    if (!description) return '';
    const text = description.replace(/<[^>]*>/g, '').trim();
    return text.length > 150 ? text.slice(0,150)+'…' : text;
}

function parseDate(dateStr) {
    const d = new Date(dateStr);
    return isNaN(d) ? new Date() : d;
}

function getBiasFromTitle(title) {
    title = title.toLowerCase();
    if (BIAS_KEYWORDS.political.some(k => title.includes(k))) return 'political';
    if (BIAS_KEYWORDS.economic.some(k => title.includes(k))) return 'economic';
    if (BIAS_KEYWORDS.opinion.some(k => title.includes(k))) return 'opinion';
    return 'neutral';
}

// ---------- Fetch all feeds (including custom) ----------
async function fetchAllFeeds() {
    const proxy = 'https://api.allorigins.win/raw?url=';
    const fetchPromises = feeds.map(async (feed) => {
        try {
            const response = await fetch(proxy + encodeURIComponent(feed.url));
            if (!response.ok) throw new Error();
            const xmlText = await response.text();
            return parseFeed(xmlText, feed);
        } catch {
            return [];
        }
    });
    const results = await Promise.allSettled(fetchPromises);
    const articles = results.flatMap(res => res.status === 'fulfilled' ? res.value : []);
    return articles.sort((a,b) => b.date - a.date);
}

function parseFeed(xmlText, feedMeta) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    const items = xml.querySelectorAll('item');
    const articles = [];
    items.forEach(item => {
        const title = item.querySelector('title')?.textContent?.trim() || 'Untitled';
        const link = item.querySelector('link')?.textContent?.trim() || '#';
        const description = item.querySelector('description')?.textContent || item.querySelector('summary')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || item.querySelector('dc\\:date')?.textContent || new Date().toISOString();
        const image = extractImageFromRSS(item);
        articles.push({
            title,
            link,
            description: cleanDescription(description),
            date: parseDate(pubDate),
            source: feedMeta.name,
            category: feedMeta.category,
            country: feedMeta.country,
            image,
            bias: getBiasFromTitle(title)
        });
    });
    return articles;
}

// ---------- Render functions ----------
function renderCards() {
    if (filteredArticles.length === 0) {
        newsGrid.innerHTML = '<p class="loading">No articles match your filters.</p>';
        return;
    }
    const html = filteredArticles.map(article => {
        const dateStr = article.date.toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        return `
            <div class="news-card">
                <img src="${article.image}" alt="" class="card-image" loading="lazy">
                <div class="card-content">
                    <div class="card-header">
                        <span class="source-name">${article.source}</span>
                        <span class="bias-indicator ${article.bias}">${article.bias}</span>
                    </div>
                    <h3 class="card-title">${article.title}</h3>
                    <p class="card-description">${article.description}</p>
                    <div class="card-footer">
                        <span>${dateStr}</span>
                        <a href="${article.link}" target="_blank" rel="noopener" class="read-more">Read Full Article</a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    newsGrid.innerHTML = html;
}

function renderTrending() {
    const wordCount = new Map();
    allArticles.forEach(article => {
        const words = article.title.toLowerCase().split(/\W+/);
        words.forEach(w => {
            if (w.length > 3 && !STOPWORDS.has(w)) {
                wordCount.set(w, (wordCount.get(w) || 0) + 1);
            }
        });
    });
    const sorted = [...wordCount.entries()].sort((a,b) => b[1]-a[1]).slice(0,15);
    const html = sorted.map(([word]) => `<span class="trending-tag">#${word}</span>`).join('');
    trendingList.innerHTML = html || '<p>No trending topics yet.</p>';
}

function renderDailyBrief() {
    const categories = [...new Set(allArticles.map(a => a.category))];
    const briefItems = [];
    categories.slice(0,5).forEach(cat => {
        const article = allArticles.find(a => a.category === cat);
        if (article) {
            briefItems.push(`<div class="daily-brief-item">🌍 ${article.title} <small>(${article.source})</small></div>`);
        }
    });
    dailyBriefDiv.innerHTML = briefItems.join('') || '<p>Brief unavailable.</p>';
}

// ---------- Filtering ----------
function applyFilters() {
    filteredArticles = allArticles.filter(article => {
        const matchesCategory = activeCategory === 'all' || article.category === activeCategory;
        const matchesCountry = activeCountry === 'all' || article.country === activeCountry;
        const matchesSearch = searchQuery === '' || article.title.toLowerCase().includes(searchQuery) || article.description.toLowerCase().includes(searchQuery);
        return matchesCategory && matchesCountry && matchesSearch;
    });
    renderCards();
}

// ---------- Event listeners for filters ----------
function setupFilters() {
    categoryFilter.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn || !btn.dataset.category) return;
        categoryFilter.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.category;
        applyFilters();
    });
    countryFilter.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn || !btn.dataset.country) return;
        countryFilter.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCountry = btn.dataset.country;
        applyFilters();
    });
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        applyFilters();
    });
}

// ---------- Dark/Light mode ----------
function initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || (!savedTheme && !prefersDark)) {
        document.body.classList.add('light');
        themeToggle.textContent = '🌙';
    } else {
        themeToggle.textContent = '☀️';
    }
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light');
        const isLight = document.body.classList.contains('light');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        themeToggle.textContent = isLight ? '🌙' : '☀️';
    });
}

// ---------- Feed Manager ----------
function saveFeeds() {
    localStorage.setItem('customFeeds', JSON.stringify(feeds));
    renderCustomFeeds();
    refreshNews(); // reload news with new feed list
}

function renderCustomFeeds() {
    const html = feeds.map((feed, index) => `
        <div class="custom-feed-item">
            <span>${feed.name} (${feed.category})</span>
            <button onclick="removeFeed(${index})">🗑️</button>
        </div>
    `).join('');
    customFeedsDiv.innerHTML = html || '<p>No custom feeds added.</p>';
}

function removeFeed(index) {
    feeds.splice(index, 1);
    saveFeeds();
}

// Handle form submission
addFeedForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = document.getElementById('feed-url').value.trim();
    const name = document.getElementById('feed-name').value.trim();
    const category = document.getElementById('feed-category').value;
    const country = document.getElementById('feed-country').value;
    if (!url || !name || !category || !country) return;
    feeds.push({ url, name, category, country });
    saveFeeds();
    addFeedForm.reset();
});

// Refresh all news
async function refreshNews() {
    newsGrid.innerHTML = '<p class="loading">Fetching latest intelligence...</p>';
    allArticles = await fetchAllFeeds();
    filteredArticles = [...allArticles];
    renderCards();
    renderTrending();
    renderDailyBrief();
}

// Make removeFeed globally accessible
window.removeFeed = removeFeed;

// ---------- Initialize ----------
async function init() {
    initTheme();
    setupFilters();
    renderCustomFeeds();
    await refreshNews();
}

document.addEventListener('DOMContentLoaded', init);