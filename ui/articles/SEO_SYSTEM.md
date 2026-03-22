# Article SEO System

Use this system for every published article in `ui/articles/`.

## Required head tags

- `title`
- `meta description`
- `meta keywords`
- `meta author`
- `meta robots`
- `canonical`
- Open Graph:
  - `og:type`
  - `og:site_name`
  - `og:title`
  - `og:description`
  - `og:url`
  - `og:image`
- Twitter:
  - `twitter:card`
  - `twitter:title`
  - `twitter:description`
  - `twitter:image`
- JSON-LD `Article` schema

## Required content structure

- One clear `h1`
- Descriptive article dek near the top
- At least 4-5 section anchors in the sidebar
- At least 2 internal article links when relevant
- At least 1 internal product link when relevant
- A source section using primary sources when possible

## URL and slug rule

- Use lowercase hyphenated slugs
- Match canonical and intended production article URL

## Image rule

- Every article should have either:
  - a share image in metadata, or
  - a page graphic/figure inside the article, ideally both

## Files to start from

- Layout template: `ui/articles/article-template.html`
- Shared stylesheet: `ui/articles/article.css`

