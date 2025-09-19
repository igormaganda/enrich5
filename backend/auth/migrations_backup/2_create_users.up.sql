-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, role) 
VALUES ('admin', 'admin@example.com', 'admin123', 'admin')
ON CONFLICT (username) DO UPDATE SET
  password_hash = 'admin123',
  role = 'admin';
