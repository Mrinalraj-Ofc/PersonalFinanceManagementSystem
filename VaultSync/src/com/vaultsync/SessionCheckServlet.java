package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.*;

@WebServlet("/SessionCheckServlet")
public class SessionCheckServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        res.setContentType("application/json");
        res.setCharacterEncoding("UTF-8");
        PrintWriter out = res.getWriter();

        HttpSession session = req.getSession(false);

        if (session == null || session.getAttribute("username") == null) {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            out.print("{\"loggedIn\":false}");
            return;
        }

        String username = (String) session.getAttribute("username");
        String name     = (String) session.getAttribute("name");
        String email    = (String) session.getAttribute("email");

        out.print("{\"loggedIn\":true,\"username\":\"" + j(username) +
                  "\",\"name\":\"" + j(name) + "\",\"email\":\"" + j(email) + "\"}");
    }

    private String j(String s) { return s==null?"":s.replace("\\","\\\\").replace("\"","\\\""); }
}
