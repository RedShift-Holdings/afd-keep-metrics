"""
DEMO parser: shows the intended shape of a monthly CSV -> owner-view.json
pipeline once we have a real export from the client's practice-management
system. The column names below are placeholders matching the PDF report
structure we already know (Provider A/R Totals) - swap in the real headers
the moment a real CSV export shows up.

Usage:
  python3 parse_csv_example.py sample_csvs/production_example.csv > providers.json
"""
import csv, json, sys

# Placeholder column-name mapping - EDIT once we see a real export.
COLUMN_MAP = {
    "provider_name": "name",
    "provider_role": "role",
    "gross_production": "production",
    "adjustments": "adjustments",
    "net_collections": "collections",
}

def parse_production_csv(path):
    providers = []
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rec = {}
            for csv_col, schema_key in COLUMN_MAP.items():
                val = row.get(csv_col, "")
                if schema_key in ("production", "adjustments", "collections"):
                    val = float(val or 0)
                rec[schema_key] = val
            if rec.get("production"):
                rec["collRate"] = round(rec["collections"] / rec["production"] * 100)
            providers.append(rec)
    return providers

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__); sys.exit(1)
    print(json.dumps(parse_production_csv(sys.argv[1]), indent=2))
