# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

This is the **import-configurations** repository containing configuration import data organized by country code (at, au, be, br, ca, ch, cz, de, es, etc.) and domain (firefly-iii, etc.).

## Installed Skills

### ui-ux-pro-max
AI-powered design intelligence toolkit with:
- **84 UI styles** - Glassmorphism, minimalism, brutalism, etc.
- **161 color palettes** - Product type-specific color schemes
- **73 font pairings** - Google Fonts typography combinations
- **99 UX guidelines** - Best practices and anti-patterns
- **25 chart types** - Data visualization recommendations
- **17 tech stacks** - HTML/Tailwind, React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, shadcn/ui, and more

**Location:** `.claude/skills/ui-ux-pro-max-skill/`

**Usage Examples:**
```bash
# Search UI styles
python3 .claude/skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "dashboard" --domain style

# Search color palettes
python3 .claude/skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "e-commerce" --domain color

# Search typography
python3 .claude/skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "modern" --domain typography

# Search with design system parameters
python3 .claude/skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "SaaS dashboard" --design-system --variance 8 --motion 6 --density 5
```

**Available Skill Commands:**
- `/ui-ux-pro-max` - UI/UX design intelligence
- `/ui-styling` - Create accessible interfaces with shadcn/ui + Tailwind
- `/design-system` - Token architecture and component specs
- `/banner-design` - Social media and web banner design
- `/brand` - Brand voice and visual identity
- `/slides` - Strategic HTML presentations with Chart.js
- `/design` - Comprehensive design capabilities (logo, branding, icons, etc.)

## Working with This Repository

When working on UI/UX improvements or adding design elements:
1. Use the `ui-ux-pro-max` skill for design guidance
2. Use `ui-styling` for implementing interfaces
3. Use `/design-system` for consistent design tokens
4. Check the search command examples above for quick lookups

## Development Branch

Current development branch: `claude/install-ui-ux-pro-max-kovxdz`

Always create feature branches for new work and push to this branch.
