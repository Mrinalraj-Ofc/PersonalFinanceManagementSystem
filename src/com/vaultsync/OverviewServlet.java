package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;

/**
 * OverviewServlet.java
 * ─────────────────────────────────────────────
 * Saves and retrieves the user's financial overview
 * (total balance, monthly income, monthly expense)
 * into/from the Accounts table in the user's own database.
 */
@WebServlet("/OverviewServlet")
public class OverviewServlet extends HttpServlet {

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

        if ("saveStats".equals(action)) {
            saveStats(username, request, out);
        } else if ("getStats".equals(action)) {
            getStats(username, out);
        } else {
            out.print("{\"success\":false,\"message\":\"Unknown action.\"}");
        }
    }

    private void saveStats(String username, HttpServletRequest req, PrintWriter out) {
        String balance = req.getParameter("balance");
        String income  = req.getParameter("income");
        String expense = req.getParameter("expense");

        // MERGE: update if exists, insert if not (SQL Server MERGE syntax)
        String sql =
            "IF EXISTS (SELECT 1 FROM Accounts) " +
            "    UPDATE Accounts SET total_balance=?, monthly_income=?, monthly_expense=?, updated_at=GETDATE() " +
            "ELSE " +
            "    INSERT INTO Accounts (total_balance, monthly_income, monthly_expense) VALUES (?, ?, ?)";

        try (Connection conn = DBConnection.getUserConnection(username);
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            double bal = Double.parseDouble(balance != null ? balance : "0");
            double inc = Double.parseDouble(income  != null ? income  : "0");
            double exp = Double.parseDouble(expense != null ? expense : "0");

            stmt.setDouble(1, bal); stmt.setDouble(2, inc); stmt.setDouble(3, exp);
            stmt.setDouble(4, bal); stmt.setDouble(5, inc); stmt.setDouble(6, exp);
            stmt.executeUpdate();

            out.print("{\"success\":true}");
            System.out.println("[Overview] Stats saved for: " + username);

        } catch (SQLException e) {
            System.err.println("[Overview] Save error: " + e.getMessage());
            out.print("{\"success\":false,\"message\":\"Could not save stats.\"}");
        }
    }

    private void getStats(String username, PrintWriter out) {
        String sql = "SELECT TOP 1 total_balance, monthly_income, monthly_expense FROM Accounts";

        try (Connection conn = DBConnection.getUserConnection(username);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            if (rs.next()) {
                out.print("{" +
                    "\"success\":true," +
                    "\"balance\":" + rs.getDouble("total_balance") + "," +
                    "\"income\":"  + rs.getDouble("monthly_income") + "," +
                    "\"expense\":" + rs.getDouble("monthly_expense") +
                "}");
            } else {
                out.print("{\"success\":false,\"message\":\"No stats found.\"}");
            }
        } catch (SQLException e) {
            out.print("{\"success\":false,\"message\":\"Could not load stats.\"}");
        }
    }
}
