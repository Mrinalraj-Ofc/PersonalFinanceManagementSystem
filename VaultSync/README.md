# VaultSync — Personal Finance Management System

## Quick Start
1. Run setup.sql in SSMS
2. Edit DBConnection.java — set your SQL Server HOST, SA_USER, SA_PASS
3. Drop mssql-jdbc jar into WebContent/WEB-INF/lib/
4. Import into Eclipse → Run on Tomcat 10.1
5. Open http://localhost:8080/VaultSync/

## Database Auto-Creation Flow
Signup → SignupServlet.java:
  1. INSERT into VaultSync.Users (master auth)
  2. CREATE DATABASE vaultsync_<username>  (personal DB)
  3. CREATE TABLE Accounts       (balance, income, expense)
  4. CREATE TABLE Transactions   (income/expense/savings entries)
  5. CREATE TABLE Bills          (recurring bills)
  6. CREATE TABLE Loans          (EMI loans)

Login → LoginServlet.java:
  1. SELECT from VaultSync.Users WHERE email = ?
  2. Compare password
  3. Start HttpSession with username
  4. All subsequent servlets use getUserConnection(username)
     which connects to vaultsync_<username>

## OpenAI API Key
Analysis page → gear icon → paste your sk-... key → Save
Key stored in browser localStorage only, never on server.
