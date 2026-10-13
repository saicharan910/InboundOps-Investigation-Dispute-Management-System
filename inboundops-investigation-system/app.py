import csv
import io
import os
import sqlite3
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, send_from_directory, Response
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND_DIST = ROOT / "frontend" / "dist"
app = Flask(__name__, static_folder=str(FRONTEND_DIST), static_url_path="")
DB_PATH = os.getenv("DATABASE_PATH", str(ROOT / "inboundops.db"))

STATUSES = ["Open", "Investigating", "Pending Partner", "Resolved", "Escalated"]
PRIORITIES = ["Low", "Medium", "High", "Critical"]
REASONS = ["Short payment", "Missing receipt", "Quantity mismatch", "Duplicate charge", "Rate discrepancy", "Documentation gap"]

def db():
    folder = os.path.dirname(DB_PATH)
    if folder:
        os.makedirs(folder, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def init_db():
    conn = db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_ref TEXT UNIQUE NOT NULL,
      seller_name TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      fc_code TEXT NOT NULL,
      reason TEXT NOT NULL,
      expected_amount REAL NOT NULL,
      actual_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'Open',
      priority TEXT NOT NULL DEFAULT 'Medium',
      owner TEXT NOT NULL DEFAULT 'Unassigned',
      summary TEXT NOT NULL,
      due_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolution TEXT DEFAULT '',
      resolved_amount REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      note TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'Operations Analyst',
      created_at TEXT NOT NULL,
      FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS escalations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      level TEXT NOT NULL,
      reason TEXT NOT NULL,
      assigned_team TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
    """)
    count = conn.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
    if count == 0:
        sample = [
          ("INB-26001","Sri Lakshmi Traders","SEL-1042","BLR7","Short payment",48500,42000,"High","Open","A. Kumar","Payment received is lower than the expected inbound settlement. Verify receipt and rate card.",-7),
          ("INB-26002","Northstar Retail","SEL-2091","HYD2","Missing receipt",18300,18300,"Medium","Investigating","R. Sharma","Supporting receipt is missing from the case packet. Request documents and reconcile.",-2),
          ("INB-26003","Coastal Supplies","SEL-3318","MAA4","Quantity mismatch",76200,70100,"Critical","Escalated","S. Reddy","Inbound quantity differs from the submitted receipt. Cross-check receiving records.",-1),
          ("INB-26004","GreenCart Distributors","SEL-4120","BLR7","Duplicate charge",9200,18400,"High","Pending Partner","M. Iyer","Possible duplicate charge detected. Awaiting partner confirmation.",2),
          ("INB-26005","Metro Home Goods","SEL-5102","DEL5","Rate discrepancy",25750,25750,"Low","Resolved","A. Kumar","Rate card reviewed and amount reconciled. No adjustment required.",-4),
          ("INB-26006","BluePeak Electronics","SEL-6710","HYD2","Documentation gap",114000,98000,"Critical","Open","Unassigned","High-value discrepancy requires invoice and inbound proof review.",-1),
          ("INB-26007","Aster Foods","SEL-7190","MAA4","Short payment",32900,32900,"Medium","Investigating","R. Sharma","Payment variance is under review against the latest settlement statement.",1),
          ("INB-26008","UrbanNest Living","SEL-8033","PUN3","Quantity mismatch",14800,12100,"High","Open","M. Iyer","Three units appear unaccounted for between expected and received quantities.",3),
          ("INB-26009","Pioneer Textiles","SEL-9184","DEL5","Missing receipt",56000,56000,"Medium","Pending Partner","S. Reddy","Partner confirmation requested; follow up before SLA deadline.",0),
          ("INB-26010","Sunrise Wholesale","SEL-1007","BLR7","Rate discrepancy",6700,6200,"Low","Resolved","A. Kumar","Rate difference confirmed and recorded for reporting.",-6),
          ("INB-26011","Evergreen Mart","SEL-1182","HYD2","Short payment",88400,81400,"Critical","Open","Unassigned","Large payment gap; validate settlement reference and supporting evidence.",-2),
          ("INB-26012","Nova Stationers","SEL-1288","PUN3","Duplicate charge",12400,12400,"Medium","Investigating","M. Iyer","Duplicate-charge hypothesis being checked against transaction references.",4),
        ]
        for i, row in enumerate(sample):
            seller, seller_id, fc, reason, expected, actual, priority, status, owner, summary, due_offset = row
            created = datetime.utcnow() - timedelta(days=abs(due_offset) + 2)
            due = datetime.utcnow() + timedelta(days=due_offset)
            cur = conn.execute("""INSERT INTO cases
              (case_ref,seller_name,seller_id,fc_code,reason,expected_amount,actual_amount,currency,status,priority,owner,summary,due_at,created_at,updated_at,resolution,resolved_amount)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (f"INB-26{100+i}", seller, seller_id, fc, reason, expected, actual, "INR", status, priority, owner, summary,
               due.replace(microsecond=0).isoformat()+"Z", created.replace(microsecond=0).isoformat()+"Z",
               now_iso(), "Reconciled and closed" if status == "Resolved" else "", expected-actual if status == "Resolved" else 0))
            case_id = cur.lastrowid
            conn.execute("INSERT INTO activity(case_id,action,note,actor,created_at) VALUES(?,?,?,?,?)",
                         (case_id, "Case created", "Sample case imported into the investigation queue.", "System", now_iso()))
            if status == "Escalated":
                conn.execute("INSERT INTO escalations(case_id,level,reason,assigned_team,created_at,status) VALUES(?,?,?,?,?,?)",
                             (case_id, "L2", "High-value quantity mismatch needs cross-team review.", "Inbound Support", now_iso(), "Open"))
    conn.commit()
    conn.close()

def rowdict(row):
    return dict(row) if row else None

def add_activity(conn, case_id, action, note, actor="Operations Analyst"):
    conn.execute("INSERT INTO activity(case_id,action,note,actor,created_at) VALUES(?,?,?,?,?)",
                 (case_id, action, note, actor, now_iso()))

@app.get("/api/health")
def health():
    return jsonify({"status":"ok","service":"InboundOps","database":"SQLite"})

@app.get("/api/meta")
def meta():
    return jsonify({"statuses": STATUSES, "priorities": PRIORITIES, "reasons": REASONS,
                    "fulfillment_centres": ["BLR7","HYD2","MAA4","DEL5","PUN3"]})

@app.get("/api/stats")
def stats():
    conn = db()
    cases = conn.execute("SELECT * FROM cases").fetchall()
    today = datetime.utcnow()
    open_cases = [c for c in cases if c["status"] not in ("Resolved",)]
    overdue = [c for c in open_cases if datetime.fromisoformat(c["due_at"].replace("Z","+00:00")).replace(tzinfo=None) < today]
    gap = sum(max(0, c["expected_amount"] - c["actual_amount"]) for c in cases if c["status"] != "Resolved")
    resolved = [c for c in cases if c["status"] == "Resolved"]
    by_status = {s: sum(1 for c in cases if c["status"] == s) for s in STATUSES}
    by_fc = []
    for fc in ["BLR7","HYD2","MAA4","DEL5","PUN3"]:
        subset = [c for c in cases if c["fc_code"] == fc]
        by_fc.append({"fc_code":fc,"cases":len(subset),"disputed_amount":round(sum(max(0,c["expected_amount"]-c["actual_amount"]) for c in subset),2)})
    by_reason = []
    for reason in REASONS:
        subset = [c for c in cases if c["reason"] == reason]
        if subset:
            by_reason.append({"reason":reason,"count":len(subset)})
    conn.close()
    return jsonify({"total_cases":len(cases),"open_cases":len(open_cases),"overdue_cases":len(overdue),
      "escalated_cases":sum(1 for c in cases if c["status"]=="Escalated"),
      "resolved_cases":len(resolved),"resolution_rate":round(len(resolved)/len(cases)*100,1) if cases else 0,
      "open_disputed_amount":round(gap,2),"by_status":by_status,"by_fc":by_fc,"by_reason":by_reason})

@app.get("/api/cases")
def list_cases():
    conn = db()
    search = request.args.get("search","").strip()
    status = request.args.get("status","")
    priority = request.args.get("priority","")
    fc = request.args.get("fc","")
    clauses, params = [], []
    if search:
        clauses.append("(case_ref LIKE ? OR seller_name LIKE ? OR seller_id LIKE ? OR reason LIKE ? OR fc_code LIKE ?)")
        params += [f"%{search}%"]*5
    if status:
        clauses.append("status = ?"); params.append(status)
    if priority:
        clauses.append("priority = ?"); params.append(priority)
    if fc:
        clauses.append("fc_code = ?"); params.append(fc)
    sql = "SELECT * FROM cases" + (" WHERE " + " AND ".join(clauses) if clauses else "") + " ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, due_at ASC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return jsonify([rowdict(r) for r in rows])

@app.get("/api/cases/<int:case_id>")
def get_case(case_id):
    conn = db()
    case = conn.execute("SELECT * FROM cases WHERE id=?", (case_id,)).fetchone()
    if not case:
        conn.close(); return jsonify({"error":"Case not found"}), 404
    activity = conn.execute("SELECT * FROM activity WHERE case_id=? ORDER BY id DESC", (case_id,)).fetchall()
    escalations = conn.execute("SELECT * FROM escalations WHERE case_id=? ORDER BY id DESC", (case_id,)).fetchall()
    conn.close()
    result = rowdict(case)
    result["activity"] = [rowdict(r) for r in activity]
    result["escalations"] = [rowdict(r) for r in escalations]
    return jsonify(result)

@app.post("/api/cases")
def create_case():
    data = request.get_json(silent=True) or {}
    required = ["seller_name","seller_id","fc_code","reason","expected_amount","actual_amount","summary","due_at"]
    missing = [key for key in required if data.get(key) in (None,"")]
    if missing: return jsonify({"error":"Required fields missing: " + ", ".join(missing)}), 400
    try:
        expected, actual = float(data["expected_amount"]), float(data["actual_amount"])
        if expected < 0 or actual < 0: raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error":"Amounts must be valid non-negative numbers."}), 400
    conn = db()
    next_num = conn.execute("SELECT COALESCE(MAX(id),0)+1 FROM cases").fetchone()[0]
    ref = f"INB-{datetime.utcnow():%y}{next_num:04d}"
    created = now_iso()
    try:
        cur = conn.execute("""INSERT INTO cases
          (case_ref,seller_name,seller_id,fc_code,reason,expected_amount,actual_amount,currency,status,priority,owner,summary,due_at,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
          (ref,data["seller_name"].strip(),data["seller_id"].strip(),data["fc_code"],data["reason"],expected,actual,"INR",
           data.get("status","Open"),data.get("priority","Medium"),data.get("owner","Unassigned"),data["summary"].strip(),
           data["due_at"],created,created))
        case_id = cur.lastrowid
        add_activity(conn, case_id, "Case created", "New investigation case created.")
        conn.commit()
    except sqlite3.IntegrityError:
        conn.rollback(); conn.close(); return jsonify({"error":"Could not create case. Check the supplied values."}), 400
    conn.close()
    return jsonify({"id":case_id,"case_ref":ref}), 201

@app.patch("/api/cases/<int:case_id>")
def update_case(case_id):
    data = request.get_json(silent=True) or {}
    allowed = {"status","priority","owner","summary","resolution","resolved_amount","expected_amount","actual_amount","reason","fc_code"}
    updates = {k:v for k,v in data.items() if k in allowed}
    if not updates: return jsonify({"error":"No supported fields provided."}), 400
    if "status" in updates and updates["status"] not in STATUSES: return jsonify({"error":"Invalid status."}), 400
    if "priority" in updates and updates["priority"] not in PRIORITIES: return jsonify({"error":"Invalid priority."}), 400
    for key in ("expected_amount","actual_amount","resolved_amount"):
        if key in updates:
            try:
                updates[key] = float(updates[key])
                if updates[key] < 0: raise ValueError()
            except (TypeError,ValueError): return jsonify({"error":f"{key} must be a non-negative number."}), 400
    conn = db()
    existing = conn.execute("SELECT * FROM cases WHERE id=?", (case_id,)).fetchone()
    if not existing: conn.close(); return jsonify({"error":"Case not found"}), 404
    sets = list(updates.keys()) + ["updated_at"]
    values = list(updates.values()) + [now_iso(), case_id]
    conn.execute("UPDATE cases SET " + ", ".join(f"{k}=?" for k in sets) + " WHERE id=?", values)
    changes = ", ".join(f"{k.replace('_',' ')} → {v}" for k,v in updates.items())
    add_activity(conn, case_id, "Case updated", changes)
    if updates.get("status") == "Resolved":
        conn.execute("UPDATE cases SET resolution=CASE WHEN resolution='' THEN 'Reviewed and marked resolved' ELSE resolution END WHERE id=?", (case_id,))
    conn.commit(); conn.close()
    return jsonify({"success":True})

@app.post("/api/cases/<int:case_id>/notes")
def add_note(case_id):
    data = request.get_json(silent=True) or {}
    note = str(data.get("note","")).strip()
    if not note: return jsonify({"error":"Enter an investigation note."}), 400
    conn = db()
    if not conn.execute("SELECT id FROM cases WHERE id=?", (case_id,)).fetchone():
        conn.close(); return jsonify({"error":"Case not found"}), 404
    add_activity(conn, case_id, "Investigation note", note, str(data.get("actor","Operations Analyst"))[:80])
    conn.execute("UPDATE cases SET updated_at=? WHERE id=?", (now_iso(),case_id))
    conn.commit(); conn.close()
    return jsonify({"success":True}), 201

@app.post("/api/cases/<int:case_id>/escalate")
def escalate(case_id):
    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason","")).strip()
    team = str(data.get("assigned_team","Inbound Support")).strip()
    level = str(data.get("level","L2"))
    if not reason: return jsonify({"error":"Provide an escalation reason."}), 400
    if level not in ("L1","L2","L3"): return jsonify({"error":"Choose L1, L2, or L3."}), 400
    conn = db()
    case = conn.execute("SELECT id FROM cases WHERE id=?", (case_id,)).fetchone()
    if not case: conn.close(); return jsonify({"error":"Case not found"}), 404
    conn.execute("INSERT INTO escalations(case_id,level,reason,assigned_team,created_at,status) VALUES(?,?,?,?,?,'Open')",
                 (case_id,level,reason,team,now_iso()))
    conn.execute("UPDATE cases SET status='Escalated',updated_at=? WHERE id=?", (now_iso(),case_id))
    add_activity(conn,case_id,"Escalated",f"{level} escalation to {team}: {reason}")
    conn.commit(); conn.close()
    return jsonify({"success":True}), 201

@app.get("/api/export.csv")
def export_csv():
    conn = db()
    rows = conn.execute("SELECT case_ref,seller_name,seller_id,fc_code,reason,expected_amount,actual_amount,(expected_amount-actual_amount) AS variance,status,priority,owner,due_at,created_at,updated_at FROM cases ORDER BY created_at DESC").fetchall()
    conn.close()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(rows[0].keys() if rows else ["case_ref","seller_name","seller_id","fc_code","reason","expected_amount","actual_amount","variance","status","priority","owner","due_at","created_at","updated_at"])
    for row in rows: writer.writerow(list(row))
    return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition":"attachment; filename=inboundops-cases.csv"})

@app.get("/")
def index():
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return send_from_directory(FRONTEND_DIST, "index.html")
    return ("Frontend is not built. Run: cd frontend && npm install && npm run build", 503)

@app.get("/<path:path>")
def frontend_files(path):
    candidate = FRONTEND_DIST / path
    if candidate.exists() and candidate.is_file():
        return send_from_directory(FRONTEND_DIST, path)
    if (FRONTEND_DIST / "index.html").exists():
        return send_from_directory(FRONTEND_DIST, "index.html")
    return ("Frontend is not built. Run: cd frontend && npm install && npm run build", 503)

init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)
