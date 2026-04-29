package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.*;
import java.sql.*;

/*
 * TransactionServlet.java
 * Handles: add, list, delete transactions
 * All data goes into the user's personal database → Transactions table
 */
@WebServlet("/TransactionServlet")
public class TransactionServlet extends HttpServlet {

    @Override
    public void init() throws ServletException { DBConnection.loadDriver(); }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        res.setContentType("application/json");
        res.setCharacterEncoding("UTF-8");
        PrintWriter out = res.getWriter();

        String action   = req.getParameter("action");
        String username = req.getParameter("username");

        if (username == null || username.trim().isEmpty()) {
            out.print("{\"success\":false,\"message\":\"Not authenticated.\"}");
            return;
        }
        username = username.trim().toLowerCase();

        switch (action == null ? "" : action) {
            case "add":    addTx(username, req, out);    break;
            case "list":   listTx(username, out);         break;
            case "delete": deleteTx(username, req, out); break;
            default: out.print("{\"success\":false,\"message\":\"Unknown action.\"}");
        }
    }

    /* ── ADD ── */
    private void addTx(String user, HttpServletRequest req, PrintWriter out) {
        String name     = req.getParameter("name");
        String type     = req.getParameter("type");
        String category = req.getParameter("category");
        String amount   = req.getParameter("amount");
        String date     = req.getParameter("date");
        String status   = req.getParameter("status");

        if (empty(name)||empty(type)||empty(amount)||empty(date)) {
            out.print(err("Missing fields.")); return;
        }
        if (!type.matches("income|expense|savings")) {
            out.print(err("Invalid type.")); return;
        }

        // Compute next T-ref
        String ref = "T1";
        try (Connection c = DBConnection.getUserConnection(user);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM Transactions")) {
            if (rs.next()) ref = "T" + (rs.getInt(1) + 1);
        } catch (SQLException e) { /* fallback */ }

        String sql = "INSERT INTO Transactions(tx_ref,name,type,category,amount,tx_date,status) " +
                     "VALUES(?,?,?,?,?,?,?)";
        try (Connection c = DBConnection.getUserConnection(user);
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, ref);
            ps.setString(2, name.trim());
            ps.setString(3, type);
            ps.setString(4, category != null ? category : "Other");
            ps.setDouble(5, Double.parseDouble(amount));
            ps.setDate(6, Date.valueOf(date));           // expects YYYY-MM-DD
            ps.setString(7, status != null ? status : "completed");
            ps.executeUpdate();
            out.print("{\"success\":true,\"ref\":\"" + ref + "\"}");
        } catch (SQLException e) {
            System.err.println("[TX add] " + e.getMessage());
            out.print(err("DB error: " + e.getMessage()));
        } catch (NumberFormatException e) {
            out.print(err("Invalid amount."));
        }
    }

    /* ── LIST ── */
    private void listTx(String user, PrintWriter out) {
        String sql = "SELECT tx_ref,name,type,category,amount,tx_date,status " +
                     "FROM Transactions ORDER BY tx_date DESC, id DESC";
        try (Connection c = DBConnection.getUserConnection(user);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {

            StringBuilder json = new StringBuilder("{\"success\":true,\"data\":[");
            boolean first = true;
            while (rs.next()) {
                if (!first) json.append(",");
                json.append("{")
                    .append("\"id\":\"").append(j(rs.getString("tx_ref"))).append("\",")
                    .append("\"name\":\"").append(j(rs.getString("name"))).append("\",")
                    .append("\"type\":\"").append(j(rs.getString("type"))).append("\",")
                    .append("\"category\":\"").append(j(rs.getString("category"))).append("\",")
                    .append("\"amount\":").append(rs.getDouble("amount")).append(",")
                    .append("\"date\":\"").append(rs.getDate("tx_date")).append("\",")
                    .append("\"status\":\"").append(j(rs.getString("status"))).append("\"")
                    .append("}");
                first = false;
            }
            json.append("]}");
            out.print(json.toString());

        } catch (SQLException e) {
            out.print(err("Could not load transactions."));
        }
    }

    /* ── DELETE ── */
    private void deleteTx(String user, HttpServletRequest req, PrintWriter out) {
        String ref = req.getParameter("ref");
        if (empty(ref)) { out.print(err("No ref.")); return; }
        try (Connection c = DBConnection.getUserConnection(user);
             PreparedStatement ps = c.prepareStatement("DELETE FROM Transactions WHERE tx_ref=?")) {
            ps.setString(1, ref);
            ps.executeUpdate();
            out.print("{\"success\":true}");
        } catch (SQLException e) {
            out.print(err("Delete failed."));
        }
    }

    private boolean empty(String s) { return s == null || s.trim().isEmpty(); }
    private String  err(String msg)  { return "{\"success\":false,\"message\":\"" + j(msg) + "\"}"; }
    private String  j(String s)      { return s==null?"":s.replace("\\","\\\\").replace("\"","\\\""); }
}
