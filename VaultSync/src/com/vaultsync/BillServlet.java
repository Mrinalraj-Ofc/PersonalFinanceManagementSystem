package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.*;
import java.sql.*;

/*
 * BillServlet.java
 * Handles: add, list, pay (full or partial), delete bills
 *
 * Pay logic:
 *   - If payAmount >= bill.amount  → delete the bill row (paid in full)
 *   - If payAmount <  bill.amount  → reduce bill.amount by payAmount (partial)
 *   - In both cases deduct payAmount from user's Accounts.total_balance
 *     and ADD it to Accounts.monthly_expense (reflects on Overview)
 */
@WebServlet("/BillServlet")
public class BillServlet extends HttpServlet {

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

        if (empty(username)) { out.print(err("Not authenticated.")); return; }
        username = username.trim().toLowerCase();

        switch (action == null ? "" : action) {
            case "add":    addBill(username, req, out);    break;
            case "list":   listBills(username, out);        break;
            case "pay":    payBill(username, req, out);    break;
            case "delete": deleteBill(username, req, out); break;
            default: out.print(err("Unknown action."));
        }
    }

    /* ── ADD ── */
    private void addBill(String user, HttpServletRequest req, PrintWriter out) {
        String name    = req.getParameter("name");
        String amount  = req.getParameter("amount");
        String due     = req.getParameter("due");
        boolean autopay = "true".equals(req.getParameter("autopay"));

        if (empty(name)||empty(amount)||empty(due)) { out.print(err("Missing fields.")); return; }

        String sql = "INSERT INTO Bills(name,amount,due_date,autopay) VALUES(?,?,?,?)";
        try (Connection c = DBConnection.getUserConnection(user);
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, name.trim());
            ps.setDouble(2, Double.parseDouble(amount));
            ps.setDate(3, Date.valueOf(due));
            ps.setBoolean(4, autopay);
            ps.executeUpdate();
            out.print("{\"success\":true}");
        } catch (SQLException e) {
            out.print(err("DB error: " + e.getMessage()));
        }
    }

    /* ── LIST ── */
    private void listBills(String user, PrintWriter out) {
        String sql = "SELECT id,name,amount,due_date,autopay FROM Bills ORDER BY due_date ASC";
        try (Connection c = DBConnection.getUserConnection(user);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {

            StringBuilder json = new StringBuilder("{\"success\":true,\"data\":[");
            boolean first = true;
            while (rs.next()) {
                if (!first) json.append(",");
                json.append("{\"id\":").append(rs.getInt("id"))
                    .append(",\"name\":\"").append(j(rs.getString("name"))).append("\"")
                    .append(",\"amount\":").append(rs.getDouble("amount"))
                    .append(",\"due\":\"").append(rs.getDate("due_date")).append("\"")
                    .append(",\"autopay\":").append(rs.getBoolean("autopay"))
                    .append("}");
                first = false;
            }
            json.append("]}");
            out.print(json.toString());

        } catch (SQLException e) { out.print(err("Could not load bills.")); }
    }

    /* ── PAY ── */
    private void payBill(String user, HttpServletRequest req, PrintWriter out) {
        String idStr  = req.getParameter("id");
        String payStr = req.getParameter("payAmount");

        if (empty(idStr)||empty(payStr)) { out.print(err("Missing id or amount.")); return; }

        int    id;
        double payAmount;
        try {
            id        = Integer.parseInt(idStr);
            payAmount = Double.parseDouble(payStr);
        } catch (NumberFormatException e) { out.print(err("Invalid numbers.")); return; }

        // Get current bill amount
        double billAmount = 0;
        try (Connection c = DBConnection.getUserConnection(user);
             PreparedStatement ps = c.prepareStatement("SELECT amount FROM Bills WHERE id=?")) {
            ps.setInt(1, id);
            ResultSet rs = ps.executeQuery();
            if (!rs.next()) { out.print(err("Bill not found.")); return; }
            billAmount = rs.getDouble("amount");
        } catch (SQLException e) { out.print(err("DB error.")); return; }

        if (payAmount > billAmount) {
            out.print(err("Payment exceeds bill amount of ₹" + billAmount)); return;
        }

        try (Connection c = DBConnection.getUserConnection(user)) {
            if (payAmount >= billAmount) {
                // Full payment — delete the bill
                try (PreparedStatement ps = c.prepareStatement("DELETE FROM Bills WHERE id=?")) {
                    ps.setInt(1, id); ps.executeUpdate();
                }
            } else {
                // Partial payment — reduce amount
                try (PreparedStatement ps = c.prepareStatement("UPDATE Bills SET amount=? WHERE id=?")) {
                    ps.setDouble(1, billAmount - payAmount);
                    ps.setInt(2, id);
                    ps.executeUpdate();
                }
            }

            // Deduct from balance, add to expense in Accounts table
            String upd =
                "UPDATE Accounts SET " +
                "  total_balance   = CASE WHEN total_balance   >= ? THEN total_balance   - ? ELSE 0 END, " +
                "  monthly_expense = monthly_expense + ?, " +
                "  updated_at      = GETDATE()";
            try (PreparedStatement ps = c.prepareStatement(upd)) {
                ps.setDouble(1, payAmount);
                ps.setDouble(2, payAmount);
                ps.setDouble(3, payAmount);
                ps.executeUpdate();
            }

            out.print("{\"success\":true,\"message\":\"Payment recorded.\"}");

        } catch (SQLException e) {
            out.print(err("Payment failed: " + e.getMessage()));
        }
    }

    /* ── DELETE ── */
    private void deleteBill(String user, HttpServletRequest req, PrintWriter out) {
        String idStr = req.getParameter("id");
        if (empty(idStr)) { out.print(err("No id.")); return; }
        try (Connection c = DBConnection.getUserConnection(user);
             PreparedStatement ps = c.prepareStatement("DELETE FROM Bills WHERE id=?")) {
            ps.setInt(1, Integer.parseInt(idStr));
            ps.executeUpdate();
            out.print("{\"success\":true}");
        } catch (Exception e) { out.print(err("Delete failed.")); }
    }

    private boolean empty(String s) { return s==null||s.trim().isEmpty(); }
    private String  err(String msg)  { return "{\"success\":false,\"message\":\""+j(msg)+"\"}"; }
    private String  j(String s)      { return s==null?"":s.replace("\\","\\\\").replace("\"","\\\""); }
}
