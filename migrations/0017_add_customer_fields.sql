-- Migration 0017: Add CPF and Instagram fields to customers
ALTER TABLE customers ADD COLUMN cpf TEXT;
ALTER TABLE customers ADD COLUMN instagram TEXT;

CREATE INDEX idx_customers_cpf ON customers(cpf);
