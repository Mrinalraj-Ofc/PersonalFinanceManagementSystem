package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.*;
import java.sql.*;
import java.time.LocalDate;

/*
 * LoanServlet.java
 * Handles: add, list, pay, delete loans
 *
 * Pay logic:
 *   - payAmount deducted from paid_amount balance (increasing % paid)
 *   - next_date advanced by number of months covered (payAmount / emi)
 *   - total_balance in Accounts reduced by payAmount
 *   - monthly_expense in Accounts increased by payAmount
 *   - If paid_amount >= total_amount → loan is fully cleared
 */
@WebServlet("/LoanServlet")
public class LoanServlet extends HttpServlet {

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
            case "add":    addLoan(username, req, out);    break;
            case "list":   listLoans(username, out);        break;
            case "pay":    payLoan(username, req, out);    break;
            case "delete": deleteLoan(username, req, out); break;
            default: out.print(err("Unknown action."));
        }
    }

    /* ── ADD ── */
    private void addLoan(String user, HttpServletRequest req, PrintWriter out) {
        String name  = req.getParameter("name");
        String total = req.getParameter("total");
        String apr   = req.getParameter("apr");
        String emi   = req.getParameter("emi");
        String paid  = req.getParameter("paid");
        String next  = req.getParameter("next");

        if (empty(name)||empty(total)||empty(emi)||empty(next)) {
            out.print(err("Missing required loan fields.")); return;
        }

        String sql = "INSERT INTO Loans(name,total_amount,paid_amount,apr,emi_amount,next_date) " +
                     "VALUES(?,?,?,?,?,?)";
        try (Connection c = DBConnection.getUserConnection(user);
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, name.trim());
            ps.setDouble(2, dbl(total));
            ps.setDouble(3, dbl(paid));
            ps.setDouble(4, dbl(apr));
            ps.setDouble(5, dbl(emi));
            ps.setDate(6, Date.valueOf(next));
            ps.executeUpdate();
            out.print("{\"success\":true}");
        } catch (SQLException e) {
            out.print(err("DB error: " + e.getMessage()));
        }
    }

    /* ── LIST ── */
    private void listLoans(String user, PrintWriter out) {
        String sql = "SELECT id,name,total_amount,paid_amount,apr,emi_amount,next_date " +
                     "FROM Loans ORDER BY id ASC";
        try (Connection c = DBConnection.getUserConnection(user);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {

            StringBuilder json = new StringBuilder("{\"success\":true,\"data\":[");
            boolean first = true;
            while (rs.next()) {
                if (!first) json.append(",");
                json.append("{")
                    .append("\"id\":").append(rs.getInt("id")).append(",")
                    .append("\"name\":\"").append(j(rs.getString("name"))).append("\",")
                    .append("\"total\":").append(rs.getDouble("total_amount")).append(",")
                    .append("\"paid\":").append(rs.getDouble("paid_amount")).append(",")
                    .append("\"apr\":").append(rs.getDouble("apr")).append(",")
                    .append("\"emi\":").append(rs.getDouble("emi_amount")).append(",")
                    .append("\"next\":\"").append(rs.getDate("next_date")).append("\"")
                    .append("}");
                first = false;
            }
            json.append("]}");
            out.print(json.toString());

        } catch (SQLException e) { out.print(err("Could not load loans.")); }
    }

    /* ── PAY ── */
    private void payLoan(String user, HttpServletRequest req, PrintWriter out) {
        String idStr  = req.getParameter("id");
        String payStr = req.getParameter("payAmount");

        if (empty(idStr)||empty(payStr)) { out.print(err("Missing id or amount.")); return; }

        int    id;
        double payAmount;
        try { id = Integer.parseInt(idStr); payAmount = Double.parseDouble(payStr); }
        catch (NumberFormatException e) { out.print(err("Invalid numbers.")); return; }

        // Get loan data
        double totalAmount, paidAmount, emiAmount;
        String nextDateStr;
        try (Connection c = DBConnection.getUserConnection(user);
             PreparedStatement ps = c.prepareStatement(
                "SELECT total_amount,paid_amount,emi_amount,next_date FROM Loans WHERE id=?")) {
            ps.setInt(1, id);
            ResultSet rs = ps.executeQuery();
            if (!rs.next()) { out.print(err("Loan not found.")); return; }
            totalAmount  = rs.getDouble("total_amount");
            paidAmount   = rs.getDouble("paid_amount");
            emiAmount    = rs.getDouble("emi_amount");
            nextDateStr  = rs.getDate("next_date").toString();
        } catch (SQLException e) { out.print(err("DB error.")); return; }

        double remaining = totalAmount - paidAmount;
        if (payAmount > remaining) payAmount = remaining; // cap at remaining

        double newPaid = paidAmount + payAmount;

        // Advance next_date by number of months covered
        // e.g. paying 3 * emi → advance 3 months
        int monthsAdvanced = (emiAmount > 0) ? (int) Math.round(payAmount / emiAmount) : 1;
        if (monthsAdvanced < 1) monthsAdvanced = 1;
        LocalDate nextDate = LocalDate.parse(nextDateStr);
        nextDate = nextDate.plusMonths(monthsAdvanced);

        try (Connection c = DBConnection.getUserConnection(user)) {

            if (newPaid >= totalAmount) {
                // Loan fully paid — delete the row
                try (PreparedStatement ps = c.prepareStatement("DELETE FROM Loans WHERE id=?")) {
                    ps.setInt(1, id); ps.executeUpdate();
                }
            } else {
                // Update paid amount and next date
                try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE Loans SET paid_amount=?, next_date=? WHERE id=?")) {
                    ps.setDouble(1, newPaid);
                    ps.setDate(2, Date.valueOf(nextDate));
                    ps.setInt(3, id);
                    ps.executeUpdate();
                }
            }

            // Reflect payment in Accounts: reduce balance, increase expense
            String upd =
                "UPDATE Accounts SET " +
                "  total_balance   = CASE WHEN total_balance >= ? THEN total_balance - ? ELSE 0 END, " +
                "  monthly_expense = monthly_expense + ?, " +
                "  updated_at      = GETDATE()";
            try (PreparedStatement ps = c.prepareStatement(upd)) {
                ps.setDouble(1, payAmount);
                ps.setDouble(2, payAmount);
                ps.setDouble(3, payAmount);
                ps.executeUpdate();
            }

            out.print("{\"success\":true,\"message\":\"Loan payment recorded.\",\"monthsAdvanced\":" + monthsAdvanced + "}");

        } catch (SQLException e) {
            out.print(err("Payment failed: " + e.getMessage()));
        }
    }

    /* ── DELETE ── */
    private void deleteLoan(String user, HttpServletRequest req, PrintWriter out) {
        String idStr = req.getParameter("id");
        if (empty(idStr)) { out.print(err("No id.")); return; }
        try (Connection c = DBConnection.getUserConnection(user);
             PreparedStatement ps = c.prepareStatement("DELETE FROM Loans WHERE id=?")) {
            ps.setInt(1, Integer.parseInt(idStr));
            ps.executeUpdate();
            out.print("{\"success\":true}");
        } catch (Exception e) { out.print(err("Delete failed.")); }
    }

    private boolean empty(String s) { return s==null||s.trim().isEmpty(); }
    private double  dbl(String s)   { try{ return Double.parseDouble(s); }catch(Exception e){return 0;} }
    private String  err(String msg)  { return "{\"success\":false,\"message\":\""+j(msg)+"\"}"; }
    private String  j(String s)      { return s==null?"":s.replace("\\","\\\\").replace("\"","\\\""); }
}
