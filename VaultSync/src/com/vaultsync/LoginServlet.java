package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.*;
import java.sql.*;

@WebServlet("/LoginServlet")
public class LoginServlet extends HttpServlet {

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

        String email    = req.getParameter("email");
        String password = req.getParameter("password");

        if (empty(email)||empty(password)) {
            out.print(err("Email and password required.")); return;
        }
        email = email.trim().toLowerCase();

        // ── Query master database ──
        try (Connection conn = DBConnection.getMasterConnection();
             PreparedStatement ps = conn.prepareStatement(
                "SELECT id, full_name, username, email, password FROM Users WHERE email=?")) {

            ps.setString(1, email);
            ResultSet rs = ps.executeQuery();

            if (!rs.next()) {
                out.print(err("No account found with this email.")); return;
            }

            String storedPw  = rs.getString("password");
            String fullName  = rs.getString("full_name");
            String username  = rs.getString("username");
            String userEmail = rs.getString("email");

            // Compare passwords (plain text — for learning portfolio only)
            if (!storedPw.equals(password)) {
                out.print(err("Incorrect password.")); return;
            }

            // ── Start a server-side session ──
            HttpSession session = req.getSession(true);
            session.setAttribute("username", username);
            session.setAttribute("name",     fullName);
            session.setAttribute("email",    userEmail);
            session.setMaxInactiveInterval(30 * 60); // 30 minutes

            System.out.println("[Login] User logged in: " + username);

            out.print("{\"success\":true,\"name\":\"" + j(fullName) + "\",\"username\":\"" + j(username) +
                      "\",\"email\":\"" + j(userEmail) + "\",\"isNew\":false}");

        } catch (SQLException e) {
            System.err.println("[Login] DB error: " + e.getMessage());
            out.print(err("Server error. Try again."));
        }
    }

    private boolean empty(String s) { return s==null||s.trim().isEmpty(); }
    private String err(String msg)  { return "{\"success\":false,\"message\":\"" + j(msg) + "\"}"; }
    private String j(String s)      { return s==null?"":s.replace("\\","\\\\").replace("\"","\\\""); }
}
