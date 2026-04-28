# VaultSync — Personal Finance Management System
## Setup Guide (Step-by-Step for Beginners)

---

## 📁 Project Structure
```
VaultSync/
├── WebContent/
│   ├── index.html          ← Landing page (login/signup)
│   ├── dashboard.html      ← Main dashboard
│   ├── css/
│   │   ├── landing.css
│   │   └── dashboard.css
│   ├── js/
│   │   ├── landing.js      ← Login/signup logic
│   │   └── dashboard.js    ← Dashboard logic + charts
│   └── WEB-INF/
│       └── web.xml
├── src/
│   └── com/vaultsync/
│       ├── DBConnection.java       ← JDBC utility
│       ├── SignupServlet.java      ← Handles registration
│       ├── LoginServlet.java       ← Handles login
│       ├── OverviewServlet.java    ← Saves financial stats
│       ├── TransactionServlet.java ← CRUD for transactions
│       └── BillServlet.java        ← CRUD for bills/loans
├── setup.sql               ← Run this in SSMS first
└── README.md               ← This file
```

---

## 🔧 STEP 1 — Software Requirements

Make sure you have these installed:
- **Java JDK 17+** → https://adoptium.net
- **Apache Tomcat 10+** → https://tomcat.apache.org/download-10.cgi
- **Eclipse IDE for Enterprise Java** → https://www.eclipse.org/downloads/
- **SQL Server (SSMS)** → Already installed (you mentioned this!)
- **Microsoft JDBC Driver** → Download the `.jar` from:
  https://learn.microsoft.com/en-us/sql/connect/jdbc/download-microsoft-jdbc-driver-for-sql-server

---

## 🗃️ STEP 2 — Setup the Database

1. Open **SQL Server Management Studio (SSMS)**
2. Connect to your server (usually `localhost` or `.\SQLEXPRESS`)
3. Click **New Query**
4. Open `setup.sql` from this project and paste the contents
5. Press **F5** (Execute)
6. You should see: `Setup complete!`

---

## ⚙️ STEP 3 — Configure DB Connection

Open `src/com/vaultsync/DBConnection.java` and update these lines:

```java
private static final String SERVER   = "localhost";      // ← Your server name
private static final String PORT     = "1433";           // ← Usually 1433
private static final String USER     = "sa";             // ← Your SQL login
private static final String PASSWORD = "YourPassword123"; // ← Your SQL password
```

> If you're using Windows Authentication (instead of sa login), change the connection URL to:
> `jdbc:sqlserver://localhost:1433;databaseName=VaultSync;integratedSecurity=true`

---

## 📦 STEP 4 — Add the JDBC Driver JAR

1. Download `mssql-jdbc-12.x.x.jre11.jar` from the Microsoft link above
2. Place it inside: `WebContent/WEB-INF/lib/`
3. In Eclipse: right-click the JAR → **Build Path → Add to Build Path**

---

## 🚀 STEP 5 — Import into Eclipse & Run

1. Open **Eclipse → File → Import → Existing Projects into Workspace**
2. Browse to the `VaultSync` folder → Finish
3. Right-click project → **Properties → Project Facets** → Check:
   - Dynamic Web Module 6.0
   - Java 17
4. Right-click project → **Run As → Run on Server**
5. Select **Apache Tomcat 10** → Finish
6. Browser opens at: `http://localhost:8080/VaultSync/`

---

## 🧪 STEP 6 — Test the App

### Option A — Without Backend (Demo Mode)
Just open `index.html` in a browser directly.
The JavaScript has a fallback that works without the server.
You can see the full UI and navigation.

### Option B — With Full Backend
1. Run on Tomcat (Step 5)
2. Go to `http://localhost:8080/VaultSync/`
3. Click **Sign Up** → fill form → Submit
4. Check SSMS: a new database `vaultsync_<yourname>` should appear!
5. Log in with your credentials → Dashboard opens

---

## 🔑 How the Per-User Database Works

```
Signup → SignupServlet.java
  ↓
INSERT into VaultSync.Users table  (master auth)
  ↓
CREATE DATABASE vaultsync_alex     (personal DB)
  ↓
CREATE TABLE Accounts              (inside user DB)
CREATE TABLE Transactions          (inside user DB)
CREATE TABLE Bills                 (inside user DB)
```

Every user gets their own isolated database. Clean!

---

## 🌐 Pages

| URL | Description |
|-----|-------------|
| `/index.html` | Landing page with Login & Signup |
| `/dashboard.html` | Main dashboard (redirect after login) |
| `/SignupServlet` | POST endpoint for registration |
| `/LoginServlet` | POST endpoint for authentication |
| `/TransactionServlet` | POST endpoint for transactions |
| `/BillServlet` | POST endpoint for bills |
| `/OverviewServlet` | POST endpoint for financial stats |

---

## 🛠️ Common Issues

**"JDBC Driver not found"**
→ Make sure `mssql-jdbc.jar` is in `WEB-INF/lib/` AND added to Build Path

**"Connection refused"**
→ Check SQL Server is running (Services → SQL Server)
→ Check TCP/IP is enabled in SQL Server Configuration Manager

**"Login failed for user 'sa'"**
→ Enable SQL Server Authentication in SSMS:
  Right-click server → Properties → Security → SQL Server and Windows Authentication

**"Port 1433 blocked"**
→ Open Windows Firewall → Add inbound rule for port 1433

---

## 🎓 Built With
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript (DOM, async/await, fetch API)
- **Backend**: Java Servlets (Jakarta EE)
- **Database**: Microsoft SQL Server (SSMS)
- **Driver**: Microsoft JDBC Driver for SQL Server
- **Server**: Apache Tomcat 10

---

*VaultSync — Portfolio Project*
