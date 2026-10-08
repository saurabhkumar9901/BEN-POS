"""Canonical column maps for NSDL (84 fields) and CDSL (104 fields).

Best-effort semantic names from observed data (see data/*.txt).
Blank/unknown slots keep explicit fXX/cXX fallback names so nothing is silently dropped.
Full parse is always preserved; UNIFIED_COLUMNS is the curated cross-depository view.
"""

# ---- NSDL: 84 positional fields on every 02 detail record ----
NSDL_COLUMNS = [
    "rec_type",            # 0  '02'
    "seq_no",              # 1
    "dp_id",               # 2  IN300011
    "client_id",           # 3
    "nsdl_f04",            # 4
    "nsdl_f05",            # 5
    "nsdl_f06",            # 6
    "nsdl_f07",            # 7
    "holder1",             # 8
    "holder1_extra",       # 9  father/guardian or 2nd name line
    "addr1",               # 10
    "addr2",               # 11
    "addr3",               # 12
    "addr_city",           # 13
    "addr_pin",            # 14
    "phone",               # 15
    "fax",                 # 16
    "holder2",             # 17 joint / second holder
    "holder3",             # 18
    "nsdl_f19",            # 19
    "nsdl_f20",            # 20
    "nsdl_f21",            # 21
    "nsdl_f22",            # 22
    "pan1",                # 23
    "pan2",                # 24
    "pan3",                # 25
    "nsdl_f26",            # 26 flag N
    "nominee_name",        # 27
    "nominee_addr1",       # 28
    "nominee_addr2",       # 29
    "nominee_addr3",       # 30
    "nominee_city",        # 31
    "nominee_pin",         # 32
    "nsdl_f33",            # 33
    "nsdl_f34",            # 34 flag N
    "bank_acct",           # 35
    "bank_name",           # 36
    "bank_branch",         # 37
    "nsdl_f38",            # 38
    "nsdl_f39",            # 39
    "bank_city",           # 40
    "bank_pin",            # 41
    "nsdl_f42",            # 42
    "nsdl_f43",            # 43
    "nsdl_f44",            # 44
    "nsdl_f45",            # 45
    "holding_type",        # 46 1/2/3
    "total_qty",           # 47
    "qty_b01",             # 48 breakup buckets
    "qty_b02",             # 49
    "qty_b03",             # 50
    "qty_b04",             # 51
    "qty_b05",             # 52
    "qty_b06",             # 53
    "qty_b07",             # 54
    "qty_b08",             # 55
    "qty_b09",             # 56
    "qty_b10",             # 57
    "qty_b11",             # 58
    "micr",                # 59
    "ifsc",                # 60
    "acct_type",           # 61
    "nsdl_f62",            # 62
    "nsdl_f63",            # 63
    "nsdl_f64",            # 64
    "nsdl_f65",            # 65
    "email1",              # 66
    "email2",              # 67
    "nsdl_f68",            # 68
    "nsdl_f69",            # 69 flag N
    "nsdl_f70",            # 70 zero
    "nsdl_f71",            # 71
    "nsdl_f72",            # 72
    "nsdl_f73",            # 73
    "state_code",          # 74
    "nsdl_f75",            # 75 '356'
    "nsdl_f76",            # 76
    "flag_a",              # 77 Y
    "flag_b",              # 78 Y/A
    "flag_c",              # 79
    "nsdl_f80",            # 80
    "nsdl_f81",            # 81
    "nsdl_f82",            # 82
    "nsdl_f83",            # 83
]
assert len(NSDL_COLUMNS) == 84

# NSDL 01 summary/trailer record: 24 ## fields
NSDL_HEADER_COLUMNS = [f"h{i:02d}" for i in range(24)]
NSDL_HEADER_RENAMES = {
    "h00": "rec_type", "h01": "isin", "h02": "benpos_date_raw",
    "h03": "report_date_raw", "h04": "report_time", "h23": "record_count",
}

# ---- CDSL: 104 positional fields, no header/trailer ----
CDSL_COLUMNS = [
    "isin",                # 1
    "boid",                # 2  16-digit BO ID
    "holder1",             # 3
    "holder2",             # 4
    "holder3",             # 5
    "cdsl_f06",            # 6 blank
    "cdsl_f07",            # 7 blank
    "father_guardian",     # 8
    "sex",                 # 9 M/F
    "dob",                 # 10 DD-MMM-YYYY
    "cdsl_f11",            # 11 flag
    "cdsl_f12",            # 12 flag
    "cdsl_f13",            # 13 flag
    "cdsl_f14",            # 14 e.g. 21
    "occup_code",          # 15
    "category",            # 16 H/B/O/...
    "pan1",                # 17
    "pan2",                # 18
    "pan3",                # 19
    "minor_flag",          # 20 0/1/3
    "cdsl_f21",            # 21 blank
    "status",              # 22 A
    "bo_open_date",        # 23 DD-MMM-YYYY
    "cdsl_f24",            # 24 blank
    "cdsl_f25",            # 25
    "cdsl_f26",            # 26
    "cdsl_f27",            # 27
    "cdsl_f28",            # 28
    "cdsl_f29",            # 29
    "cdsl_f30",            # 30
    "holder_type",         # 31 1/2/5
    "holder_subtype",      # 32
    "perm_addr1",          # 33
    "perm_addr2",          # 34
    "perm_addr3",          # 35
    "perm_addr4",          # 36
    "perm_state",          # 37
    "perm_country",        # 38
    "perm_pin",            # 39
    "corr_addr1",          # 40
    "corr_addr2",          # 41
    "corr_addr3",          # 42
    "corr_addr4",          # 43
    "corr_state",          # 44
    "corr_country",        # 45
    "corr_pin",            # 46
    "mobile",              # 47
    "phone",               # 48
    "cdsl_f49",            # 49 blank
    "email",               # 50
    "email_flag",          # 51 Y/N
    "micr",                # 52
    "ifsc",                # 53
    "bank_name",           # 54
    "bank_branch",         # 55
    "cdsl_f56",            # 56 blank
    "cdsl_f57",            # 57 blank
    "bank_city",           # 58
    "bank_state",          # 59
    "bank_country",        # 60
    "cdsl_f61",            # 61 blank
    "cdsl_f62",            # 62 999001
    "acct_type",           # 63 10/11
    "bank_acct",           # 64
    "total_qty",           # 65 500.000
    "cdsl_f66",            # 66 0.000
    "cdsl_f67",            # 67 0.000
    "pledge_qty",          # 68 count
    "cdsl_f69",            # 69 0.000
    "cdsl_f70",            # 70 0.000
    "free_qty",            # 71
    "cdsl_f72",            # 72 0.000
    "cdsl_f73",            # 73 0.000
    "benpos_date_raw",     # 74 DDMMYYYY e.g. 17072026
    "cdsl_f75",            # 75 0.000
    "cdsl_f76",            # 76 0.000
    "holders_count",       # 77 1/2/3
    "cdsl_f78",            # 78 blank
    "cdsl_f79",            # 79
    "cdsl_f80",            # 80
    "cdsl_f81",            # 81
    "cdsl_f82",            # 82
    "cdsl_f83",            # 83
    "cdsl_f84",            # 84
    "cdsl_f85",            # 85
    "cdsl_f86",            # 86
    "nominee_flag",        # 87 N
    "cdsl_f88",            # 88 0/1
    "cdsl_f89",            # 89 1/2
    "cdsl_f90",            # 90 blank
    "cdsl_f91",            # 91
    "cdsl_f92",            # 92
    "cdsl_f93",            # 93 code
    "cdsl_f94",            # 94 code
    "cdsl_f95",            # 95 blank
    "cdsl_f96",            # 96
    "cdsl_f97",            # 97 code
    "cdsl_f98",            # 98 code
    "cdsl_f99",            # 99 blank
    "cdsl_f100",           # 100
    "cdsl_f101",           # 101 code
    "cdsl_f102",           # 102 code
    "cdsl_f103",           # 103 blank
    "cdsl_f104",           # 104 blank
]
assert len(CDSL_COLUMNS) == 104

# Curated cross-depository view: one row = one investor-company snapshot position
UNIFIED_COLUMNS = [
    "isin", "company_name", "depository", "benpos_date",
    "account_id",          # BOID (CDSL) or DPID+CLIENTID (NSDL)
    "holder1", "holder2", "holder3", "name_norm",
    "pan1", "pan2", "pan3", "investor_key",
    "key_type", "identity_confidence",  # pan/high, acct/medium, name/low
    "address_full", "pin",
    "mobile", "email",
    "bank_name", "bank_acct", "ifsc", "micr",
    "total_qty", "free_qty", "holding_type",
    "state_code",
    "validation_flags",  # '' = clean; ';'-separated Row flags, see validate.py
    "source_file", "source_row",
]

TRACE_COLUMNS = ["source_file", "source_row", "depository"]
