package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.io.PrintWriter;

/**
 * SessionCheckServlet.java
 * ─────────────────────────────────────────────
 * Called by dashboard.js on page load to verify
 * the server-side session is still valid.
 * Returns user info if session is active.
 *
 * This prevents someone from accessing dashboard.html
 * directly without going through login.
 */
@WebServlet("/SessionCheckServlet")
public class SessionCheckServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        PrintWriter out = response.getWriter();

        // Check for existing session — false means don't create one
        HttpSession session = request.getSession(false);

        if (session == null || session.getAttribute("username") == null) {
            // No valid session → send 401 so JS can redirect
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            out.print("{\"loggedIn\":false}");
            return;
        }

        String username = (String) session.getAttribute("username");
        String name     = (String) session.getAttribute("name");
        String email    = (String) session.getAttribute("email");

        out.print("{" +
            "\"loggedIn\":true," +
            "\"username\":\"" + escapeJson(username) + "\"," +
            "\"name\":\"" + escapeJson(name) + "\"," +
            "\"email\":\"" + escapeJson(email) + "\"" +
        "}");
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
