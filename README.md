# StaticVault931 - Your Personal Cinema

**[Open StaticVault931](https://staticvault931.github.io/)**

A browser-based discovery and personalization app for movies, TV shows, and anime. It uses a static frontend, requires no account, and stores profile data locally in the browser.

## Features

- **Browse** movies, TV shows, and anime across curated and personalized rows
- **Search** with aliases, spell correction, fuzzy matching, actor search, advanced filters, multi-service inclusion, service blocking, and an Everything browser
- **Profiles** with separate preferences, history, statistics, avatars, and Kid-Guided Mode
- **For You** recommendations based on likes, watch history, genres, languages, actors, and viewing signals
- **Library** with watchlist, likes, watched history, recent activity, provider browsing, and Mix & Match
- **Mix & Match** to blend two to five movies or shows into combined recommendations
- **Clips** with a personalized, scrollable trailer feed
- **Multiple video sources** with source switching, health checks, and sandbox controls
- **Hover trailers** and full information pages with cast, collections, ratings, providers, and related content
- **Themes and accessibility controls** including reduced motion, contrast, text sizing, and larger targets
- **Keyboard navigation** and shortcuts. Press `?` to see the current shortcut list
- **Responsive layouts** for desktop, tablet, and mobile

## How to Use

Visit **[staticvault931.github.io](https://staticvault931.github.io/)**. No login or account is required.

### Quick Navigation

| Key | Action |
|-----|--------|
| `/` or `F` | Open search |
| `?` | Show keyboard shortcuts |
| `H` | Home |
| `L` | Library |
| `T` | Cycle theme |
| Left / Right | Scroll the hovered row or change hero slide |
| `Esc` | Close the active modal |

### Finding Content

- Search by title, actor, provider, genre, language, year, rating, runtime, or availability
- Browse Movies, TV Shows, Anime, provider catalogs, or the Everything database view
- Tune recommendations in Customize Feed
- Blend titles in Library > Mix & Match
- Use Clips for trailer-led discovery

### Watching

1. Open a title card or information page.
2. Select Play to open the active video source.
3. If a source fails, select Try Next Source or use automatic source switching.
4. For TV shows, choose the season and episode from the player panel.

## Data and Privacy

- Profiles, preferences, watch history, saved titles, search history, row statistics, and usage statistics are stored locally using browser storage.
- No StaticVault account or hosted user database is required.
- Google Analytics 4 is used for aggregate site analytics and may set cookies.
- Metadata comes from services including [TMDB](https://www.themoviedb.org/) and [AniList](https://anilist.co/).
- Video content is embedded from independent third-party providers. Ads and external tracking may appear and are outside StaticVault931's control.

See the in-app Privacy Policy for the current list of stored data and third-party services.

## Project Structure

- `index.html` - static application shell and route containers
- `src/js/` - application, profiles, search, recommendations, player, routing, and statistics modules
- `src/js/search/` - normalization, aliases, fuzzy matching, ranking, indexing, and spell correction
- `src/js/rows/` - row registry, selection, cooldown, and engagement systems
- `src/styles/` - base, layout, component, responsive, and information-page styles
- `src/data/` - search aliases and dictionary data
- `assets/icons/` - SVG favicon for modern browsers and PNG fallback for Apple touch icons and social previews

## Local Development

```powershell
npm install
npm run serve
```

Run checks with:

```powershell
npm run lint
npm test
```

## Credits

Made by [StaticQuasar931](https://sites.google.com/view/staticquasar931/gm3z). Design credit: [Luuk](https://www.delirealms.store/).

StaticVault931 does not host media files. Playback is provided by independent third-party embed services.
