# Shadow Workipedia Wiki

This directory contains full wiki articles for Shadow Work's issues and systems.

## Structure

```
wiki/
├── issues/           # Full articles for each issue
├── systems/          # Documentation for simulation systems
├── images/           # Shared images referenced in articles
├── _TEMPLATE.md      # Templates for new articles
└── README.md         # This file
```

## Writing Articles

### Creating a New Issue Article

1. Copy `wiki/issues/_TEMPLATE.md` to `wiki/issues/your-issue-slug.md`
2. Fill in the frontmatter (metadata between `---` markers)
3. Write content using the template sections as a guide
4. Add images to `wiki/images/` and reference them with relative paths
5. Run `pnpm extract-data` to regenerate the data file

### Creating a New System Article

1. Copy `wiki/systems/_TEMPLATE.md` to `wiki/systems/your-system-slug.md`
2. Follow the same process as issue articles

## Frontmatter Fields

### Issue Articles

```yaml
---
id: issue-slug           # Kebab-case identifier (must match filename)
title: Issue Title       # Display name
number: 42              # Issue number from catalog
category: Economic      # One of: Economic, Social, Political, etc.
urgency: Critical       # Critical, High, Medium, Low, Latent
tags: [tag1, tag2]      # Array of tags
publicConcern: 85       # 0-100 scale
economicImpact: 90      # 0-100 scale
socialImpact: 80        # 0-100 scale
affectedSystems: []     # Array of system slugs
connections: []         # Array of related issue slugs
editedBy: Author        # Who last edited
lastUpdated: 2025-11-24 # ISO date
---
```

### System Articles

```yaml
---
id: system-slug              # Kebab-case identifier
title: System Name          # Display name
domain: Simulation          # Domain category
connectionCount: 25         # Number of connections
relatedSystems: []          # Array of system slugs
affectedIssues: []          # Array of issue slugs
implementationStatus: Live  # Live, Partial, Planned
editedBy: Author            # Who last edited
lastUpdated: 2025-11-24     # ISO date
---
```

## Markdown Guidelines

### Headers

Use `##` for main sections (H2), `###` for subsections (H3), etc.
The article title (`#`) is auto-generated from the frontmatter.

### Links

- **Internal links** (to other wiki pages): `[Issue Name](#)` (will be fixed in rendering)
- **External links**: Standard markdown `[Link Text](https://url.com)`
- **Edit links**: Auto-generated at bottom of each article

### Images

```markdown
![Alt text](/wiki/images/image-name.jpg)
```

Images should be:
- Optimized (WebP when possible)
- Reasonable size (<500KB)
- Descriptive filenames

### Code Blocks

Use triple backticks with language:

```typescript
// Example code
const example = "value";
```

### Tables

```markdown
| Column 1 | Column 2 |
|----------|----------|
| Data     | Data     |
```

### Quotes

```markdown
> "Quote text"
> — Source attribution
```

## Content Guidelines

### Tone

- **Informative**: Provide facts and context
- **Neutral**: Avoid advocacy or bias
- **Accessible**: Write for general audience, define technical terms
- **Engaging**: Use examples and real-world connections

### Structure

Follow the template structure:
1. **Overview**: Brief summary (2-3 sentences)
2. **Background**: Historical and current context
3. **In Shadow Work**: Game mechanics and strategy
4. **Real-World Context**: Statistics and examples
5. **Related Content**: Connections to other articles

### Citations

- Include sources for statistics and quotes
- Use reputable sources (academic, official reports, major news)
- Add full citations in References section
- Use inline attribution for quotes

### Game Content

When describing game mechanics:
- Be specific about parameter effects
- List event types that can trigger
- Explain cascading effects
- Give strategic advice for different game phases

## Building the Site

After adding or editing articles:

```bash
# Extract data (includes wiki articles)
pnpm extract-data

# Build site
pnpm build

# Test locally
pnpm dev
```

## Example Articles

See `wiki/issues/water-privatization-wars.md` for a complete example.

## Need Help?

- Check the templates in `_TEMPLATE.md`
- Review the example article
- Ask in GitHub discussions
- Open an issue for questions

---

**Remember**: Articles are version controlled in git. All changes are tracked. Don't be afraid to edit and improve existing articles!