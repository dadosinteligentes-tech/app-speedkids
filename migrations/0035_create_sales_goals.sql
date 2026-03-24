-- Sales goals for gamification
CREATE TABLE IF NOT EXISTS sales_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('revenue', 'rental_count', 'product_sale_count')),
    period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'custom')),
    target_value INTEGER NOT NULL,
    user_id INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sales_goals_tenant ON sales_goals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_goals_user ON sales_goals(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sales_goals_period ON sales_goals(tenant_id, start_date, end_date);

-- Track goal achievements (celebrations already shown)
CREATE TABLE IF NOT EXISTS goal_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    achieved_at TEXT NOT NULL DEFAULT (datetime('now')),
    achieved_value INTEGER NOT NULL,
    FOREIGN KEY (goal_id) REFERENCES sales_goals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(goal_id, user_id)
);

-- Add goals permissions
INSERT INTO permissions (key, label, description, category, sort_order) VALUES
    ('goals.manage', 'Gerenciar metas', 'Criar, editar e excluir metas de vendas', 'Metas', 16),
    ('goals.view',   'Visualizar metas', 'Ver progresso das metas de vendas', 'Metas', 17);

-- Owner and manager can manage goals
INSERT INTO role_permissions (role, permission_key) VALUES
    ('owner', 'goals.manage'),
    ('owner', 'goals.view'),
    ('manager', 'goals.manage'),
    ('manager', 'goals.view'),
    ('operator', 'goals.view');
