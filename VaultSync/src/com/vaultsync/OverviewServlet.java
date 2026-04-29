package com.vaultsync;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.*;
import java.sql.*;

/* ── OverviewServlet — saves/loads balance,income,expense ── */
@WebServlet("/OverviewServlet")
public class OverviewServlet extends HttpServlet {

    @Override public void init() throws ServletException { DBConnection.loadDriver(); }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {
        res.setContentType("application/json"); res.setCharacterEncoding("UTF-8");
        PrintWriter out = res.getWriter();
        String action   = req.getParameter("action");
        String username = req.getParameter("username");
        if (empty(username)) { out.print(err("Not authenticated.")); return; }
        username = username.trim().toLowerCase();

        if ("saveStats".equals(action)) {
            double bal = dbl(req,"balance"), inc = dbl(req,"income"), exp = dbl(req,"expense");
            String sql =
                "IF EXISTS (SELECT 1 FROM Accounts) " +
                "   UPDATE Accounts SET total_balance=?,monthly_income=?,monthly_expense=?,updated_at=GETDATE() " +
                "ELSE " +
                "   INSERT INTO Accounts(total_balance,monthly_income,monthly_expense) VALUES(?,?,?)";
            try (Connection c=DBConnection.getUserConnection(username);
                 PreparedStatement ps=c.prepareStatement(sql)) {
                ps.setDouble(1,bal);ps.setDouble(2,inc);ps.setDouble(3,exp);
                ps.setDouble(4,bal);ps.setDouble(5,inc);ps.setDouble(6,exp);
                ps.executeUpdate();
                out.print("{\"success\":true}");
            } catch(SQLException e){ out.print(err(e.getMessage())); }

        } else if ("getStats".equals(action)) {
            try (Connection c=DBConnection.getUserConnection(username);
                 Statement st=c.createStatement();
                 ResultSet rs=st.executeQuery("SELECT TOP 1 total_balance,monthly_income,monthly_expense FROM Accounts")) {
                if (rs.next()) {
                    out.print("{\"success\":true,\"balance\":"+rs.getDouble(1)+
                              ",\"income\":"+rs.getDouble(2)+",\"expense\":"+rs.getDouble(3)+"}");
                } else { out.print("{\"success\":false}"); }
            } catch(SQLException e){ out.print("{\"success\":false}"); }
        }
    }

    private boolean empty(String s){ return s==null||s.trim().isEmpty(); }
    private String  err(String m)  { return "{\"success\":false,\"message\":\""+m+"\"}"; }
    private double  dbl(HttpServletRequest req, String p){
        try{ return Double.parseDouble(req.getParameter(p)); }catch(Exception e){return 0;}
    }
}
