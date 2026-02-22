# Design System Documentation

## Overview
The "Zakys" design system focuses on a clean, modern, and feminine aesthetic suitable for a beauty and wellness scheduling application. It uses a soft pink palette with cream/white accents and vibrant rose highlights.

## Visual Identity

### Color Palette (Regra 60-30-10)

#### Primary Colors (Rosa Chá / Rosa Pastel) - 60%
Used for primary actions, active states, and brand highlights.
- **Primary 500:** `#ec4899` (Base Brand Color)
- **Primary 600:** `#db2777` (Hover State)
- **Primary 50:** `#fdf2f8` (Backgrounds/Light Accents)

#### Secondary Colors (Branco / Creme) - 30%
Used for backgrounds and secondary visual elements.
- **Secondary 500:** `#f5f0e8`

#### Accent Colors (Rosa Vibrante / Bordô) - 10%
Used for CTAs, promotions, and action highlights.
- **Accent 500:** `#f43f5e`
- **Accent 700:** `#be123c` (Bordô)
- **Accent 50:** `#fff1f2`

#### Neutrals
Used for text, backgrounds, and borders.
- **Gray 900:** `#171615` (Primary Text)
- **Gray 600:** `#5c5752` (Secondary Text)
- **Gray 50:** `#fefefe` (Backgrounds)
- **White:** `#ffffff` (Card/Container Backgrounds)

### Typography
**Font Family:** `Inter`, system-ui, sans-serif.

- **Headings:**
  - 4XL (`2.25rem`): Hero titles
  - 2XL (`1.5rem`): Section headers
  - XL (`1.25rem`): Card titles
- **Body:**
  - Base (`1rem`): Standard text
  - Small (`0.875rem`): Secondary text / Labels

## Components

### Buttons
Standardized button styles using CSS classes.

- **Current Styles:**
  - `.btn-primary`: Gradient background (Primary -> Secondary), White text.
  - `.btn-secondary`: Light background, Dark text, Bordered.
  - `.btn-outline`: Transparent background, Primary colored border.
  - `.btn-ghost`: Transparent background, no border.

### Forms
Clean, accessible form elements with specific focus states.

- **Inputs:** Rounded corners (`0.5rem`), gray borders. Focus state includes a Primary-colored ring.
- **Groups:** Standard spacing (`1rem`) between form groups.

### Cards
Used heavily for displaying Establishments and Services.

- **Styles:**
  - White background
  - Rounded corners (`1rem` or `1.5rem`)
  - Subtle shadow on rest, elevated shadow on hover
  - Transition effects on hover (`translateY`)

## Layouts

### Main Layout
Used for public-facing pages (Home, Search, Establishment Details).
- **Structure:**
  - Navbar (Logo, Navigation Links, Auth Buttons)
  - Main Content Area (`.container`)
  - Footer

### Admin Layout
Used for the administrative dashboard.
- **Structure:**
  - Sidebar Navigation
  - Header (User profile, Actions)
  - Dashboard Content Area

### Grid System
A 12-column inspired grid system using CSS Grid.
- Classes: `.grid`, `.grid-cols-1` to `.grid-cols-4`
- Responsive variants: `sm:`, `md:`, `lg:` prefixes.

## CSS Architecture
The project uses global CSS variables defined in `:root` for consistency.
- Variables cover: Colors, Spacing, Typography, Shadows, Transitions, Z-Index.
- Utility classes are available for common margins, padding, flexbox, and grid layouts.

## Email Templates

> **IMPORTANTE:** Ao modificar as cores do app, também atualize as cores nos templates de email em `server/services/emailService.js`.

### Arquivos que usam as cores do design system:
- `src/index.css` - CSS principal do app
- `server/services/emailService.js` - Templates de email HTML

### Cores usadas nos templates de email:
- **Header gradient:** `#ec4899` → `#db2777` (Primary)
- **Background:** `#fdf2f8` (Primary 50)
- **Texto destaque:** `#ec4899` (Primary 500)
- **Footer:** `#f5f0e8` (Secondary 500)
