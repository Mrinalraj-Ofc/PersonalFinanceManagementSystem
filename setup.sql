-- ================================================================
-- VaultSync — SQL Server Setup Script
-- Run this in SSMS (SQL Server Management Studio)
-- ================================================================
-- STEP 1: Open SSMS → Connect to your server
-- STEP 2: Open a New Query window
-- STEP 3: Copy-paste this entire file and click Execute (F5)
-- ================================================================

-- 1. Create the master VaultSync authentication database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'VaultSync')
BEGIN
    CREATE DATABASE VaultSync;
    PRINT 'VaultSync database created.';
END
ELSE
    PRINT 'VaultSync database already exists.';
GO

-- 2. Switch to VaultSync database
USE VaultSync;
GO

-- 3. Create the Users table (stores all login credentials)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
BEGIN
    CREATE TABLE Users (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        full_name   NVARCHAR(100)  NOT NULL,
        username    NVARCHAR(50)   NOT NULL UNIQUE,
        email       NVARCHAR(150)  NOT NULL UNIQUE,
        password    NVARCHAR(255)  NOT NULL,    -- store hashed password in production
        created_at  DATETIME       DEFAULT GETDATE()
    );
    PRINT 'Users table created.';
END
ELSE
    PRINT 'Users table already exists.';
GO

-- 4. Optional: Insert a test user so you can log in immediately
-- Password is "test123" (plain text for dev only)
IF NOT EXISTS (SELECT 1 FROM Users WHERE username = 'testuser')
BEGIN
    INSERT INTO Users (full_name, username, email, password)
    VALUES ('Test User', 'testuser', 'test@vaultsync.com', 'test123');
    PRINT 'Test user inserted: email=test@vaultsync.com / password=test123';
END
GO

-- ================================================================
-- NOTE: When a user signs up via the app, SignupServlet.java will
-- automatically create a personal database named vaultsync_<username>
-- with these tables inside it:
--
--   Accounts      → total_balance, monthly_income, monthly_expense
--   Transactions  → description, amount, type (income/expense), tx_date
--   Bills         → name, amount, type (bill/loan), due_date, status
--
-- You do NOT need to create those manually. The Java code does it.
-- ================================================================

-- 5. Verify setup
SELECT 'Setup complete!' AS Status;
SELECT name AS 'Databases in SQL Server' FROM sys.databases ORDER BY name;
GO
