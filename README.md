# StaticVault931 — Your Personal Cinema

**[→ Open StaticVault931](https://staticvault931.github.io/)**

A fast, clean streaming discovery platform for movies, TV shows, and anime — built with vanilla HTML, CSS, and JavaScript. No bundler, no framework, no backend. Everything runs in the browser.

---

## Features

- **Browse** trending movies, TV shows, and anime across curated rows
- **Search** with fuzzy matching, keyword fallback, and instant results
- **For You** — personalized recommendations based on what you like and watch
- **Continue Watching** — pick up right where you left off
- **Watchlist & Likes** — save and organize your favorites
- **Mark as Watched** — hide content you've already seen
- **Multiple Providers** — VidSrc, 2Embed, SuperEmbed, AutoEmbed, VidLink, and more
- **Auto-switching** — if a source fails, the next one loads automatically
- **Hover Trailers** — hover a card for 1.5s to preview the trailer
- **Themes** — Dark, Light, Midnight, and Warm
- **Customize Your Feed** — set preferred genres, content rating, and titles you love/dislike
- **Keyboard shortcuts** — navigate without lifting your hands (press `?` to see them)
- **Fully responsive** — works on desktop and mobile

---

## How to Use

Visit **[staticvault931.github.io](https://staticvault931.github.io/)** — no login required, no account needed.

### Navigation
| Key | Action |
|-----|--------|
| `/` | Open search |
| `?` | Show keyboard shortcuts |
| `H` | Go home |
| `L` | Go to Library |
| `T` | Cycle theme |
| `← / →` | Previous / next hero slide |
| `Esc` | Close modal |

### Finding Content
- Use the **Search** page to find movies, shows, and anime
- Browse by category (Movies, TV Shows, Anime) from the nav
- The **For You** row updates based on your likes and preferences
- Visit **Customize Feed** to tune your genres and content rating

### Watching
1. Click any card to open its detail modal
2. Hit **Play** — content streams via the active provider
3. If a source doesn't load, click **Try Next Source** or wait for auto-switch
4. For TV shows, pick your season and episode from the right panel
5. Use the panel toggles (top of modal) to maximize the player

---

## Providers

StaticVault931 uses third-party embed providers to stream content. These providers operate independently — we don't host any media.

| Provider | Priority |
|----------|----------|
| VidSrc | High |
| 2Embed | High |
| SuperEmbed | High |
| AutoEmbed | Medium |
| VidLink | Medium |
| VidSrc Pro | Medium |
| Cineby | Medium |
| Videasy | Low |

Different providers may work better depending on your location and browser. If one doesn't load, try the next.

---

## Data & Privacy

- All data is stored **locally in your browser** (localStorage/sessionStorage)
- No account, no tracking, no server
- Content metadata is fetched from [TMDB](https://www.themoviedb.org/) and [AniList](https://anilist.co/)
- Video content is embedded from third-party providers — ads may appear and are outside our control

---

## Technical Stack

- **Vanilla JS** — ES modules, no framework
- **TMDB API** — movie/TV metadata, images, ratings
- **AniList GraphQL API** — anime metadata
- **GitHub Pages** — static hosting, zero backend
- **Material Icons** — UI icons
- **Nunito + Bebas Neue** — typography

---

## Credits

Made by [StaticQuasar931](https://sites.google.com/view/staticquasar931/gm3z)  
Design by [Luuk](https://www.delirealms.store/)

---

*StaticVault931 does not host any media. All content is provided by third-party embed services.*
