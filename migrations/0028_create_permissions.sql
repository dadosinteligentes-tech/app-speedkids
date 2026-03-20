-- Permissions catalog
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Role-permission assignments
CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (role, permission_key),
    FOREIGN KEY (permission_key) REFERENCES permissions(key) ON DELETE CASCADE
);

-- Seed permissions catalog
INSERT INTO permissions (key, label, description, category, sort_order) VALUES
    ('rentals.manage',    'Gerenciar locacoes',      'Iniciar, parar, pausar e retomar locacoes',          'Locacoes',       1),
    ('rentals.extend',    'Estender locacoes',       'Estender tempo de locacoes ativas',                  'Locacoes',       2),
    ('products.sell',     'Vender produtos',         'Registrar vendas de produtos do catalogo',           'Produtos',       3),
    ('products.manage',   'Gerenciar produtos',      'Criar, editar e desativar produtos',                 'Produtos',       4),
    ('assets.manage',     'Gerenciar ativos',        'Criar, editar e excluir ativos (karts, etc.)',       'Ativos',         5),
    ('packages.manage',   'Gerenciar pacotes',       'Criar, editar e desativar pacotes de tempo',         'Pacotes',        6),
    ('customers.view',    'Visualizar clientes',     'Acessar lista e dados de clientes',                  'Clientes',       7),
    ('reports.view',      'Acessar relatorios',      'Ver secao de relatorios financeiros e operacionais', 'Relatorios',     8),
    ('reports.operators', 'Relatorio de operadores', 'Ver desempenho individual dos operadores',           'Relatorios',     9),
    ('cash.manage',       'Gerenciar caixa',         'Abrir e fechar caixa registradora',                  'Caixa',         10),
    ('shift.manage',      'Gerenciar turnos',        'Iniciar e encerrar turnos de trabalho',              'Turnos',        11),
    ('batteries.manage',  'Gerenciar baterias',      'Cadastrar, editar e controlar baterias',             'Baterias',      12),
    ('logs.view',         'Visualizar logs',         'Acessar logs de operacao do sistema',                'Logs',          13),
    ('users.manage',      'Gerenciar usuarios',      'Criar, editar e desativar usuarios do sistema',      'Usuarios',      14),
    ('settings.manage',   'Gerenciar configuracoes', 'Alterar configuracoes do estabelecimento',           'Configuracoes', 15);

-- Seed operator permissions
INSERT INTO role_permissions (role, permission_key) VALUES
    ('operator', 'rentals.manage'),
    ('operator', 'products.sell'),
    ('operator', 'cash.manage'),
    ('operator', 'shift.manage');

-- Seed manager permissions (operator + more)
INSERT INTO role_permissions (role, permission_key) VALUES
    ('manager', 'rentals.manage'),
    ('manager', 'rentals.extend'),
    ('manager', 'products.sell'),
    ('manager', 'products.manage'),
    ('manager', 'assets.manage'),
    ('manager', 'packages.manage'),
    ('manager', 'customers.view'),
    ('manager', 'reports.view'),
    ('manager', 'cash.manage'),
    ('manager', 'shift.manage'),
    ('manager', 'batteries.manage'),
    ('manager', 'logs.view');

-- Seed owner permissions (all)
INSERT INTO role_permissions (role, permission_key) VALUES
    ('owner', 'rentals.manage'),
    ('owner', 'rentals.extend'),
    ('owner', 'products.sell'),
    ('owner', 'products.manage'),
    ('owner', 'assets.manage'),
    ('owner', 'packages.manage'),
    ('owner', 'customers.view'),
    ('owner', 'reports.view'),
    ('owner', 'reports.operators'),
    ('owner', 'cash.manage'),
    ('owner', 'shift.manage'),
    ('owner', 'batteries.manage'),
    ('owner', 'logs.view'),
    ('owner', 'users.manage'),
    ('owner', 'settings.manage');
