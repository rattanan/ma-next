INSERT INTO permissions (id,code,name,category) VALUES
('b79a0310-2fa3-4100-8000-000000000001','PROJECT_VIEW','View shutdown projects','PLANNING'),
('b79a0310-2fa3-4100-8000-000000000002','PROJECT_MANAGE','Manage shutdown projects','PLANNING'),
('b79a0310-2fa3-4100-8000-000000000003','PM_VIEW','View preventive maintenance','PLANNING'),
('b79a0310-2fa3-4100-8000-000000000004','PM_MANAGE','Manage preventive maintenance','PLANNING'),
('b79a0310-2fa3-4100-8000-000000000005','PM_GENERATE','Generate preventive work orders','PLANNING')
ON DUPLICATE KEY UPDATE code=VALUES(code);
