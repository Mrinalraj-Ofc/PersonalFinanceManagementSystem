package com.vaultsync;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * DBConnection.java
 * ─────────────────────────────────────────────
 * Utility class for all JDBC connections.
 * Using Microsoft SQL Server (SSMS) with jTDS / mssql-jdbc driver.
 *
 * ► Download driver: https://learn.microsoft.com/en-us/sql/connect/jdbc/download-microsoft-jdbc-driver-for-sql-server
 * ► Place the .jar in your project's WEB-INF/lib/ folder.
 */
public class DBConnection {

    // ─── Change these to match YOUR SQL Server setup ───
    private static final String SERVER   = "localhost";          // your server name or IP
    private static final String PORT     = "1433";               // default SQL Server port
    private static final String MASTER_DB = "VaultSync";         // master auth database
    private static final String USER     = "sa";                 // SQL Server login
    private static final String PASSWORD = "YourPassword123";    // your SQL password
    // ──────────────────────────────────────────────────

    // ---- Connection to the master VaultSync database (for auth) ----
    public static Connection getMasterConnection() throws SQLException {
        String url = "jdbc:sqlserver://" + SERVER + ":" + PORT
                   + ";databaseName=" + MASTER_DB
                   + ";encrypt=false;trustServerCertificate=true";
        return DriverManager.getConnection(url, USER, PASSWORD);
    }

    // ---- Connection to a specific user's database ----
    // Each user gets their own database named: vaultsync_<username>
    public static Connection getUserConnection(String username) throws SQLException {
        String dbName = "vaultsync_" + username.toLowerCase();
        String url = "jdbc:sqlserver://" + SERVER + ":" + PORT
                   + ";databaseName=" + dbName
                   + ";encrypt=false;trustServerCertificate=true";
        return DriverManager.getConnection(url, USER, PASSWORD);
    }

    // ---- Load the JDBC driver (call this once at app startup) ----
    public static void loadDriver() {
        try {
            Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
            System.out.println("[VaultSync] JDBC Driver loaded successfully.");
        } catch (ClassNotFoundException e) {
            System.err.println("[VaultSync] ERROR: JDBC Driver not found. Add mssql-jdbc jar to WEB-INF/lib.");
            e.printStackTrace();
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Creates the master VaultSync database and Users table.
    // Call once during first-time setup (or run setup.sql directly).
    // ─────────────────────────────────────────────────────────────────
    public static void initMasterDatabase() {
        // Connect to 'master' first to create VaultSync db
        String masterUrl = "jdbc:sqlserver://" + SERVER + ":" + PORT
                         + ";databaseName=master;encrypt=false;trustServerCertificate=true";
        try (Connection conn = DriverManager.getConnection(masterUrl, USER, PASSWORD);
             Statement stmt = conn.createStatement()) {

            // Create the VaultSync auth database if not exists
            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'VaultSync') " +
                "CREATE DATABASE VaultSync"
            );
            System.out.println("[VaultSync] Master database ready.");

        } catch (SQLException e) {
            System.err.println("[VaultSync] Failed to init master DB: " + e.getMessage());
        }

        // Now create the Users table inside VaultSync
        try (Connection conn = getMasterConnection();
             Statement stmt = conn.createStatement()) {

            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U') " +
                "CREATE TABLE Users (" +
                "    id         INT IDENTITY(1,1) PRIMARY KEY, " +
                "    full_name  NVARCHAR(100) NOT NULL, " +
                "    username   NVARCHAR(50)  NOT NULL UNIQUE, " +
                "    email      NVARCHAR(150) NOT NULL UNIQUE, " +
                "    password   NVARCHAR(255) NOT NULL, " +
                "    created_at DATETIME      DEFAULT GETDATE()" +
                ")"
            );
            System.out.println("[VaultSync] Users table ready.");

        } catch (SQLException e) {
            System.err.println("[VaultSync] Failed to create Users table: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Creates a personal database for a new user and sets up their tables.
    // Called from SignupServlet after successful registration.
    // ─────────────────────────────────────────────────────────────────
    public static void createUserDatabase(String username) {
        String dbName = "vaultsync_" + username.toLowerCase();

        // 1. Connect to master and create the user's database
        String masterUrl = "jdbc:sqlserver://" + SERVER + ":" + PORT
                         + ";databaseName=master;encrypt=false;trustServerCertificate=true";
        try (Connection conn = DriverManager.getConnection(masterUrl, USER, PASSWORD);
             Statement stmt = conn.createStatement()) {

            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '" + dbName + "') " +
                "CREATE DATABASE [" + dbName + "]"
            );
            System.out.println("[VaultSync] Created database: " + dbName);

        } catch (SQLException e) {
            System.err.println("[VaultSync] Failed to create user DB '" + dbName + "': " + e.getMessage());
            return;
        }

        // 2. Connect to user's database and create financial tables
        try (Connection conn = getUserConnection(username);
             Statement stmt = conn.createStatement()) {

            // Accounts / Balance overview
            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Accounts' AND xtype='U') " +
                "CREATE TABLE Accounts (" +
                "    id              INT IDENTITY(1,1) PRIMARY KEY, " +
                "    total_balance   DECIMAL(15,2) DEFAULT 0, " +
                "    monthly_income  DECIMAL(15,2) DEFAULT 0, " +
                "    monthly_expense DECIMAL(15,2) DEFAULT 0, " +
                "    updated_at      DATETIME DEFAULT GETDATE()" +
                ")"
            );

            // Transactions table
            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Transactions' AND xtype='U') " +
                "CREATE TABLE Transactions (" +
                "    id          INT IDENTITY(1,1) PRIMARY KEY, " +
                "    description NVARCHAR(200) NOT NULL, " +
                "    amount      DECIMAL(15,2) NOT NULL, " +
                "    type        NVARCHAR(10)  NOT NULL CHECK (type IN ('income','expense')), " +
                "    tx_date     DATE          NOT NULL, " +
                "    created_at  DATETIME      DEFAULT GETDATE()" +
                ")"
            );

            // Bills & Loans table
            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Bills' AND xtype='U') " +
                "CREATE TABLE Bills (" +
                "    id         INT IDENTITY(1,1) PRIMARY KEY, " +
                "    name       NVARCHAR(100) NOT NULL, " +
                "    amount     DECIMAL(15,2) NOT NULL, " +
                "    type       NVARCHAR(10)  NOT NULL CHECK (type IN ('bill','loan')), " +
                "    due_date   DATE          NOT NULL, " +
                "    status     NVARCHAR(20)  DEFAULT 'Upcoming', " +
                "    created_at DATETIME      DEFAULT GETDATE()" +
                ")"
            );

            System.out.println("[VaultSync] All tables created in " + dbName);

        } catch (SQLException e) {
            System.err.println("[VaultSync] Failed to create tables for " + dbName + ": " + e.getMessage());
        }
    }
}
