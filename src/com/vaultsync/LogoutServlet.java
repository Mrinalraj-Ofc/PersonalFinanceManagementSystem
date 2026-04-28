package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.io.PrintWriter;

/**
 * LogoutServlet.java
 * ─────────────────────────────────────────────
 * Handles GET /LogoutServlet
 * Invalidates the server-side session and
 * tells the frontend to clear sessionStorage,
 * then redirects to the landing page.
 */
@WebServlet("/LogoutServlet")
public class LogoutServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Grab session if it exists — DON'T create a new one
        HttpSession session = request.getSession(false);

        if (session != null) {
            String username = (String) session.getAttribute("username");
            System.out.println("[Logout] User logged out: " + username);
            session.invalidate();   // kill the server-side session
        }

        // Redirect back to landing page
        response.sendRedirect("index.html");
    }

    // Also handle POST (in case called via fetch from JS)
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }

        PrintWriter out = response.getWriter();
        out.print("{\"success\":true,\"redirect\":\"index.html\"}");
    }
}
