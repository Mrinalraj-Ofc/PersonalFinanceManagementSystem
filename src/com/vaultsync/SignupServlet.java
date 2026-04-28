package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;

/**
 * SignupServlet.java
 * ─────────────────────────────────────────────
 * Handles POST /SignupServlet
 * 1. Validates the incoming form data
 * 2. Checks if username/email already exists
 * 3. Inserts user into VaultSync.Users table
 * 4. Creates a personal database for the user
 * 5. Returns JSON response to the frontend
 */
@WebServlet("/SignupServlet")
public class SignupServlet extends HttpServlet {

    @Override
    public void init() throws ServletException {
        // Load driver once when servlet starts
        DBConnection.loadDriver();
        DBConnection.initMasterDatabase();
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Set response type to JSON so JavaScript can parse it
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        PrintWriter out = response.getWriter();

        // ---- Read form fields sent by landing.js ----
        String name     = request.getParameter("name");
        String username = request.getParameter("username");
        String email    = request.getParameter("email");
        String password = request.getParameter("password");

        // ---- Basic server-side validation ----
        if (name == null || name.trim().isEmpty() ||
            username == null || username.trim().isEmpty() ||
            email == null || email.trim().isEmpty() ||
            password == null || password.trim().isEmpty()) {

            out.print("{\"success\":false,\"message\":\"All fields are required.\"}");
            return;
        }

        // Clean inputs
        name     = name.trim();
        username = username.trim().toLowerCase();
        email    = email.trim().toLowerCase();

        // Username must be alphanumeric + underscore only (for safe DB naming)
        if (!username.matches("^[a-zA-Z0-9_]+$")) {
            out.print("{\"success\":false,\"message\":\"Username can only contain letters, numbers, and underscores.\"}");
            return;
        }

        // ---- Check if username or email already exists ----
        String checkSQL = "SELECT id FROM Users WHERE username = ? OR email = ?";

        try (Connection conn = DBConnection.getMasterConnection();
             PreparedStatement check = conn.prepareStatement(checkSQL)) {

            check.setString(1, username);
            check.setString(2, email);
            ResultSet rs = check.executeQuery();

            if (rs.next()) {
                out.print("{\"success\":false,\"message\":\"Username or email already registered.\"}");
                return;
            }

        } catch (SQLException e) {
            System.err.println("[Signup] DB check error: " + e.getMessage());
            out.print("{\"success\":false,\"message\":\"Server error. Please try again.\"}");
            return;
        }

        // ---- Insert new user into Users table ----
        // NOTE: In a production app, always hash the password before storing.
        // For simplicity here, we store plain text.
        // To add hashing later: use BCrypt or MessageDigest SHA-256.
        String insertSQL = "INSERT INTO Users (full_name, username, email, password) VALUES (?, ?, ?, ?)";

        try (Connection conn = DBConnection.getMasterConnection();
             PreparedStatement insert = conn.prepareStatement(insertSQL)) {

            insert.setString(1, name);
            insert.setString(2, username);
            insert.setString(3, email);
            insert.setString(4, password);  // store plain for now (hash in production)
            insert.executeUpdate();

            System.out.println("[Signup] New user registered: " + username);

        } catch (SQLException e) {
            System.err.println("[Signup] Insert error: " + e.getMessage());
            out.print("{\"success\":false,\"message\":\"Failed to create account.\"}");
            return;
        }

        // ---- Create the user's own database + tables ----
        // This runs in a separate thread so signup doesn't feel slow
        final String finalUsername = username;
        final String finalName     = name;
        final String finalEmail    = email;

        new Thread(() -> {
            DBConnection.createUserDatabase(finalUsername);
            System.out.println("[Signup] User DB ready for: " + finalUsername);
        }).start();

        // ---- Send success response ----
        out.print("{" +
            "\"success\":true," +
            "\"name\":\"" + escapeJson(name) + "\"," +
            "\"username\":\"" + escapeJson(username) + "\"," +
            "\"email\":\"" + escapeJson(email) + "\"," +
            "\"isNew\":true" +
        "}");
    }

    // Simple JSON string escaper to avoid breaking the JSON response
    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
