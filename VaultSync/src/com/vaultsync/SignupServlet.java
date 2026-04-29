package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.*;
import java.sql.*;

@WebServlet("/SignupServlet")
public class SignupServlet extends HttpServlet {

    @Override
    public void init() throws ServletException {
        DBConnection.loadDriver();
        DBConnection.initMasterDatabase();
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        res.setContentType("application/json");
        res.setCharacterEncoding("UTF-8");
        PrintWriter out = res.getWriter();

        String name     = req.getParameter("name");
        String username = req.getParameter("username");
        String email    = req.getParameter("email");
        String password = req.getParameter("password");

        // ── Basic validation ──
        if (empty(name)||empty(username)||empty(email)||empty(password)) {
            out.print(err("All fields are required.")); return;
        }
        name     = name.trim();
        username = username.trim().toLowerCase();
        email    = email.trim().toLowerCase();

        if (!username.matches("^[a-z0-9_]+$")) {
            out.print(err("Username: only letters, numbers, underscores.")); return;
        }

        // ── Check if username or email already exists ──
        try (Connection conn = DBConnection.getMasterConnection();
             PreparedStatement ps = conn.prepareStatement(
                "SELECT id FROM Users WHERE username=? OR email=?")) {
            ps.setString(1, username);
            ps.setString(2, email);
            if (ps.executeQuery().next()) {
                out.print(err("Username or email already registered.")); return;
            }
        } catch (SQLException e) {
            out.print(err("Server error. Try again.")); return;
        }

        // ── INSERT user into VaultSync.Users ──
        // NOTE: Store plain password for learning. In production use BCrypt.
        try (Connection conn = DBConnection.getMasterConnection();
             PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO Users (full_name, username, email, password) VALUES (?,?,?,?)")) {
            ps.setString(1, name);
            ps.setString(2, username);
            ps.setString(3, email);
            ps.setString(4, password);
            ps.executeUpdate();
            System.out.println("[Signup] New user: " + username);
        } catch (SQLException e) {
            out.print(err("Could not create account: " + e.getMessage())); return;
        }

        // ── Create personal database + tables (SYNCHRONOUS — before response) ──
        DBConnection.createUserDatabase(username);

        out.print("{\"success\":true,\"name\":\"" + j(name) + "\",\"username\":\"" + j(username) +
                  "\",\"email\":\"" + j(email) + "\",\"isNew\":true}");
    }

    private boolean empty(String s) { return s==null||s.trim().isEmpty(); }
    private String err(String msg)  { return "{\"success\":false,\"message\":\"" + j(msg) + "\"}"; }
    private String j(String s)      { return s==null?"":s.replace("\\","\\\\").replace("\"","\\\""); }
}
