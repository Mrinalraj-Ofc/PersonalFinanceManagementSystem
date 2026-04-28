package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;

/**
 * TransactionServlet.java
 * ─────────────────────────────────────────────
 * Handles POST /TransactionServlet
 * Actions: "add", "list", "delete"
 * All data is saved to the user's personal database.
 */
@WebServlet("/TransactionServlet")
public class TransactionServlet extends HttpServlet {

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
            case "add":
                addTransaction(username, request, out);
                break;
            case "list":
                listTransactions(username, out);
                break;
            case "delete":
                deleteTransaction(username, request, out);
                break;
            default:
                out.print("{\"success\":false,\"message\":\"Unknown action.\"}");
        }
    }

    // ---- ADD a new transaction ----
    private void addTransaction(String username, HttpServletRequest req, PrintWriter out) {
        String desc   = req.getParameter("desc");
        String amount = req.getParameter("amount");
        String type   = req.getParameter("type");
        String date   = req.getParameter("date");

        if (desc == null || amount == null || type == null || date == null) {
            out.print("{\"success\":false,\"message\":\"Missing fields.\"}");
            return;
        }

        // Validate type
        if (!type.equals("income") && !type.equals("expense")) {
            out.print("{\"success\":false,\"message\":\"Invalid type.\"}");
            return;
        }

        String sql = "INSERT INTO Transactions (description, amount, type, tx_date) VALUES (?, ?, ?, ?)";

        try (Connection conn = DBConnection.getUserConnection(username);
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, desc.trim());
            stmt.setDouble(2, Double.parseDouble(amount));
            stmt.setString(3, type);
            stmt.setDate(4, Date.valueOf(date));  // expects YYYY-MM-DD format
            stmt.executeUpdate();

            out.print("{\"success\":true,\"message\":\"Transaction saved.\"}");
            System.out.println("[Transaction] Added for user: " + username);

        } catch (SQLException e) {
            System.err.println("[Transaction] Add error: " + e.getMessage());
            out.print("{\"success\":false,\"message\":\"DB error: " + e.getMessage() + "\"}");
        } catch (NumberFormatException e) {
            out.print("{\"success\":false,\"message\":\"Invalid amount.\"}");
        }
    }

    // ---- LIST all transactions ----
    private void listTransactions(String username, PrintWriter out) {
        String sql = "SELECT id, description, amount, type, tx_date FROM Transactions ORDER BY tx_date DESC";

        try (Connection conn = DBConnection.getUserConnection(username);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            StringBuilder json = new StringBuilder("{\"success\":true,\"data\":[");
            boolean first = true;

            while (rs.next()) {
                if (!first) json.append(",");
                json.append("{")
                    .append("\"id\":").append(rs.getInt("id")).append(",")
                    .append("\"desc\":\"").append(escape(rs.getString("description"))).append("\",")
                    .append("\"amount\":").append(rs.getDouble("amount")).append(",")
                    .append("\"type\":\"").append(rs.getString("type")).append("\",")
                    .append("\"date\":\"").append(rs.getDate("tx_date")).append("\"")
                    .append("}");
                first = false;
            }
            json.append("]}");
            out.print(json.toString());

        } catch (SQLException e) {
            out.print("{\"success\":false,\"message\":\"Could not load transactions.\"}");
        }
    }

    // ---- DELETE a transaction by ID ----
    private void deleteTransaction(String username, HttpServletRequest req, PrintWriter out) {
        String id = req.getParameter("id");
        if (id == null) { out.print("{\"success\":false,\"message\":\"No ID.\"}"); return; }

        String sql = "DELETE FROM Transactions WHERE id = ?";
        try (Connection conn = DBConnection.getUserConnection(username);
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, Integer.parseInt(id));
            stmt.executeUpdate();
            out.print("{\"success\":true,\"message\":\"Deleted.\"}");
        } catch (SQLException e) {
            out.print("{\"success\":false,\"message\":\"Delete failed.\"}");
        }
    }

    private String escape(String s) {
        return s == null ? "" : s.replace("\\","\\\\").replace("\"","\\\"");
    }
}
