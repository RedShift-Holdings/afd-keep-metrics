"""
Assembles the two per-month JSON payloads (owner = full detail, team = aggregate-only)
from already-verified AFD July 2026 figures (see _clients/AFD/Reports/ PDFs, same session).

This is the "for now" data-entry step: run this (or a CSV-driven equivalent, see
parse_csv_example.py) once a month, review the JSON, then run encrypt_data.py to
produce the .enc files that actually ship to the site.
"""
import json, os

CLIENT = "afd"
PERIOD = "2026-07"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", CLIENT, PERIOD)
os.makedirs(OUT_DIR, exist_ok=True)

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
        {"dept": "Dental Assistants", "staffCount": 8, "hours": "1042:38", "notes": "Includes Dr. Mitchell (holiday pay only)"},
        {"dept": "Dental Hygienists", "staffCount": 3, "hours": "477:21", "notes": "Matches the 3 hygienist providers above"},
        {"dept": "Front Office", "staffCount": 3, "hours": "182:41", "notes": "Only 1 of 3 worked a full month"},
    ],
    "tardiness": {
        "methodology": "No official scheduled start time exists in source data; 'late' = personal median arrival + 15min, weekdays only, excludes holiday/vacation.",
        "deptMedianArrival": {"Front Office": "7:33 AM", "Dental Hygienists": "7:50 AM", "Dental Assistants": "7:52 AM"},
        "employees": [
            {"employee": "Mitchell, Zachary R", "dept": "Dental Assistants", "daysWorked": 10, "medianArrival": "8:00 AM",
             "lateDays": [{"date":"07/07","time":"10:25 AM","deltaMin":145},{"date":"07/14","time":"10:22 AM","deltaMin":142},
                          {"date":"07/20","time":"9:59 AM","deltaMin":119},{"date":"07/06","time":"9:39 AM","deltaMin":99}]},
            {"employee": "Arevalo, Marleny", "dept": "Dental Assistants", "daysWorked": 21, "medianArrival": "8:09 AM",
             "lateDays": [{"date":"07/27","time":"10:49 AM","deltaMin":160},{"date":"07/29","time":"8:50 AM","deltaMin":41},
                          {"date":"07/24","time":"8:27 AM","deltaMin":18}]},
            {"employee": "Youngman, Kayla", "dept": "Dental Assistants", "daysWorked": 22, "medianArrival": "7:37 AM",
             "lateDays": [{"date":"07/15","time":"1:52 PM","deltaMin":375},{"date":"07/07","time":"7:57 AM","deltaMin":20},
                          {"date":"07/10","time":"7:55 AM","deltaMin":18}]},
            {"employee": "Majkich, Karen M", "dept": "Dental Hygienists", "daysWorked": 20, "medianArrival": "7:41 AM",
             "lateDays": [{"date":"07/09","time":"1:35 PM","deltaMin":354},{"date":"07/01","time":"7:58 AM","deltaMin":17}]},
            {"employee": "Roman, Thomas", "dept": "Dental Assistants", "daysWorked": 19, "medianArrival": "7:33 AM",
             "lateDays": [{"date":"07/02","time":"7:51 AM","deltaMin":18},{"date":"07/22","time":"7:49 AM","deltaMin":16}]},
            {"employee": "Manzoor, Munazah", "dept": "Dental Hygienists", "daysWorked": 18, "medianArrival": "7:54 AM",
             "lateDays": [{"date":"07/09","time":"8:58 AM","deltaMin":64}]},
            {"employee": "Rodriguez, Samantha", "dept": "Dental Assistants", "daysWorked": 20, "medianArrival": "8:01 AM",
             "lateDays": [{"date":"07/31","time":"8:22 AM","deltaMin":21}]},
            {"employee": "Barber, Jacqueline", "dept": "Front Office", "daysWorked": 21, "medianArrival": "7:33 AM", "lateDays": []},
            {"employee": "Johnson, Latavia", "dept": "Dental Hygienists", "daysWorked": 21, "medianArrival": "7:50 AM", "lateDays": []},
            {"employee": "Maldonado-Mancilla, Ivonne", "dept": "Dental Assistants", "daysWorked": 22, "medianArrival": "7:49 AM", "lateDays": []},
        ],
    },
    "daysOff": {
        "businessDays": 22,
        "holidayDate": "07/03/2026",
        "vacation": [
            {"employee": "Arevalo, Marleny", "dept": "Dental Assistants", "dates": "7/17 (partial day)", "days": "1 (partial)", "hours": 5.0},
            {"employee": "Mitchell, Zachary R", "dept": "Dental Assistants", "dates": "7/27 - 7/31 (full week)", "days": 5, "hours": 40.0},
        ],
        "noPunchGaps": [
            {"employee": "Trimble, Rosanne", "dept": "Front Office", "gapDays": 22, "note": "No activity all month beyond the holiday"},
            {"employee": "Fonseca Osorio, Stephanie", "dept": "Front Office", "gapDays": 22, "note": "No activity all month beyond the holiday"},
            {"employee": "Lyubavina, Ekaterina E", "dept": "Dental Assistants", "gapDays": 22, "note": "No activity all month beyond the holiday"},
            {"employee": "Mitchell, Daniel", "dept": "Dentist (provider)", "gapDays": 22, "note": "Expected - doesn't punch a clock"},
            {"employee": "Mitchell, Zachary R", "dept": "Dental Assistants", "gapDays": 7, "note": "On top of 5 vacation days"},
            {"employee": "Manzoor, Munazah", "dept": "Dental Hygienists", "gapDays": 4, "note": "All 4 remaining Fridays - looks like a standing 4-day week"},
            {"employee": "Roman, Thomas", "dept": "Dental Assistants", "gapDays": 3, "note": ""},
            {"employee": "Rodriguez, Samantha", "dept": "Dental Assistants", "gapDays": 2, "note": "Back-to-back 7/23-7/24"},
            {"employee": "Majkich, Karen M", "dept": "Dental Hygienists", "gapDays": 2, "note": ""},
            {"employee": "Barber, Jacqueline", "dept": "Front Office", "gapDays": 1, "note": ""},
            {"employee": "Johnson, Latavia", "dept": "Dental Hygienists", "gapDays": 1, "note": ""},
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
# GOALS — a standing baseline, NOT month-specific performance data.
# Stored in plaintext (not encrypted): a target number alone doesn't
# disclose actual performance or client identity, so it's a reasonable
# exception to the encrypt-everything rule. Editable via the Settings tab.
# ---------------------------------------------------------------
goals = {
    "collectionsGoal": 250000.00,
    "departmentGoals": {"Dentists": 190000.00, "Hygienists": 70000.00},
    "addOnGoal": 20000.00,
    "newPatientsGoal": 40,
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

on_time_days = sum(e["daysWorked"] - len(e["lateDays"]) for e in owner["tardiness"]["employees"])
total_days = sum(e["daysWorked"] for e in owner["tardiness"]["employees"])

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
