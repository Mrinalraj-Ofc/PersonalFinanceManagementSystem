package com.vaultsync;

import java.sql.*;

/*
 * DBConnection.java
 * ──────────────────────────────────────────────────────────
 * Central JDBC utility for VaultSync.
 *
 * Two-database architecture:
 *   1. "VaultSync"          → master auth DB  (Users table)
 *   2. "vaultsync_<user>"   → per-user DB     (Accounts, Transactions,
 *                                               Bills, Loans tables)
 *
 * HOW TO USE:
 *   getMasterConnection()        → connect to VaultSync auth DB
 *   getUserConnection("alex")    → connect to vaultsync_alex
 *   createUserDatabase("alex")   → call once at signup
 * ──────────────────────────────────────────────────────────
 */
public class DBConnection {

    // ── Change these to match YOUR SQL Server setup ──
    private static final String HOST     = "localhost";
    private static final String PORT     = "1433";
    private static final String SA_USER  = "mrinal";
    private static final String SA_PASS  = "Aeorc@0498";   // ← change this
    // ─────────────────────────────────────────────────

    private static final String MASTER_DB = "VaultSync";

    /* Load JDBC driver once at startup */
    public static void loadDriver() {
        try {
            Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
            System.out.println("[DB] JDBC driver loaded.");
        } catch (ClassNotFoundException e) {
            System.err.println("[DB] Driver not found — add mssql-jdbc jar to WEB-INF/lib/");
        }
    }

    /* Connection to master VaultSync authentication database */
    public static Connection getMasterConnection() throws SQLException {
        String url = "jdbc:sqlserver://" + HOST + ":" + PORT
                   + ";databaseName=" + MASTER_DB
                   + ";encrypt=false;trustServerCertificate=true";
        return DriverManager.getConnection(url, SA_USER, SA_PASS);
    }

    /* Connection to the user's own personal database */
    public static Connection getUserConnection(String username) throws SQLException {
        String db  = userDbName(username);
        String url = "jdbc:sqlserver://" + HOST + ":" + PORT
                   + ";databaseName=" + db
                   + ";encrypt=false;trustServerCertificate=true";
        return DriverManager.getConnection(url, SA_USER, SA_PASS);
    }

    /* Returns the database name for a given username */
    public static String userDbName(String username) {
        return "vaultsync_" + username.toLowerCase().replaceAll("[^a-z0-9_]", "_");
    }

    /* ─────────────────────────────────────────────────────
     * STEP 1 — Called on server startup.
     * Creates the master VaultSync database and Users table
     * if they do not already exist.
     * ───────────────────────────────────────────────────── */
    public static void initMasterDatabase() {
        // Connect to SQL Server "master" to create VaultSync database
        String masterUrl = "jdbc:sqlserver://" + HOST + ":" + PORT
                         + ";databaseName=master;encrypt=false;trustServerCertificate=true";
        try (Connection conn = DriverManager.getConnection(masterUrl, SA_USER, SA_PASS);
             Statement  stmt = conn.createStatement()) {

            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name='" + MASTER_DB + "') " +
                "   CREATE DATABASE [" + MASTER_DB + "]"
            );
            System.out.println("[DB] Master database '" + MASTER_DB + "' ready.");

        } catch (SQLException e) {
            System.err.println("[DB] Could not create master database: " + e.getMessage());
            return;
        }

        // Now create the Users table inside VaultSync
        try (Connection conn = getMasterConnection();
             Statement  stmt = conn.createStatement()) {

            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U') " +
                "CREATE TABLE Users (" +
                "   id          INT IDENTITY(1,1) PRIMARY KEY, " +
                "   full_name   NVARCHAR(100) NOT NULL, " +
                "   username    NVARCHAR(50)  NOT NULL UNIQUE, " +
                "   email       NVARCHAR(150) NOT NULL UNIQUE, " +
                "   password    NVARCHAR(255) NOT NULL, " +
                "   created_at  DATETIME      DEFAULT GETDATE()" +
                ")"
            );
            System.out.println("[DB] Users table ready.");

        } catch (SQLException e) {
            System.err.println("[DB] Could not create Users table: " + e.getMessage());
        }
    }

    /* ─────────────────────────────────────────────────────
     * STEP 2 — Called synchronously from SignupServlet
     *           after the user row is inserted.
     *
     * Creates:  vaultsync_<username>  database
     * Tables:   Accounts, Transactions, Bills, Loans
     *
     * This runs BEFORE the signup response is sent back,
     * so the database is guaranteed ready when the user
     * first logs in.
     * ───────────────────────────────────────────────────── */
    public static void createUserDatabase(String username) {
        String dbName = userDbName(username);

        // 1. Create the personal database
        String masterUrl = "jdbc:sqlserver://" + HOST + ":" + PORT
                         + ";databaseName=master;encrypt=false;trustServerCertificate=true";
        try (Connection conn = DriverManager.getConnection(masterUrl, SA_USER, SA_PASS);
             Statement  stmt = conn.createStatement()) {

            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name='" + dbName + "') " +
                "   CREATE DATABASE [" + dbName + "]"
            );
            System.out.println("[DB] Created personal database: " + dbName);

        } catch (SQLException e) {
            System.err.println("[DB] Failed to create database '" + dbName + "': " + e.getMessage());
            return;
        }

        // 2. Create all tables inside the user's database
        try (Connection conn = getUserConnection(username);
             Statement  stmt = conn.createStatement()) {

            // Accounts — stores balance, income, expense overview
            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Accounts' AND xtype='U') " +
                "CREATE TABLE Accounts (" +
                "   id              INT IDENTITY(1,1) PRIMARY KEY, " +
                "   total_balance   DECIMAL(15,2) DEFAULT 0, " +
                "   monthly_income  DECIMAL(15,2) DEFAULT 0, " +
                "   monthly_expense DECIMAL(15,2) DEFAULT 0, " +
                "   updated_at      DATETIME      DEFAULT GETDATE()" +
                ")"
            );

            // Transactions — income, expense, savings entries
            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Transactions' AND xtype='U') " +
                "CREATE TABLE Transactions (" +
                "   id          INT IDENTITY(1,1) PRIMARY KEY, " +
                "   tx_ref      NVARCHAR(10)  NOT NULL, " +
                "   name        NVARCHAR(200) NOT NULL, " +
                "   type        NVARCHAR(10)  NOT NULL, " +  // income | expense | savings
                "   category    NVARCHAR(100) NOT NULL, " +
                "   amount      DECIMAL(15,2) NOT NULL, " +
                "   tx_date     DATE          NOT NULL, " +
                "   status      NVARCHAR(20)  NOT NULL DEFAULT 'completed', " +
                "   created_at  DATETIME      DEFAULT GETDATE()" +
                ")"
            );

            // Bills — recurring bills (water, rent, gym, etc.)
            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Bills' AND xtype='U') " +
                "CREATE TABLE Bills (" +
                "   id         INT IDENTITY(1,1) PRIMARY KEY, " +
                "   name       NVARCHAR(100) NOT NULL, " +
                "   amount     DECIMAL(15,2) NOT NULL, " +
                "   due_date   DATE          NOT NULL, " +
                "   autopay    BIT           DEFAULT 0, " +
                "   created_at DATETIME      DEFAULT GETDATE()" +
                ")"
            );

            // Loans — auto loan, student loan, mortgage, etc.
            // paid_amount tracks total paid so far
            stmt.executeUpdate(
                "IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Loans' AND xtype='U') " +
                "CREATE TABLE Loans (" +
                "   id           INT IDENTITY(1,1) PRIMARY KEY, " +
                "   name         NVARCHAR(100) NOT NULL, " +
                "   total_amount DECIMAL(15,2) NOT NULL, " +
                "   paid_amount  DECIMAL(15,2) DEFAULT 0, " +
                "   apr          DECIMAL(5,2)  DEFAULT 0, " +
                "   emi_amount   DECIMAL(15,2) NOT NULL, " +
                "   next_date    DATE          NOT NULL, " +
                "   created_at   DATETIME      DEFAULT GETDATE()" +
                ")"
            );

            System.out.println("[DB] All tables created in " + dbName);

        } catch (SQLException e) {
            System.err.println("[DB] Failed to create tables in '" + dbName + "': " + e.getMessage());
        }
    }
}
