-- Document template permissions
INSERT INTO permissions (key, label, description, category, sort_order) VALUES
    ('documents.manage', 'Gerenciar documentos', 'Criar, editar e excluir modelos de documentos para impressao', 'Documentos', 16),
    ('documents.print',  'Imprimir documentos',  'Imprimir documentos durante a locacao',                        'Documentos', 17);

-- Manager can manage and print documents
INSERT INTO role_permissions (role, permission_key) VALUES
    ('manager', 'documents.manage'),
    ('manager', 'documents.print');

-- Operator can only print
INSERT INTO role_permissions (role, permission_key) VALUES
    ('operator', 'documents.print');
