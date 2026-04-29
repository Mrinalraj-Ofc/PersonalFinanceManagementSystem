-- ================================================================
-- VaultSync setup.sql  —  Run ONCE in SSMS before launching app
-- ================================================================

-- Step 1: Create master VaultSync database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'VaultSync')
    CREATE DATABASE VaultSync;
GO

USE VaultSync;
GO

-- Step 2: Create Users table (master auth table)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
    CREATE TABLE Users (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        full_name   NVARCHAR(100)  NOT NULL,
        username    NVARCHAR(50)   NOT NULL UNIQUE,
        email       NVARCHAR(150)  NOT NULL UNIQUE,
        password    NVARCHAR(255)  NOT NULL,
        created_at  DATETIME       DEFAULT GETDATE()
    );
GO

-- Step 3: Optional test user  (remove after first real signup)
IF NOT EXISTS (SELECT 1 FROM Users WHERE username = 'testuser')
    INSERT INTO Users (full_name, username, email, password)
    VALUES ('Test User', 'testuser', 'test@vaultsync.com', 'test123');
GO

-- ── What happens automatically at signup ──────────────────────
-- SignupServlet.java will:
--   1. INSERT user into VaultSync.Users
--   2. CREATE DATABASE vaultsync_<username>
--   3. Inside that DB CREATE:
--        Accounts     (balance, income, expense overview)
--        Transactions (income | expense | savings entries)
--        Bills        (recurring bills with due dates)
--        Loans        (auto loan, student loan, mortgage etc.)

SELECT 'Setup complete!' AS Status;
SELECT name AS ExistingDatabases FROM sys.databases ORDER BY name;
GO
