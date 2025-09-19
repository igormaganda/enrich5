-- Insert default blacklist filters

INSERT INTO blacklist_filters (name, filter_type, filter_value, is_active) VALUES
('Gmail Domain', 'email_domain', 'gmail.com', true),
('Yahoo Domain', 'email_domain', 'yahoo.fr', true),
('Hotmail Domain', 'email_domain', 'hotmail.com', true),
('Orange Domain', 'email_domain', 'orange.fr', true),
('Free Domain', 'email_domain', 'free.fr', true),
('Wanadoo Domain', 'email_domain', 'wanadoo.fr', true),
('Test Emails', 'email_exact', 'test@test.com', true),
('Test Emails 2', 'email_exact', 'test@example.com', true),
('Mobile Prefix 06', 'phone_prefix', '06', false),
('Mobile Prefix 07', 'phone_prefix', '07', false),
('International Prefix', 'phone_prefix', '+33', false);