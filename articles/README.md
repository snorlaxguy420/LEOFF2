## Articles Folder Guide

`ui/articles/` is the single source of truth for published article pages, shared article styling, and SEO templates.

This top-level `articles/` folder is now reserved for legacy compatibility files and raw/source article materials such as notes, drafts, and reference images.

Rules:

- Publish article HTML pages in `ui/articles/`
- Keep the shared published article stylesheet in `ui/articles/article.css`
- Keep article templates and SEO guidance in `ui/articles/`
- Do not add new published article pages to `articles/`
- If an old `articles/*.html` URL must keep working, use a redirect stub that points to the matching page in `ui/articles/`
