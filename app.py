from flask import Flask, jsonify, request, render_template, abort
from flask_cors import CORS
from datetime import datetime
import json
import os

# ---------- CONFIG ----------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data.json")

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# ---------- HELPERS ----------
DEFAULT_DATA = {
    "todo": [],
    "links": [],
    "assignments": [],
    "projects": [],
    "jobs": []
}

def load_data():
    if not os.path.exists(DATA_FILE):
        save_data(DEFAULT_DATA)
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

def get_section_or_404(section):
    data = load_data()
    if section not in data:
        abort(404, description="Section not found")
    return data

def next_id(items):
    return max((item["id"] for item in items), default=0) + 1

# ---------- ROUTES ----------
@app.route("/")
def index():
    return render_template("index.html")

# GET list for a section
@app.route("/api/<section>", methods=["GET"])
def list_section(section):
    data = get_section_or_404(section)
    return jsonify({"ok": True, "items": data[section]})

# CREATE item
@app.route("/api/<section>", methods=["POST"])
def create_item(section):
    data = get_section_or_404(section)
    items = data[section]
    payload = request.get_json() or {}

    if section == "todo":
        title = (payload.get("title") or "").strip()
        if not title:
            return jsonify({"ok": False, "error": "Missing title"}), 400
        item = {
            "id": next_id(items),
            "title": title,
            "description": payload.get("description", ""),
            "completed": False,
            "created_at": datetime.utcnow().isoformat()
        }
    elif section == "links":
        title = (payload.get("title") or "").strip()
        url = (payload.get("url") or payload.get("link") or "").strip()
        if not title or not url:
            return jsonify({"ok": False, "error": "Missing title or url"}), 400
        item = {
            "id": next_id(items),
            "title": title,
            "description": payload.get("description", ""),
            "url": url,
            "created_at": datetime.utcnow().isoformat()
        }
    elif section == "assignments":
        subject = (payload.get("subject") or "").strip()
        title = (payload.get("title") or "").strip()
        due_str = payload.get("due")
        if not subject or not title or not due_str:
            return jsonify({"ok": False, "error": "Missing required fields"}), 400
        try:
            due_date = datetime.fromisoformat(due_str).date() if "T" in due_str else datetime.strptime(due_str, "%Y-%m-%d").date()
        except Exception:
            return jsonify({"ok": False, "error": "Invalid due date format"}), 400
        item = {
            "id": next_id(items),
            "subject": subject,
            "title": title,
            "description": payload.get("description", ""),
            "due": due_date.isoformat(),
            "created_at": datetime.utcnow().isoformat()
        }
    elif section == "projects":
        title = (payload.get("title") or "").strip()
        if not title:
            return jsonify({"ok": False, "error": "Missing title"}), 400
        item = {
            "id": next_id(items),
            "title": title,
            "description": payload.get("description", ""),
            "created_at": datetime.utcnow().isoformat()
        }
    elif section == "jobs":
        job_title = (payload.get("job_title") or "").strip()
        company = (payload.get("company") or "").strip()
        if not job_title or not company:
            return jsonify({"ok": False, "error": "Missing job_title or company"}), 400
        item = {
            "id": next_id(items),
            "job_title": job_title,
            "company": company,
            "requirements": payload.get("requirements", ""),
            "you_do": payload.get("you_do", ""),
            "created_at": datetime.utcnow().isoformat()
        }
    else:
        return jsonify({"ok": False, "error": "Invalid section"}), 400

    items.append(item)
    save_data(data)
    return jsonify({"ok": True, "item": item}), 201

# GET single item
@app.route("/api/<section>/<int:item_id>", methods=["GET"])
def get_item(section, item_id):
    data = get_section_or_404(section)
    items = data[section]
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        abort(404, description="Item not found")
    return jsonify({"ok": True, "item": item})

# UPDATE item
@app.route("/api/<section>/<int:item_id>", methods=["PUT", "PATCH"])
def update_item(section, item_id):
    data = get_section_or_404(section)
    items = data[section]
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        abort(404, description="Item not found")

    payload = request.get_json() or {}

    if section == "todo":
        if "title" in payload: item["title"] = payload["title"].strip() or item["title"]
        if "description" in payload: item["description"] = payload.get("description", "")
        if "completed" in payload: item["completed"] = bool(payload.get("completed"))
    elif section == "links":
        if "title" in payload: item["title"] = payload["title"].strip() or item["title"]
        if "description" in payload: item["description"] = payload.get("description", "")
        if "url" in payload: item["url"] = payload["url"].strip() or item["url"]
        if "link" in payload: item["url"] = payload["link"].strip() or item["url"]
    elif section == "assignments":
        if "subject" in payload: item["subject"] = payload["subject"].strip() or item["subject"]
        if "title" in payload: item["title"] = payload["title"].strip() or item["title"]
        if "description" in payload: item["description"] = payload.get("description", "")
        if "due" in payload:
            try:
                due_date = datetime.fromisoformat(payload["due"]).date() if "T" in payload["due"] else datetime.strptime(payload["due"], "%Y-%m-%d").date()
                item["due"] = due_date.isoformat()
            except Exception:
                return jsonify({"ok": False, "error": "Invalid due date format"}), 400
    elif section == "projects":
        if "title" in payload: item["title"] = payload["title"].strip() or item["title"]
        if "description" in payload: item["description"] = payload.get("description", "")
    elif section == "jobs":
        if "job_title" in payload: item["job_title"] = payload["job_title"].strip() or item["job_title"]
        if "company" in payload: item["company"] = payload["company"].strip() or item["company"]
        if "requirements" in payload: item["requirements"] = payload.get("requirements", "")
        if "you_do" in payload: item["you_do"] = payload.get("you_do", "")

    save_data(data)
    return jsonify({"ok": True, "item": item})

# DELETE item
@app.route("/api/<section>/<int:item_id>", methods=["DELETE"])
def delete_item(section, item_id):
    data = get_section_or_404(section)
    items = data[section]
    new_items = [i for i in items if i["id"] != item_id]
    if len(new_items) == len(items):
        abort(404, description="Item not found")
    data[section] = new_items
    save_data(data)
    return jsonify({"ok": True, "deleted_id": item_id})

# Toggle todo completed quickly
@app.route("/api/todo/<int:item_id>/toggle", methods=["POST"])
def toggle_todo(item_id):
    data = load_data()
    items = data["todo"]
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        abort(404, description="Todo not found")
    item["completed"] = not item["completed"]
    save_data(data)
    return jsonify({"ok": True, "item": item})

# Health check
@app.route("/health")
def health():
    return jsonify({"ok": True, "data_exists": os.path.exists(DATA_FILE)})

# ---------- MAIN ----------
if __name__ == "__main__":
    if not os.path.exists(DATA_FILE):
        save_data(DEFAULT_DATA)
        print("Created new data.json at", DATA_FILE)
    
    # pick port: from env or default to 5001
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=True, host="0.0.0.0", port=port)
