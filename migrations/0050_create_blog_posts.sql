-- Blog posts table for SEO articles
CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '📝',
    cover_image_url TEXT,
    reading_time TEXT NOT NULL DEFAULT '5 min de leitura',
    sections TEXT NOT NULL DEFAULT '[]',
    cta_text TEXT DEFAULT 'Teste grátis por 30 dias',
    cta_href TEXT DEFAULT '/landing/#cadastro',
    published INTEGER NOT NULL DEFAULT 0,
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_published ON blog_posts(published, published_at);
