package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.*;

@WebServlet("/LogoutServlet")
public class LogoutServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {
        invalidate(req);
        res.sendRedirect("index.html");
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {
        res.setContentType("application/json");
        invalidate(req);
        res.getWriter().print("{\"success\":true}");
    }

    private void invalidate(HttpServletRequest req) {
        HttpSession s = req.getSession(false);
        if (s != null) {
            System.out.println("[Logout] " + s.getAttribute("username"));
            s.invalidate();
        }
    }
}
