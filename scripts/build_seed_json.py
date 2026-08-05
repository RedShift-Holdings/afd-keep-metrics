"""
Assembles the THREE per-month JSON payloads for Keep Metrics from already-verified
AFD July 2026 figures (see _clients/AFD/Reports/ PDFs, same session):

  admin-view   full operational report + goal/baseline editing (the doctor)
  manager-view full operational report, enters the monthly numbers, no goal editing
  team-view    positive aggregates + goal-vs-actual only (breakroom screen)

Each is encrypted separately (see encrypt_data.py) with its own password, so the
security boundary is "which key do you hold," not a client-side role flag.

Tardiness uses the REAL company policy Glenn gave us:
  - Scheduled start 7:50 AM; not late until after 8:10 AM (20-min grace window).
  - Lunch runs 1:00-2:00 PM; flagged only if the midday gap runs over 60 minutes.
  - Mitchell, Zachary R is part-time / non-standard-schedule - excluded from the
    lateness check entirely.
  - Trimble Rosanne / Fonseca Osorio Stephanie / Lyubavina Ekaterina E / Mitchell
    Daniel are INACTIVE (Glenn confirmed). They're dropped entirely - not shown.
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
PART_TIME = {"Mitchell Zachary R"}
# Key leaders whose time is examined separately from their functional department.
# The two dentists are also leaders but production-based (they don't punch a clock),
# so the attendance leadership bucket is Leny (Arevalo) + Sammie (Rodriguez).
LEADERS = {"Arevalo Marleny", "Rodriguez Samantha"}
LEADER_GROUP = "Key Leaders"

def display_name(raw):
    i = raw.find(" ")
    return raw[:i] + "," + raw[i:]

tardiness_employees = []
for raw_name, dept in DEPTS.items():
    late = [{"date": d[0][:5], "time": d[2], "deltaMin": d[3]} for d in tard_raw["late"].get(raw_name, [])]
    lunch = [{"date": l[0][:5], "outTime": l[2], "inTime": l[3], "minutes": l[4]} for l in tard_raw["lunch"].get(raw_name, [])]
    worked = tard_raw["worked_days"].get(raw_name, 0)
    non_standard = raw_name in PART_TIME
    is_leader = raw_name in LEADERS
    group = LEADER_GROUP if is_leader else dept
    late_pct = round(len(late) / worked * 100) if (worked and not non_standard) else None
    tardiness_employees.append({
        "employee": display_name(raw_name),
        "dept": dept,
        "group": group,
        "isLeader": is_leader,
        "daysWorked": worked,
        "nonStandardSchedule": non_standard,
        "lateCount": len(late),
        "latePct": late_pct,
        "onTimePct": (100 - late_pct) if late_pct is not None else None,
        "lunchOverageCount": len(lunch),
        "lateDays": late,
        "lunchOverages": lunch,
    })

# team-wide on-time rate, standard-schedule employees only (matches the policy)
standard = [e for e in tardiness_employees if not e["nonStandardSchedule"]]
on_time_days = sum(e["daysWorked"] - e["lateCount"] for e in standard)
total_days = sum(e["daysWorked"] for e in standard)
team_on_time_pct = round(on_time_days / total_days * 100) if total_days else None

# ---------------------------------------------------------------
# FULL REPORT — shared by admin + manager views (they differ only by
# role/canEditGoals; the security boundary is which key decrypts).
# ---------------------------------------------------------------
def full_report(role):
    return {
        "role": role,
        "canEditGoals": role == "admin",
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
        "teamHealth": {
            "onTimeRatePct": team_on_time_pct,
            "policy": {
                "scheduledStart": "7:50 AM", "lateAfter": "8:10 AM",
                "lunchWindow": "1:00 PM - 2:00 PM", "lunchMaxMinutes": 60,
                "nonStandardEmployees": ["Mitchell, Zachary R"],
            },
            "note": "7/2 shows a lunch-overage across nearly every active employee - almost certainly a "
                    "practice-wide event (meeting/training/early close) the day before the July 3 holiday, "
                    "not individually long lunches.",
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
                {"employee": "Mitchell, Zachary R", "dept": "Dental Assistants", "gapDays": 7, "note": "Part-time, non-standard schedule - on top of 5 vacation days, not an attendance concern"},
                {"employee": "Manzoor, Munazah", "dept": "Dental Hygienists", "gapDays": 4, "note": "All 4 remaining Fridays - looks like a standing 4-day week"},
                {"employee": "Roman, Thomas", "dept": "Dental Assistants", "gapDays": 3, "note": ""},
                {"employee": "Rodriguez, Samantha", "dept": "Dental Assistants", "gapDays": 2, "note": "Back-to-back 7/23-7/24"},
                {"employee": "Majkich, Karen M", "dept": "Dental Hygienists", "gapDays": 2, "note": ""},
                {"employee": "Barber, Jacqueline", "dept": "Front Office", "gapDays": 1, "note": ""},
                {"employee": "Johnson, Latavia", "dept": "Dental Hygienists", "gapDays": 1, "note": ""},
            ],
        },
        # PLACEHOLDER - AFD hasn't sent real new-patient / add-on numbers yet.
        "newPatients": {"actual": 34},
        "addOnServices": [
            {"name": "Orthodontics", "production": 12500.00},
            {"name": "Teeth Whitening", "production": 1850.00},
            {"name": "Implants", "production": 8200.00},
        ],
    }

admin = full_report("admin")
manager = full_report("manager")

# ---------------------------------------------------------------
# GOALS + BASELINES — admin-set, plaintext (a target/policy value
# discloses no actual performance). Edited via Settings (admin only).
# ---------------------------------------------------------------
goals = {
    "collectionsGoal": 250000.00,
    "departmentGoals": {"Dentists": 190000.00, "Hygienists": 70000.00},
    "addOnGoal": 20000.00,
    "newPatientsGoal": 40,
    "tardinessPolicy": admin["teamHealth"]["policy"],
    "onTimeGoalPct": 95,
}

# ---------------------------------------------------------------
# TEAM VIEW — aggregate + positive framing only.
# ---------------------------------------------------------------
dept_totals = {}
for pv in admin["providers"]:
    d = dept_totals.setdefault("Dentists" if pv["role"] == "Dentist" else "Hygienists", {"production": 0, "collections": 0})
    d["production"] += pv["production"]
    d["collections"] += pv["collections"]

team = {
    "role": "team",
    "client": "Atlantic Family Dentistry",
    "period": "July 2026",
    "prepared": "2026-08-05",
    "kpis": {
        "production": admin["performance"]["current"]["production"],
        "collections": admin["performance"]["current"]["collections"],
        "collectionRatePct": round(admin["performance"]["current"]["collections"] / admin["performance"]["current"]["production"] * 100),
    },
    "byDepartment": [
        {"dept": name, "production": round(v["production"], 2), "collections": round(v["collections"], 2)}
        for name, v in dept_totals.items()
    ],
    "teamHealth": {
        "onTimeRatePct": team_on_time_pct,
        # per-department on-time %, no individual names
        "byDepartment": {},
    },
    "attendance": {
        "vacationDaysTaken": sum(1 if v["days"] == 1 or v["days"] == "1 (partial)" else v["days"] for v in admin["daysOff"]["vacation"]),
        "holidayDate": admin["daysOff"]["holidayDate"],
    },
    "labor": [{"dept": l["dept"], "staffCount": l["staffCount"], "hours": l["hours"]} for l in admin["labor"]],
    "newPatients": {"actual": admin["newPatients"]["actual"]},
    "addOnProduction": round(sum(a["production"] for a in admin["addOnServices"]), 2),
}
# group-level on-time (aggregate, no names) for the team view - Key Leaders
# broken out from their functional departments
dept_ot = {}
for e in standard:
    b = dept_ot.setdefault(e["group"], {"worked": 0, "late": 0})
    b["worked"] += e["daysWorked"]; b["late"] += e["lateCount"]
team["teamHealth"]["byDepartment"] = {
    dept: round((b["worked"] - b["late"]) / b["worked"] * 100) if b["worked"] else None
    for dept, b in dept_ot.items()
}

for name, payload in [("admin-view", admin), ("manager-view", manager), ("team-view", team)]:
    with open(os.path.join(OUT_DIR, name + ".json"), "w") as f:
        json.dump(payload, f, indent=2)
with open(os.path.join(OUT_DIR, "goals.json"), "w") as f:
    json.dump(goals, f, indent=2)

print("Wrote admin-view / manager-view / team-view / goals to", OUT_DIR)
print(f"Team on-time rate (standard-schedule): {on_time_days}/{total_days} = {team_on_time_pct}%")
print("Per-dept on-time:", team["teamHealth"]["byDepartment"])
