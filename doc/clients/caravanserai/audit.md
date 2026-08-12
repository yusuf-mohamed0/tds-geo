> Dashboard: [Kivo Geo Dashboard](../../DASHBOARD.md)
>
# Caravanserai Design — Site Audit

Date: 2026-07-08
Source: https://caravanserai-design.com/

---

## Product Overview

| Metric | Value |
|---|---|
| **Total Products** | **229** |
| **Total Collections** | **32** (23 functional + 9 curated "Look" collections) |
| **Price Range** | EGP 1,450 - EGP 65,000 |
| **Theme** | Release v2.0.4+listings (Shopify Theme Store #2698) |
| **Font** | Fahkwang (sans-serif, all weights 400-700) |
| **Currency** | EGP only |
| **Primary Colors** | White (#FFFFFF), Deep Red (#8D2729), Dark (#111111), Warm Beige (#E9E8E0, #F4F1EB), Olive (#6B7050), Grey (#6C7775) |

### Categories

| Category | Subcategories |
|---|---|
| **Accessories** | Mirrors, Hooks & Holders, Décor, Candleholders & Lanterns, Pendants |
| **Bedroom** | Beds, Bedside Table, Dresser, Chest of Drawers |
| **Livingroom** | Sofa, Coffee Table, Side Table, Cupboard, TV Unit, Accent Chair, Box, Book Case |
| **Dining Room** | Dining Table, Dining Table Chair, Buffet, Bar |
| **Lighting** | Chandeliers, Table Lamps, Floor Lamps, Wall Lamp, Ceiling Lamp |

### Collections

- Functional: `/collections/hangers`, `/mirror`, `/table`, `/best-sellers`, `/collage-collection`, `/table-lamps`, `/decor`, `/tableware`, `/candleholders-lanterns`, `/sconce`, `/arm-chair`, `/sofa`, `/bedside-table`, `/console`, `/cupboard`, `/coffee-table`, `/box`, `/tv-unit`, `/buffet`, `/brass-collection`, `/ramadan`, `/chandelier`, `/dining-table`
- Curated Looks: `/collections/look-1` through `/look-9`

---

## Critical Issues (Fix Immediately)

### 1. Broken Navigation Links
~18 navigation links point to `#` (dead ends):
- Beds, Dresser, Chest of Drawers, Dining Table, Dining Table Chair
- Chandeliers, Table Lamps, Floor Lamps, Wall Lamp, Ceiling Lamp
- Book Case, Pendants, Bar
- "Be Inspired" top-level link

### 2. Raw HTML in Image Alt Attributes
Banner images have markup leaked into alt text:
```html
alt="<p>Discover our products and find inspiration.</p>"
alt="<p>Prepare Your Home for Gathering <br/></p>"
```
Accessibility violation + bad for SEO.

### 3. Wrong Instagram Link on About Page
About page Instagram link points to `instagram.com/digifist` instead of `instagram.com/caravanseraidesign`.

### 4. Footer Typo
"Descover" appears twice in footer instead of "Discover".

### 5. Popular Search Typo
"Collage Colelction" — "Colelction" is misspelled.

---

## SEO Weaknesses

| Issue | Severity |
|---|---|
| **Title tags** — all default Shopify format (`Product Name – Craftsmanship`, `Products – Craftsmanship`, `News – Craftsmanship`). No keywords, no value props. | Critical |
| **Meta descriptions** — none exist on any page | Critical |
| **URL slugs** — not keyword-optimized (`/bird-2` should be `/brass-bird-decorative-figure`) | High |
| **Product schema** — no Product, Organization, FAQ, BreadcrumbList, or BlogPosting schema | High |
| **Blog** — ~80 posts, active (weekly), but no author bylines, no categories, no internal product links | Medium |
| **Alt text** — product images use filename-level alt, not descriptive; decorative images have empty alt | Medium |
| **Heading structure** — product pages have no H2 content hierarchy beyond basic sections | Medium |

---

## Content Weaknesses

| Issue | Severity |
|---|---|
| **Product descriptions** — 2-3 sentences of specs. No storytelling, use cases, styling tips, or emotional hooks. | Critical |
| **No reviews/ratings** — zero customer reviews on any product | Critical |
| **No care instructions in product copy** — only generic accordion | Medium |
| **No sizing guides or material origin stories** | Medium |
| **Blog posts don't link to products** — missed conversion opportunity | Medium |
| **About page** — strong foundation but no founder photos, workshop behind-the-scenes, press mentions, or customer stats | Low |
| **No FAQ content on product pages** | Low |
| **No comparison against competitors** | Low |

---

## UX Weaknesses

| Issue | Severity |
|---|---|
| **Mega-menu with dead-end links** — ~18 `#` links | Critical |
| **No breadcrumbs** on most pages | Medium |
| **"Be Inspired" label** — vague, non-standard | Low |
| **No shipping cost estimator or free shipping threshold** | Medium |
| **No wishlist/save-for-later** | Medium |
| **Currency selector modal** — huge country list is disruptive | Low |
| **Testimonials** — only 4, buried below fold, not on product pages | Medium |

---

## Conversion Weaknesses

| Issue | Severity |
|---|---|
| **Zero product reviews** — massive trust gap | Critical |
| **No urgency triggers** — no low-stock, countdown, or "X viewing" indicators | High |
| **No trust badges** — no return policy summary, guarantee, secure checkout on product pages | High |
| **No abandoned cart recovery** — no exit-intent, email capture, or WhatsApp recovery | High |
| **No quantity discounts or bundles** — "Frequently bought together" missing | Medium |
| **Returns policy hidden in footer** | Medium |

---

## Brand/Messaging Weaknesses

| Issue | Severity |
|---|---|
| **Brand story not explained** — "Caravanserai" (inn for travelers) never defined | Medium |
| **No "why buy from us" above the fold** | Medium |
| **Product pages have zero brand voice** — just specs | High |
| **Price range confusion** — LE 650 to LE 65,000 with no explanation | Medium |
| **Instagram link wrong on About page** | Critical |
| **No press/"As seen in" badges** despite being founded in 1996 | Medium |

---

## Quick-Fix Priority List

1. Fix `#` navigation links (create missing category pages or remove links)
2. Fix banner image alt text (remove raw HTML)
3. Fix Instagram link on About page
4. Fix "Descover" typo in footer
5. Fix "Colelction" typo in popular searches
6. Add meta descriptions to all pages
7. Add Product schema markup
8. Enable product reviews
9. Add urgency elements (low stock badges)
10. Add value proposition banner above the fold

---

## All Product URLs (229)

```
https://caravanserai-design.com/products/4-bird-hanger
https://caravanserai-design.com/products/aisha
https://caravanserai-design.com/products/ali-baba-sconce
https://caravanserai-design.com/products/aluminum-hand-hanger
https://caravanserai-design.com/products/andalusian-wall-hook
https://caravanserai-design.com/products/ants-life
https://caravanserai-design.com/products/arkaline-coffee-table
https://caravanserai-design.com/products/arket-book-holder
https://caravanserai-design.com/products/arket-mirror-handcrafted-chain
https://caravanserai-design.com/products/arket-mirror-islamic-style
https://caravanserai-design.com/products/arket-nesting-table
https://caravanserai-design.com/products/artevo-tv-unit
https://caravanserai-design.com/products/artistic-collage-side-table
https://caravanserai-design.com/products/artistic-collage-side-table-large
https://caravanserai-design.com/products/asala-armchair
https://caravanserai-design.com/products/back-scratcher
https://caravanserai-design.com/products/balli-sconce
https://caravanserai-design.com/products/belle-sofa
https://caravanserai-design.com/products/big-box-sconce
https://caravanserai-design.com/products/big-c-stand
https://caravanserai-design.com/products/bird
https://caravanserai-design.com/products/bird-1
https://caravanserai-design.com/products/bird-2
https://caravanserai-design.com/products/bird-book-hanger
https://caravanserai-design.com/products/bird-hanger
https://caravanserai-design.com/products/bird-hanger-1
https://caravanserai-design.com/products/bird-stand
https://caravanserai-design.com/products/bird-table-lamp
https://caravanserai-design.com/products/bondoka-table-large-1
https://caravanserai-design.com/products/bondoka-table-small
https://caravanserai-design.com/products/bonoos-ashtray
https://caravanserai-design.com/products/book-holder
https://caravanserai-design.com/products/book-holder-1
https://caravanserai-design.com/products/borneta-table-lamp
https://caravanserai-design.com/products/botanical-side-table
https://caravanserai-design.com/products/bowl-s
https://caravanserai-design.com/products/bowl-xs
https://caravanserai-design.com/products/brass-hanger-4
https://caravanserai-design.com/products/brass-snail
https://caravanserai-design.com/products/brass-stand-allah
https://caravanserai-design.com/products/brass-stand-aura-allah
https://caravanserai-design.com/products/brass-stand-masha-allah
https://caravanserai-design.com/products/butterfly-mirror
https://caravanserai-design.com/products/calmera-slipper-chair
https://caravanserai-design.com/products/cane-nesting-table
https://caravanserai-design.com/products/caroline-armchair
https://caravanserai-design.com/products/caroline-cane-armchair
https://caravanserai-design.com/products/caroline-cane-sofa
https://caravanserai-design.com/products/carved-handle-wooden-buffet
https://caravanserai-design.com/products/carved-side-table-set
https://caravanserai-design.com/products/chaos-engraved-side-table
https://caravanserai-design.com/products/chihoma-armchair
https://caravanserai-design.com/products/climbing-man
https://caravanserai-design.com/products/collage-bowl-3
https://caravanserai-design.com/products/collage-candle-holder-red
https://caravanserai-design.com/products/collage-coffee-table-1
https://caravanserai-design.com/products/collage-hat-stand
https://caravanserai-design.com/products/collage-sconce
https://caravanserai-design.com/products/collage-stand
https://caravanserai-design.com/products/collage-table-lamp
https://caravanserai-design.com/products/collage-tissue-box-holder-blue
https://caravanserai-design.com/products/collage-tissue-cube
https://caravanserai-design.com/products/collage-turtle
https://caravanserai-design.com/products/cone-sconce
https://caravanserai-design.com/products/cone-table-lamp
https://caravanserai-design.com/products/contemplation-brass-table-lamp
https://caravanserai-design.com/products/crescent-ashtray-large
https://caravanserai-design.com/products/cubic-commode
https://caravanserai-design.com/products/curved-brass-table
https://caravanserai-design.com/products/cwicker-cage-table-lamp
https://caravanserai-design.com/products/daff-chandelier
https://caravanserai-design.com/products/daisy-sofa
https://caravanserai-design.com/products/dalia-coffee-table-pendant
https://caravanserai-design.com/products/dalia-coffee-table-ring
https://caravanserai-design.com/products/darb-console
https://caravanserai-design.com/products/darbar-armchair
https://caravanserai-design.com/products/dawair-brass-table
https://caravanserai-design.com/products/desert-sun-wall-hook
https://caravanserai-design.com/products/dina
https://caravanserai-design.com/products/diwan-sofa
https://caravanserai-design.com/products/dog-door-stopper
https://caravanserai-design.com/products/dome-glass-lantern-lamp
https://caravanserai-design.com/products/dual-beam-lamp
https://caravanserai-design.com/products/el-tawil-armchair
https://caravanserai-design.com/products/fatimas-hand-chaos-energy-hook
https://caravanserai-design.com/products/fatimas-hand-geometric-hook
https://caravanserai-design.com/products/fatimas-hand-hollow-golden-hook
https://caravanserai-design.com/products/fatimas-hand-mystic-hook
https://caravanserai-design.com/products/fatimas-hand-naqsha
https://caravanserai-design.com/products/fatimas-hand-quranic-hook
https://caravanserai-design.com/products/fatimas-hand-sacred-eye-hook
https://caravanserai-design.com/products/fatimas-hand-stand-geometric
https://caravanserai-design.com/products/fatimas-hand-stand-quranic-hanger
https://caravanserai-design.com/products/fatimas-hand-zahra
https://caravanserai-design.com/products/fatimas-hand-zahra-hook
https://caravanserai-design.com/products/fatmas-hand-hanger
https://caravanserai-design.com/products/floral-orb-brass-lamp
https://caravanserai-design.com/products/floral-rectangle-mirror
https://caravanserai-design.com/products/floral-rectangle-mirror-1
https://caravanserai-design.com/products/floral-round-mirror
https://caravanserai-design.com/products/flora-table-lamp
https://caravanserai-design.com/products/flower-hanger
https://caravanserai-design.com/products/france-armchair
https://caravanserai-design.com/products/france-sofa
https://caravanserai-design.com/products/frilla-sconce
https://caravanserai-design.com/products/fulla-commode
https://caravanserai-design.com/products/full-harba-book-holder
https://caravanserai-design.com/products/geco
https://caravanserai-design.com/products/geometric-square-sconce
https://caravanserai-design.com/products/glasora-coffee-table
https://caravanserai-design.com/products/glass-mosmar-dining-table
https://caravanserai-design.com/products/globe
https://caravanserai-design.com/products/gold-leaf-cupboard
https://caravanserai-design.com/products/half-dome-table-lamp-islamic
https://caravanserai-design.com/products/half-dome-table-lamp-islamic-1
https://caravanserai-design.com/products/half-dome-table-lamp-symmetry-series
https://caravanserai-design.com/products/hand-l
https://caravanserai-design.com/products/harba-hanger
https://caravanserai-design.com/products/harba-hanger-1
https://caravanserai-design.com/products/harba-toilet-paper-holder
https://caravanserai-design.com/products/hawaiian-stilt-bird
https://caravanserai-design.com/products/hawaiian-stilt-bird-candle-holder
https://caravanserai-design.com/products/hoda
https://caravanserai-design.com/products/hot-plate-base
https://caravanserai-design.com/products/indian-ashtray-small-1
https://caravanserai-design.com/products/indian-sconce
https://caravanserai-design.com/products/iwan-tv-unit
https://caravanserai-design.com/products/jaras-chandelier
https://caravanserai-design.com/products/jardin-cupboard
https://caravanserai-design.com/products/jerry-frame
https://caravanserai-design.com/products/jerry-table-lamp
https://caravanserai-design.com/products/kaf-fatma-ashtray
https://caravanserai-design.com/products/kamar-dining-table-chair
https://caravanserai-design.com/products/kedra-orb-brass-lamp
https://caravanserai-design.com/products/keff-dining-table-chair
https://caravanserai-design.com/products/kemo-armchair
https://caravanserai-design.com/products/knobita-commode
https://caravanserai-design.com/products/kura-chandelier
https://caravanserai-design.com/products/lamasia-sofa
https://caravanserai-design.com/products/lamora-sofa
https://caravanserai-design.com/products/legacy-brass-3-keys-set
https://caravanserai-design.com/products/legacy-iron-keys
https://caravanserai-design.com/products/loza-sconce
https://caravanserai-design.com/products/mandala-green-cupboard
https://caravanserai-design.com/products/mandala-sun-cupboard
https://caravanserai-design.com/products/marrakech-dresser
https://caravanserai-design.com/products/metal-box
https://caravanserai-design.com/products/minimalist-rectangle-mirror
https://caravanserai-design.com/products/mirralloy-coffee-table
https://caravanserai-design.com/products/mirraring-coffee-table
https://caravanserai-design.com/products/mirror-balls
https://caravanserai-design.com/products/mixed-geometric-mirror
https://caravanserai-design.com/products/mosmar-dining-table
https://caravanserai-design.com/products/mother-of-pearl
https://caravanserai-design.com/products/mother-of-pearl-coffee-table
https://caravanserai-design.com/products/mouse
https://caravanserai-design.com/products/nabaty-cupboard
https://caravanserai-design.com/products/novara-console
https://caravanserai-design.com/products/nuba-box
https://caravanserai-design.com/products/ola-coffee-table
https://caravanserai-design.com/products/oyma-dresser
https://caravanserai-design.com/products/palm-ashtray
https://caravanserai-design.com/products/parcham-coffee-table
https://caravanserai-design.com/products/parquet-coffee-table
https://caravanserai-design.com/products/paw-side-table
https://caravanserai-design.com/products/petra-cabinet
https://caravanserai-design.com/products/pharax-coffee-table
https://caravanserai-design.com/products/pharax-console
https://caravanserai-design.com/products/pharax-side-table
https://caravanserai-design.com/products/pharax-tv-unit
https://caravanserai-design.com/products/pigeon
https://caravanserai-design.com/products/pigeon-brass-table-lamp
https://caravanserai-design.com/products/pomegranate-l
https://caravanserai-design.com/products/qorsa-brass-coffee-table
https://caravanserai-design.com/products/quadra-book-case
https://caravanserai-design.com/products/recta-sconce
https://caravanserai-design.com/products/rouge-bar
https://caravanserai-design.com/products/rozetta-cupboard
https://caravanserai-design.com/products/rubat-coffee-table
https://caravanserai-design.com/products/rubat-console
https://caravanserai-design.com/products/rubat-tv-unit
https://caravanserai-design.com/products/salad-serving-spoons
https://caravanserai-design.com/products/sally-sconce
https://caravanserai-design.com/products/samara
https://caravanserai-design.com/products/samia
https://caravanserai-design.com/products/sanduku-coffee-table
https://caravanserai-design.com/products/scala-console
https://caravanserai-design.com/products/s-coop-table-lamp
https://caravanserai-design.com/products/shadow-table-lamp
https://caravanserai-design.com/products/side-table-stand-lamp
https://caravanserai-design.com/products/silent-bowl
https://caravanserai-design.com/products/sola-table-lamp
https://caravanserai-design.com/products/songbirds-hanger
https://caravanserai-design.com/products/soso-table-lamp
https://caravanserai-design.com/products/spot-stand
https://caravanserai-design.com/products/spot-table-lamp
https://caravanserai-design.com/products/square-cane-armchair
https://caravanserai-design.com/products/stars-sconce
https://caravanserai-design.com/products/std2102
https://caravanserai-design.com/products/stencil-bowl-red
https://caravanserai-design.com/products/stencil-side-table
https://caravanserai-design.com/products/stencil-table-lamp
https://caravanserai-design.com/products/studio-coffee-table
https://caravanserai-design.com/products/sun-hanger
https://caravanserai-design.com/products/sun-hanger-1
https://caravanserai-design.com/products/sun-plate-1
https://caravanserai-design.com/products/tabaqat-coffee-table
https://caravanserai-design.com/products/tabla-m-table-small
https://caravanserai-design.com/products/tabla-table-large
https://caravanserai-design.com/products/tabya-coffeetable
https://caravanserai-design.com/products/tabya-side-table
https://caravanserai-design.com/products/taj-ashtray
https://caravanserai-design.com/products/tambour-coffee-table
https://caravanserai-design.com/products/tang-bedside-table
https://caravanserai-design.com/products/tannoura-magazine-unit
https://caravanserai-design.com/products/tau-coffee-table
https://caravanserai-design.com/products/tawc-side-table
https://caravanserai-design.com/products/tier-tray
https://caravanserai-design.com/products/toringilla-table-lamp
https://caravanserai-design.com/products/tree-lead-toilet-papaer-holder
https://caravanserai-design.com/products/triangles-square-sconce
https://caravanserai-design.com/products/tulip-sconce
https://caravanserai-design.com/products/tweet-hanger
https://caravanserai-design.com/products/uno-commode
https://caravanserai-design.com/products/uzan-coffee-table
https://caravanserai-design.com/products/v-sofa
https://caravanserai-design.com/products/wadi-bedside-table
https://caravanserai-design.com/products/wadii-chest
https://caravanserai-design.com/products/weza-armchair
https://caravanserai-design.com/products/wicker-globe-table-lamp
https://caravanserai-design.com/products/wooden-bowl-with-birds
https://caravanserai-design.com/products/wooden-box
https://caravanserai-design.com/products/wooden-lazy-susan-small
https://caravanserai-design.com/products/wooden-scoop
https://caravanserai-design.com/products/woven-wicker-table-lamp
https://caravanserai-design.com/products/zahr-chest
https://caravanserai-design.com/products/zamania-bowl
https://caravanserai-design.com/products/zamania-cheese-board
https://caravanserai-design.com/products/zamania-lazy-suzan
https://caravanserai-design.com/products/zamania-salad-set
https://caravanserai-design.com/products/zamora-table-lamp
https://caravanserai-design.com/products/zizi
https://caravanserai-design.com/products/zoma-coffee-table
https://caravanserai-design.com/products/zoma-console
https://caravanserai-design.com/products/zoma-edge-table
```

---

*Audit saved to doc/clients/caravanserai/audit.md*
