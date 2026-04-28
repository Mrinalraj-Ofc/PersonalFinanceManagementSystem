package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;

/**
 * BillServlet.java
 * ─────────────────────────────────────────────
 * Handles POST /BillServlet
 * Actions: "add", "list", "delete"
 */
@WebServlet("/BillServlet")
public class BillServlet extends HttpServlet {

    @Override
    public void init() throws ServletException {
        DBConnection.loadDriver();
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        PrintWriter out = response.getWriter();

        String action   = request.getParameter("action");
        String username = request.getParameter("username");

        if (username == null || username.trim().isEmpty()) {
            out.print("{\"success\":false,\"message\":\"Not authenticated.\"}");
            return;
        }
        username = username.trim().toLowerCase();

        switch (action == null ? "" : action) {
            case "add":    addBill(username, request, out);     break;
            case "list":   listBills(username, out);             break;
            case "delete": deleteBill(username, request, out);  break;
            default: out.print("{\"success\":false,\"message\":\"Unknown action.\"}");
        }
    }

    private void addBill(String username, HttpServletRequest req, PrintWriter out) {
        String name   = req.getParameter("name");
        String amount = req.getParameter("amount");
        String type   = req.getParameter("type");
        String due    = req.getParameter("due");

        if (name == null || amount == null || type == null || due == null) {
            out.print("{\"success\":false,\"message\":\"Missing fields.\"}");
            return;
        }
        if (!type.equals("bill") && !type.equals("loan")) {
            out.print("{\"success\":false,\"message\":\"Invalid type.\"}");
            return;
        }

        String sql = "INSERT INTO Bills (name, amount, type, due_date) VALUES (?, ?, ?, ?)";

        try (Connection conn = DBConnection.getUserConnection(username);
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, name.trim());
            stmt.setDouble(2, Double.parseDouble(amount));
            stmt.setString(3, type);
            stmt.setDate(4, Date.valueOf(due));
            stmt.executeUpdate();

            out.print("{\"success\":true,\"message\":\"Bill saved.\"}");
            System.out.println("[Bill] Added for user: " + username);

        } catch (SQLException e) {
            System.err.println("[Bill] Add error: " + e.getMessage());
            out.print("{\"success\":false,\"message\":\"DB error.\"}");
        }
    }

    private void listBills(String username, PrintWriter out) {
        String sql = "SELECT id, name, amount, type, due_date, status FROM Bills ORDER BY due_date ASC";

        try (Connection conn = DBConnection.getUserConnection(username);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            StringBuilder json = new StringBuilder("{\"success\":true,\"data\":[");
            boolean first = true;
            while (rs.next()) {
                if (!first) json.append(",");
                json.append("{")
                    .append("\"id\":").append(rs.getInt("id")).append(",")
                    .append("\"name\":\"").append(escape(rs.getString("name"))).append("\",")
                    .append("\"amount\":").append(rs.getDouble("amount")).append(",")
                    .append("\"type\":\"").append(rs.getString("type")).append("\",")
                    .append("\"due\":\"").append(rs.getDate("due_date")).append("\",")
                    .append("\"status\":\"").append(rs.getString("status")).append("\"")
                    .append("}");
                first = false;
            }
            json.append("]}");
            out.print(json.toString());

        } catch (SQLException e) {
            out.print("{\"success\":false,\"message\":\"Could not load bills.\"}");
        }
    }

    private void deleteBill(String username, HttpServletRequest req, PrintWriter out) {
        String id = req.getParameter("id");
        if (id == null) { out.print("{\"success\":false,\"message\":\"No ID.\"}"); return; }

        try (Connection conn = DBConnection.getUserConnection(username);
             PreparedStatement stmt = conn.prepareStatement("DELETE FROM Bills WHERE id = ?")) {
            stmt.setInt(1, Integer.parseInt(id));
            stmt.executeUpdate();
            out.print("{\"success\":true}");
        } catch (SQLException e) {
            out.print("{\"success\":false,\"message\":\"Delete failed.\"}");
        }
    }

    private String escape(String s) {
        return s == null ? "" : s.replace("\\","\\\\").replace("\"","\\\"");
    }
}
