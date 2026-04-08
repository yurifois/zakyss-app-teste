-- Inserir Categorias
INSERT INTO categories (id, name, icon, color) VALUES
('cabelo', 'Cabelo', '💇', '#fa8072'),
('unhas', 'Unhas', '💅', '#f08060'),
('maquiagem', 'Maquiagem', '💄', '#e76f61'),
('estetica', 'Estética', '✨', '#14b8a6'),
('barba', 'Barba', '🧔', '#c25d52'),
('spa', 'Spa', '🧖', '#0ea5e9')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, color = EXCLUDED.color;

-- Inserir Serviços
INSERT INTO services (id, name, description, price, duration, "categoryId") VALUES
(1, 'Corte Feminino', NULL, 80, 60, 'cabelo'),
(2, 'Corte Masculino', NULL, 50, 30, 'cabelo'),
(3, 'Escova', NULL, 60, 45, 'cabelo'),
(4, 'Coloração', NULL, 150, 120, 'cabelo'),
(5, 'Mechas/Luzes', NULL, 200, 180, 'cabelo'),
(6, 'Hidratação', NULL, 70, 45, 'cabelo'),
(7, 'Progressiva', NULL, 250, 180, 'cabelo'),
(8, 'Penteado', NULL, 120, 60, 'cabelo'),
(9, 'Manicure', NULL, 35, 45, 'unhas'),
(10, 'Pedicure', NULL, 40, 45, 'unhas'),
(11, 'Unha em Gel', NULL, 120, 90, 'unhas'),
(12, 'Alongamento', NULL, 150, 120, 'unhas'),
(13, 'Nail Art', NULL, 80, 60, 'unhas'),
(14, 'Maquiagem Social', NULL, 100, 60, 'maquiagem'),
(15, 'Maquiagem Noiva', NULL, 250, 90, 'maquiagem'),
(16, 'Design de Sobrancelhas', NULL, 50, 30, 'maquiagem'),
(17, 'Micropigmentação', NULL, 400, 120, 'maquiagem'),
(18, 'Limpeza de Pele', NULL, 120, 60, 'estetica'),
(19, 'Peeling', NULL, 150, 45, 'estetica'),
(20, 'Drenagem Linfática', NULL, 100, 60, 'estetica'),
(21, 'Massagem Relaxante', NULL, 120, 60, 'estetica'),
(22, 'Depilação a Laser', NULL, 200, 45, 'estetica'),
(23, 'Depilação com Cera', NULL, 80, 30, 'estetica'),
(24, 'Barba Completa', NULL, 45, 30, 'barba'),
(25, 'Aparar Barba', NULL, 30, 20, 'barba'),
(26, 'Hidratação de Barba', NULL, 40, 20, 'barba'),
(27, 'Combo Corte + Barba', NULL, 80, 50, 'barba'),
(28, 'Day Spa', NULL, 350, 240, 'spa'),
(29, 'Banho de Lua', NULL, 180, 90, 'spa'),
(30, 'Reflexologia', NULL, 100, 45, 'spa')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price, duration = EXCLUDED.duration, "categoryId" = EXCLUDED."categoryId";
