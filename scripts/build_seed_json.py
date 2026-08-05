"""
Assembles the two per-month JSON payloads (owner = full detail, team = aggregate-only)
from already-verified AFD July 2026 figures (see _clients/AFD/Reports/ PDFs, same session).

Tardiness/lunch figures below are computed from recomputed_tardiness.json (produced by
parsing the raw Timecard PDF - see that file's own generation script in scratch), using
the REAL company policy Glenn gave us, not a statistical guess:
  - Scheduled start 7:50 AM; not late until after 8:10 AM (20-min grace window).
  - Lunch runs 1:00-2:00 PM; only flagged if the midday gap runs over 60 minutes.
  - Mitchell, Zachary R is part-time and does not follow the standard schedule -
    excluded from the lateness check entirely.
  - Trimble, Rosanne / Fonseca Osorio, Stephanie / Lyubavina, Ekaterina E / Mitchell,
    Daniel are INACTIVE employees (confirmed by Glenn) - their holiday-pay-only records
    are a payroll artifact, not an attendance gap, so they're excluded from the active
    roster entirely rather than flagged.

This is the "for now" data-entry step: run this (or a CSV-driven equivalent, see
parse_csv_example.py) once a month, review the JSON, then run encrypt_data.py to
produce the .enc files that actually ship to the site.
"""
import json, os

CLIENT = "afd"
PERIOD = "2026-07"
SCRIPT_DIR = os.path.dirname(__file__)
OUT_DIR = os.path.join(SCRIPT_DIR, "..", "data", CLIENT, PERIOD)
os.makedirs(OUT_DIR, exist_ok=True)

tard_raw = json.load(open(os.path.join(SCRIPT_DIR, "recomputed_tardiness.json")))

DEPTS = {
    "Arevalo Marleny": "Dental Assistants", "Barber Jacqueline": "Front Office",
    "Rodriguez Samantha": "Dental Assistants", "Roman Thomas": "Dental Assistants",
    "Youngman Kayla": "Dental Assistants", "Johnson Latavia": "Dental Hygienists",
    "Majkich Karen M": "Dental Hygienists", "Maldonado-Mancilla Ivonne": "Dental Assistants",
    "Manzoor Munazah": "Dental Hygienists", "Mitchell Zachary R": "Dental Assistants",
}
INACTIVE = ["Trimble Rosanne", "Fonseca Osorio Stephanie", "Lyubavina Ekaterina E", "Mitchell Daniel"]
PART_TIME = {"Mitchell Zachary R"}

def display_name(raw):
    # "Arevalo Marleny" -> "Arevalo, Marleny"; "Mitchell Zachary R" -> "Mitchell, Zachary R"
    first_space = raw.find(" ")
    return raw[:first_space] + "," + raw[first_space:]

tardiness_employees = []
for raw_name, dept in DEPTS.items():
    late = [{"date": d[0][:5], "time": d[2], "deltaMin": d[3]} for d in tard_raw["late"].get(raw_name, [])]
    lunch = [{"date": l[0][:5], "outTime": l[2], "inTime": l[3], "minutes": l[4]} for l in tard_raw["lunch"].get(raw_name, [])]
    tardiness_employees.append({
        "employee": display_name(raw_name),
        "dept": dept,
        "daysWorked": tard_raw["worked_days"].get(raw_name, 0),
        "nonStandardSchedule": raw_name in PART_TIME,
        "lateDays": late,
        "lunchOverages": lunch,
    })

# ---------------------------------------------------------------
# OWNER VIEW — everything. Only the doctor's password unlocks this.
# ---------------------------------------------------------------
owner = {
    "client": "Atlantic Family Dentistry",
    "period": "July 2026",
    "prepared": "2026-08-05",
    "performance": {
        "current": {"production": 258401.69, "prodAdj": 1323.40, "collections": 231930.90, "arBalance": -108943.05},
        "prior": {"production": 252736.78, "prodAdj": 669.20, "collections": 229324.69},
        "ytd": {"production": 1841201.62, "prodAdj": 18779.32, "collections": 1763189.23},
    },
    "providers": [
        {"name": "Dr. Mitchell", "role": "Dentist", "production": 110593.50, "adjustments": 17330.40, "collections": 88082.85, "collRate": 91},
        {"name": "Dr. Yassa", "role": "Dentist", "production": 76135.69, "adjustments": 9521.70, "collections": 69018.54, "collRate": 103},
        {"name": "Tay (HY19)", "role": "Hygienist", "production": 26742.50, "adjustments": 2424.00, "collections": 15696.39, "collRate": 66},
        {"name": "Karen (HY20)", "role": "Hygienist", "production": 23376.00, "adjustments": 773.00, "collections": 17046.61, "collRate": 76},
        {"name": "Munazah (HY15)", "role": "Hygienist", "production": 21341.00, "adjustments": 1036.60, "collections": 13848.01, "collRate": 70},
    ],
    "patientAging": {"current": -190408.33, "d31_60": 24645.42, "d61_90": 10929.00, "over90": 46055.86, "insEst": 97542.30, "guarPortion": -206320.35},
    "insuranceAging": {
        "primary": {"current": 116697.00, "d31_60": 12561.00, "d61_90": 9984.00, "over90": 9648.00},
        "secondary": {"current": 3279.00, "d31_60": 2850.00, "d61_90": 74.00, "over90": 3246.00},
    },
    "agedClaims": [
        {"patient": "Fulton, Benjamin", "payer": "Aetna / Individual $1000 OON", "bucket": "61-90", "amount": 2869.00},
        {"patient": "Carter, Derek", "payer": "Southeastern Iron Workers Ins", "bucket": "Over 90", "amount": 2104.00},
        {"patient": "Drexler, Jean", "payer": "Excellus BCBS / Catskill Area SD", "bucket": "Over 90", "amount": 1896.00},
        {"patient": "Hartung, David", "payer": "Humana 2026 / DENA50", "bucket": "31-60", "amount": 1890.00},
        {"patient": "Sita, Valerie", "payer": "Delta Dental of GA / School Board", "bucket": "31-60", "amount": 1705.00},
        {"patient": "Kemp, Robert *", "payer": "United Health Care / Golden Rule", "bucket": "61-90", "amount": 1482.00},
        {"patient": "Legere, James", "payer": "United Health Care / Prev Only", "bucket": "31-60", "amount": 1507.00},
        {"patient": "Luff, Dana", "payer": "Delta Dental of GA / School Board - PREM", "bucket": "31-60", "amount": 1113.00},
        {"patient": "Ryan, Craig S", "payer": "Delta Dental / Brunswick Corp - Boat PREM", "bucket": "61-90", "amount": 1070.00},
        {"patient": "Pidskalny, Bryn", "payer": "Delta Dental / Individual 2000", "bucket": "Over 90", "amount": 945.00},
    ],
    "labor": [
        {"dept": "Dental Assistants", "staffCount": 6, "hours": "1042:38", "notes": "Includes Mitchell, Zachary R (part-time, non-standard schedule)"},
        {"dept": "Dental Hygienists", "staffCount": 3, "hours": "477:21", "notes": "Matches the 3 hygienist providers above"},
        {"dept": "Front Office", "staffCount": 1, "hours": "182:41", "notes": "Barber, Jacqueline is the only active front-office employee"},
    ],
    "tardinessPolicy": {
        "scheduledStart": "7:50 AM",
        "lateAfter": "8:10 AM",
        "lunchWindow": "1:00 PM - 2:00 PM",
        "lunchMaxMinutes": 60,
        "nonStandardEmployees": ["Mitchell, Zachary R"],
    },
    "tardiness": {
        "methodology": "Company policy: scheduled start 7:50 AM, not late until after 8:10 AM. Lunch runs "
                        "1:00-2:00 PM (60 min); only flagged if the midday gap runs over 60 minutes. "
                        "Mitchell, Zachary R is part-time and does not follow the standard schedule.",
        "note": "7/2 shows a lunch-overage across almost every active employee - most likely a practice-wide "
                "event (meeting/training/early close) the day before the July 3 holiday, not individually long lunches.",
        "employees": tardiness_employees,
    },
    "daysOff": {
        "businessDays": 22,
        "holidayDate": "07/03/2026",
        "vacation": [
            {"employee": "Arevalo, Marleny", "dept": "Dental Assistants", "dates": "7/17 (partial day)", "days": "1 (partial)", "hours": 5.0},
            {"employee": "Mitchell, Zachary R", "dept": "Dental Assistants", "dates": "7/27 - 7/31 (full week)", "days": 5, "hours": 40.0},
        ],
        "noPunchGaps": [
            {"employee": "Mitchell, Zachary R", "dept": "Dental Assistants", "gapDays": 7, "note": "Part-time, non-standard schedule - on top of 5 vacation days, not flagged as an attendance concern"},
            {"employee": "Manzoor, Munazah", "dept": "Dental Hygienists", "gapDays": 4, "note": "All 4 remaining Fridays - looks like a standing 4-day week"},
            {"employee": "Roman, Thomas", "dept": "Dental Assistants", "gapDays": 3, "note": ""},
            {"employee": "Rodriguez, Samantha", "dept": "Dental Assistants", "gapDays": 2, "note": "Back-to-back 7/23-7/24"},
            {"employee": "Majkich, Karen M", "dept": "Dental Hygienists", "gapDays": 2, "note": ""},
            {"employee": "Barber, Jacqueline", "dept": "Front Office", "gapDays": 1, "note": ""},
            {"employee": "Johnson, Latavia", "dept": "Dental Hygienists", "gapDays": 1, "note": ""},
        ],
        "inactiveEmployees": [
            {"employee": "Trimble, Rosanne", "dept": "Front Office"},
            {"employee": "Fonseca Osorio, Stephanie", "dept": "Front Office"},
            {"employee": "Lyubavina, Ekaterina E", "dept": "Dental Assistants"},
            {"employee": "Mitchell, Daniel", "dept": "Dental Assistants"},
        ],
    },
    # PLACEHOLDER - AFD hasn't sent new-patient or add-on-service numbers yet.
    # These are example figures so the Entry form / team goal-vs-actual view
    # has something real to compute against; replace via the Entry tab once
    # real numbers exist.
    "newPatients": {"actual": 34},
    "addOnServices": [
        {"name": "Orthodontics", "production": 12500.00},
        {"name": "Teeth Whitening", "production": 1850.00},
        {"name": "Implants", "production": 8200.00},
    ],
}

# ---------------------------------------------------------------
# GOALS + BASELINES — standing settings, NOT month-specific performance
# data. Stored in plaintext (not encrypted): none of this discloses actual
# performance or client identity, so it's a reasonable exception to the
# encrypt-everything rule. Editable via the Settings tab.
# ---------------------------------------------------------------
goals = {
    "collectionsGoal": 250000.00,
    "departmentGoals": {"Dentists": 190000.00, "Hygienists": 70000.00},
    "addOnGoal": 20000.00,
    "newPatientsGoal": 40,
    "tardinessPolicy": owner["tardinessPolicy"],
}

# ---------------------------------------------------------------
# TEAM VIEW — aggregate + positive-framing only. No individual
# tardiness/absence call-outs, no per-patient claim detail.
# ---------------------------------------------------------------
dept_totals = {}
for pv in owner["providers"]:
    role_dept = "Dentists" if pv["role"] == "Dentist" else "Hygienists"
    d = dept_totals.setdefault(role_dept, {"production": 0, "collections": 0})
    d["production"] += pv["production"]
    d["collections"] += pv["collections"]

# on-time rate excludes non-standard-schedule employees, same as the policy itself
standard_emps = [e for e in owner["tardiness"]["employees"] if not e["nonStandardSchedule"]]
on_time_days = sum(e["daysWorked"] - len(e["lateDays"]) for e in standard_emps)
total_days = sum(e["daysWorked"] for e in standard_emps)

team = {
    "client": "Atlantic Family Dentistry",
    "period": "July 2026",
    "prepared": "2026-08-05",
    "kpis": {
        "production": owner["performance"]["current"]["production"],
        "collections": owner["performance"]["current"]["collections"],
        "collectionRatePct": round(owner["performance"]["current"]["collections"] / owner["performance"]["current"]["production"] * 100),
        "productionChangePct": round((owner["performance"]["current"]["production"] - owner["performance"]["prior"]["production"]) / owner["performance"]["prior"]["production"] * 100, 1),
    },
    "byDepartment": [
        {"dept": name, "production": round(v["production"], 2), "collections": round(v["collections"], 2)}
        for name, v in dept_totals.items()
    ],
    "attendance": {
        "onTimeRatePct": round(on_time_days / total_days * 100) if total_days else None,
        "vacationDaysTaken": sum(1 if v["days"] == 1 or v["days"] == "1 (partial)" else v["days"] for v in owner["daysOff"]["vacation"]),
        "holidayDate": owner["daysOff"]["holidayDate"],
        "note": "Team-wide on-time rate and time-off totals only - individual detail lives in the owner report.",
    },
    "labor": [{"dept": l["dept"], "staffCount": l["staffCount"], "hours": l["hours"]} for l in owner["labor"]],
    "newPatients": {"actual": owner["newPatients"]["actual"]},
    "addOnProduction": round(sum(a["production"] for a in owner["addOnServices"]), 2),
}

with open(os.path.join(OUT_DIR, "owner-view.json"), "w") as f:
    json.dump(owner, f, indent=2)
with open(os.path.join(OUT_DIR, "team-view.json"), "w") as f:
    json.dump(team, f, indent=2)
with open(os.path.join(OUT_DIR, "goals.json"), "w") as f:
    json.dump(goals, f, indent=2)

print("Wrote owner-view.json and team-view.json to", OUT_DIR)
print(f"On-time rate (standard-schedule employees only): {on_time_days}/{total_days} = {round(on_time_days/total_days*100)}%")
