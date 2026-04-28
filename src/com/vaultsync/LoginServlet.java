package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;

/**
 * LoginServlet.java
 * ─────────────────────────────────────────────
 * Handles POST /LoginServlet
 * 1. Reads email + password from the form
 * 2. Queries the VaultSync.Users table
 * 3. Returns user info on success (JSON)
 * 4. Returns an error message on failure (JSON)
 */
@WebServlet("/LoginServlet")
public class LoginServlet extends HttpServlet {

    @Override
    public void init() throws ServletException {
        DBConnection.loadDriver();
        DBConnection.initMasterDatabase();
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        PrintWriter out = response.getWriter();

        // Read form fields
        String email    = request.getParameter("email");
        String password = request.getParameter("password");

        // Basic validation
        if (email == null || email.trim().isEmpty() ||
            password == null || password.trim().isEmpty()) {
            out.print("{\"success\":false,\"message\":\"Email and password are required.\"}");
            return;
        }

        email = email.trim().toLowerCase();

        // ---- Query user by email ----
        String sql = "SELECT id, full_name, username, email, password FROM Users WHERE email = ?";

        try (Connection conn = DBConnection.getMasterConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();

            if (!rs.next()) {
                // No user found with this email
                out.print("{\"success\":false,\"message\":\"No account found with this email.\"}");
                return;
            }

            String storedPassword = rs.getString("password");
            String name           = rs.getString("full_name");
            String username       = rs.getString("username");
            String userEmail      = rs.getString("email");

            // ---- Check password ----
            // In production, use BCrypt.checkpw(password, storedPassword)
            if (!storedPassword.equals(password)) {
                out.print("{\"success\":false,\"message\":\"Incorrect password. Please try again.\"}");
                return;
            }

            // ---- Check if the user's personal DB exists ----
            // (It may still be being created if they signed up just now)
            boolean dbExists = checkUserDbExists(username);

            // ---- Set session ----
            HttpSession session = request.getSession(true);
            session.setAttribute("username", username);
            session.setAttribute("name", name);
            session.setAttribute("email", userEmail);
            session.setMaxInactiveInterval(30 * 60); // 30 minutes

            System.out.println("[Login] User logged in: " + username);

            // ---- Return success JSON ----
            out.print("{" +
                "\"success\":true," +
                "\"name\":\"" + escapeJson(name) + "\"," +
                "\"username\":\"" + escapeJson(username) + "\"," +
                "\"email\":\"" + escapeJson(userEmail) + "\"," +
                "\"isNew\":" + (!dbExists) +
            "}");

        } catch (SQLException e) {
            System.err.println("[Login] DB error: " + e.getMessage());
            out.print("{\"success\":false,\"message\":\"Server error. Please try again.\"}");
        }
    }

    // Check if the user's personal database has been created
    private boolean checkUserDbExists(String username) {
        String dbName = "vaultsync_" + username.toLowerCase();
        String sql = "SELECT name FROM sys.databases WHERE name = ?";

        try (Connection conn = DBConnection.getMasterConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, dbName);
            ResultSet rs = stmt.executeQuery();
            return rs.next();
        } catch (SQLException e) {
            return false;
        }
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
