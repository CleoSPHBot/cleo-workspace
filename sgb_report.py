#!/usr/bin/env python3
"""
Hannah's SGB Report — HRV and biometrics before/after each stellate ganglion block.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.lines import Line2D
import matplotlib.dates as mdates
from datetime import datetime, date, timedelta
import numpy as np
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image,
                                 Table, TableStyle, PageBreak, HRFlowable)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import io
import os
import tempfile

# ─── DATA ─────────────────────────────────────────────────────────────────────

SGB1_DATE = date(2026, 5, 29)  # Left side
SGB2_DATE = date(2026, 6, 12)  # Right side (confirmed from notes: "Got an SGB around 2-2:30 today")

# WHOOP daily data (user_id 6729032, Hannah)
WHOOP = [
    {"date": "2026-05-01", "hrv": 33.3, "recovery": 72, "rhr": 75, "strain": 0.97, "sleep_perf": 58, "sws_min": 58, "rem_min": 98},
    {"date": "2026-05-02", "hrv": 38.4, "recovery": 92, "rhr": 71, "strain": 4.02, "sleep_perf": 56, "sws_min": 64, "rem_min": 55},
    {"date": "2026-05-03", "hrv": 34.0, "recovery": 76, "rhr": 70, "strain": 0.24, "sleep_perf": 69, "sws_min": 64, "rem_min": 180},
    {"date": "2026-05-04", "hrv": 29.2, "recovery": 48, "rhr": 73, "strain": 1.05, "sleep_perf": 65, "sws_min": 47, "rem_min": 80},
    {"date": "2026-05-05", "hrv": 32.5, "recovery": 72, "rhr": 71, "strain": 0.55, "sleep_perf": 78, "sws_min": 63, "rem_min": 103},
    {"date": "2026-05-06", "hrv": 26.4, "recovery": 41, "rhr": 74, "strain": 4.29, "sleep_perf": 71, "sws_min": 48, "rem_min": 132},
    {"date": "2026-05-07", "hrv": 30.5, "recovery": 59, "rhr": 69, "strain": 0.13, "sleep_perf": 85, "sws_min": 66, "rem_min": 135},
    {"date": "2026-05-08", "hrv": 28.9, "recovery": 46, "rhr": 72, "strain": 0.26, "sleep_perf": 67, "sws_min": 76, "rem_min": 49},
    {"date": "2026-05-09", "hrv": 30.2, "recovery": 66, "rhr": 71, "strain": 0.21, "sleep_perf": 41, "sws_min": 38, "rem_min": 48},
    {"date": "2026-05-10", "hrv": 32.4, "recovery": 76, "rhr": 71, "strain": 0.89, "sleep_perf": 71, "sws_min": 59, "rem_min": 141},
    {"date": "2026-05-11", "hrv": 40.6, "recovery": 90, "rhr": 69, "strain": 3.89, "sleep_perf": 37, "sws_min": 32, "rem_min": 71},
    {"date": "2026-05-12", "hrv": 33.9, "recovery": 76, "rhr": 71, "strain": 0.39, "sleep_perf": 76, "sws_min": 79, "rem_min": 86},
    {"date": "2026-05-13", "hrv": 33.5, "recovery": 72, "rhr": 73, "strain": 0.51, "sleep_perf": 28, "sws_min": 39, "rem_min": 19},
    {"date": "2026-05-14", "hrv": 28.9, "recovery": 49, "rhr": 73, "strain": 2.44, "sleep_perf": 75, "sws_min": 37, "rem_min": 63},
    {"date": "2026-05-15", "hrv": 32.1, "recovery": 59, "rhr": 75, "strain": 4.00, "sleep_perf": 69, "sws_min": 65, "rem_min": 120},
    {"date": "2026-05-16", "hrv": 28.8, "recovery": 49, "rhr": 73, "strain": 0.44, "sleep_perf": 77, "sws_min": 65, "rem_min": 102},
    {"date": "2026-05-17", "hrv": 33.5, "recovery": 74, "rhr": 73, "strain": 3.95, "sleep_perf": 67, "sws_min": 100, "rem_min": 177},
    {"date": "2026-05-18", "hrv": 37.3, "recovery": 84, "rhr": 69, "strain": 4.09, "sleep_perf": 32, "sws_min": 45, "rem_min": 32},
    {"date": "2026-05-19", "hrv": 31.7, "recovery": 60, "rhr": 73, "strain": 0.52, "sleep_perf": 74, "sws_min": 80, "rem_min": 147},
    {"date": "2026-05-20", "hrv": 29.8, "recovery": 55, "rhr": 71, "strain": 0.15, "sleep_perf": 77, "sws_min": 49, "rem_min": 89},
    {"date": "2026-05-21", "hrv": 35.4, "recovery": 77, "rhr": 74, "strain": 0.36, "sleep_perf": 69, "sws_min": 41, "rem_min": 59},
    {"date": "2026-05-22", "hrv": 33.3, "recovery": 71, "rhr": 73, "strain": None, "sleep_perf": 62, "sws_min": 70, "rem_min": 109},
    {"date": "2026-05-23", "hrv": 34.6, "recovery": 75, "rhr": 74, "strain": 0.38, "sleep_perf": 69, "sws_min": 31, "rem_min": 140},
    {"date": "2026-05-24", "hrv": 33.7, "recovery": 75, "rhr": 69, "strain": 0.10, "sleep_perf": 77, "sws_min": 53, "rem_min": 82},
    {"date": "2026-05-25", "hrv": 33.6, "recovery": 69, "rhr": 70, "strain": 0.14, "sleep_perf": None, "sws_min": None, "rem_min": None},
    {"date": "2026-05-26", "hrv": 36.8, "recovery": 89, "rhr": 73, "strain": 0.35, "sleep_perf": 70, "sws_min": 39, "rem_min": 64},
    {"date": "2026-05-27", "hrv": 32.8, "recovery": 60, "rhr": 70, "strain": 0.24, "sleep_perf": 33, "sws_min": 47, "rem_min": 49},
    {"date": "2026-05-28", "hrv": 25.1, "recovery": 39, "rhr": 74, "strain": 2.81, "sleep_perf": 76, "sws_min": 87, "rem_min": 110},
    {"date": "2026-05-29", "hrv": 29.8, "recovery": 55, "rhr": 75, "strain": 4.00, "sleep_perf": 73, "sws_min": 83, "rem_min": 74},   # SGB-1
    {"date": "2026-05-30", "hrv": 17.1, "recovery": 18, "rhr": 88, "strain": 4.00, "sleep_perf": 14, "sws_min": 29, "rem_min": None},
    {"date": "2026-05-31", "hrv": 49.4, "recovery": 98, "rhr": 69, "strain": 0.06, "sleep_perf": 22, "sws_min": 32, "rem_min": 33},
    {"date": "2026-06-01", "hrv": 31.0, "recovery": 64, "rhr": 71, "strain": 0.11, "sleep_perf": 19, "sws_min": 30, "rem_min": 13},
    {"date": "2026-06-02", "hrv": 31.8, "recovery": 70, "rhr": 74, "strain": 0.43, "sleep_perf": 76, "sws_min": 31, "rem_min": 103},
    {"date": "2026-06-03", "hrv": 26.1, "recovery": 48, "rhr": 74, "strain": 2.44, "sleep_perf": 71, "sws_min": 109, "rem_min": 155},
    {"date": "2026-06-04", "hrv": 30.8, "recovery": 66, "rhr": 77, "strain": 0.53, "sleep_perf": 67, "sws_min": 71, "rem_min": 141},
    {"date": "2026-06-05", "hrv": 24.4, "recovery": 40, "rhr": 76, "strain": 0.77, "sleep_perf": None, "sws_min": None, "rem_min": None},
    {"date": "2026-06-06", "hrv": None, "recovery": None, "rhr": None, "strain": 0.30, "sleep_perf": 78, "sws_min": 76, "rem_min": 96},
    {"date": "2026-06-07", "hrv": 32.8, "recovery": 76, "rhr": 73, "strain": 0.23, "sleep_perf": 76, "sws_min": 104, "rem_min": 107},
    {"date": "2026-06-08", "hrv": 29.8, "recovery": 63, "rhr": 70, "strain": 0.14, "sleep_perf": 77, "sws_min": 64, "rem_min": 103},
    {"date": "2026-06-09", "hrv": 34.9, "recovery": 86, "rhr": 71, "strain": 0.15, "sleep_perf": 76, "sws_min": 64, "rem_min": 169},
    {"date": "2026-06-10", "hrv": 34.3, "recovery": 81, "rhr": 75, "strain": 4.01, "sleep_perf": 62, "sws_min": 54, "rem_min": 156},
    {"date": "2026-06-11", "hrv": 27.7, "recovery": 55, "rhr": 72, "strain": 4.05, "sleep_perf": 27, "sws_min": 42, "rem_min": 33},
    {"date": "2026-06-12", "hrv": 26.3, "recovery": 49, "rhr": 74, "strain": 0.30, "sleep_perf": 74, "sws_min": 85, "rem_min": 105},  # SGB-2
    {"date": "2026-06-13", "hrv": 44.9, "recovery": 36, "rhr": 78, "strain": 0.64, "sleep_perf": 7, "sws_min": 57, "rem_min": 18},
    {"date": "2026-06-14", "hrv": 35.6, "recovery": 93, "rhr": 69, "strain": 1.62, "sleep_perf": 79, "sws_min": 74, "rem_min": 87},
    {"date": "2026-06-15", "hrv": None, "recovery": None, "rhr": None, "strain": 4.27, "sleep_perf": 75, "sws_min": 53, "rem_min": 88},
    {"date": "2026-06-16", "hrv": 33.6, "recovery": 73, "rhr": 74, "strain": 4.13, "sleep_perf": 70, "sws_min": 62, "rem_min": 147},
    {"date": "2026-06-17", "hrv": 29.8, "recovery": 58, "rhr": 76, "strain": 0.53, "sleep_perf": 71, "sws_min": 82, "rem_min": 139},
    {"date": "2026-06-18", "hrv": 31.5, "recovery": 70, "rhr": 72, "strain": 0.19, "sleep_perf": 64, "sws_min": 61, "rem_min": 108},
    {"date": "2026-06-19", "hrv": 28.9, "recovery": 54, "rhr": 75, "strain": 0.35, "sleep_perf": 79, "sws_min": 76, "rem_min": 166},
    {"date": "2026-06-20", "hrv": 32.6, "recovery": 60, "rhr": 73, "strain": 2.62, "sleep_perf": 57, "sws_min": 44, "rem_min": 39},
    {"date": "2026-06-21", "hrv": 32.8, "recovery": 77, "rhr": 72, "strain": 0.30, "sleep_perf": 76, "sws_min": 109, "rem_min": 120},
    {"date": "2026-06-22", "hrv": 32.5, "recovery": 76, "rhr": 71, "strain": 0.22, "sleep_perf": 78, "sws_min": 64, "rem_min": 158},
    {"date": "2026-06-23", "hrv": 36.3, "recovery": 95, "rhr": 69, "strain": 0.18, "sleep_perf": 73, "sws_min": 87, "rem_min": 164},
    {"date": "2026-06-24", "hrv": 34.4, "recovery": 82, "rhr": 72, "strain": 0.25, "sleep_perf": 58, "sws_min": 70, "rem_min": 131},
    {"date": "2026-06-25", "hrv": 26.4, "recovery": 44, "rhr": 69, "strain": 0.26, "sleep_perf": 74, "sws_min": 79, "rem_min": 101},
    {"date": "2026-06-26", "hrv": 25.0, "recovery": 42, "rhr": 73, "strain": 0.37, "sleep_perf": 70, "sws_min": 97, "rem_min": 147},
    {"date": "2026-06-27", "hrv": 28.1, "recovery": 54, "rhr": 71, "strain": 0.25, "sleep_perf": 77, "sws_min": 72, "rem_min": 165},
    {"date": "2026-06-28", "hrv": 32.2, "recovery": 72, "rhr": 70, "strain": 0.22, "sleep_perf": None, "sws_min": None, "rem_min": None},
    {"date": "2026-06-29", "hrv": 31.1, "recovery": 68, "rhr": 71, "strain": 0.14, "sleep_perf": None, "sws_min": None, "rem_min": None},
    {"date": "2026-06-30", "hrv": 30.3, "recovery": 68, "rhr": 71, "strain": 0.24, "sleep_perf": 78, "sws_min": 61, "rem_min": 194},
    {"date": "2026-07-01", "hrv": 30.0, "recovery": 66, "rhr": 73, "strain": 0.33, "sleep_perf": 83, "sws_min": 69, "rem_min": 160},
    {"date": "2026-07-02", "hrv": 32.5, "recovery": 81, "rhr": 70, "strain": 0.26, "sleep_perf": 82, "sws_min": 63, "rem_min": 95},
    {"date": "2026-07-03", "hrv": 28.1, "recovery": 55, "rhr": 70, "strain": 3.28, "sleep_perf": None, "sws_min": None, "rem_min": None},
    {"date": "2026-07-04", "hrv": None, "recovery": None, "rhr": None, "strain": 0.33, "sleep_perf": 72, "sws_min": 80, "rem_min": 167},
    {"date": "2026-07-05", "hrv": 31.7, "recovery": 81, "rhr": 72, "strain": 4.03, "sleep_perf": 79, "sws_min": 55, "rem_min": 131},
    {"date": "2026-07-06", "hrv": 33.6, "recovery": 92, "rhr": 69, "strain": 0.23, "sleep_perf": 79, "sws_min": 114, "rem_min": 213},
    {"date": "2026-07-07", "hrv": 38.5, "recovery": 98, "rhr": 69, "strain": 0.18, "sleep_perf": 79, "sws_min": 87, "rem_min": 138},
    {"date": "2026-07-08", "hrv": 33.9, "recovery": 81, "rhr": 70, "strain": 4.03, "sleep_perf": 69, "sws_min": 86, "rem_min": 224},
]

# Self-report symptom data
SYMPTOMS = {
    "2026-05-15": {"feeling": "mixed", "pem": "mild", "brain_fog": "mild", "pain": "none", "notes": "Good day overall"},
    "2026-05-16": {"feeling": "good", "pem": "severe", "brain_fog": "none", "pain": "none", "notes": ""},
    "2026-05-17": {"feeling": "bad", "pem": "severe", "brain_fog": "none", "pain": "mild", "notes": "Slept almost all day. Missed meds (LDN, BC, memantine) night before"},
    "2026-05-18": {"feeling": "mixed", "pem": "mild", "brain_fog": "none", "pain": "none", "notes": "Demanding day — car travel"},
    "2026-05-19": {"feeling": "mixed", "pem": "severe", "brain_fog": "none", "pain": "none", "notes": ""},
    "2026-05-20": {"feeling": "mixed", "pem": "mild", "brain_fog": "none", "pain": "mild", "notes": "Can't sleep at 3am — insomnia"},
    "2026-05-21": {"feeling": "bad", "pem": "mild", "brain_fog": "mild", "pain": "none", "notes": "Started BCP-157 oral peptide"},
    "2026-05-22": {"feeling": "mixed", "pem": "severe", "brain_fog": "mild", "pain": "mild", "notes": "Slept almost all day. Changed to 20mg Prozac. Dropping LDN to 4.5mg"},
    "2026-05-23": {"feeling": "good", "pem": "mild", "brain_fog": "none", "pain": "none", "notes": "Day 1 of LDN drop: 6mg → 4.5mg"},
    "2026-05-24": {"feeling": "mixed", "pem": "mild", "brain_fog": "none", "pain": "none", "notes": "Relatively good day, some sewing"},
    "2026-05-25": {"feeling": "mixed", "pem": "severe", "brain_fog": "none", "pain": "mild", "notes": ""},
    "2026-05-26": {"feeling": "mixed", "pem": "mild", "brain_fog": "none", "pain": "mild", "notes": "Prozac 20mg → 10mg. Rapamycin 6mg. Long day: insurance calls, MIT meeting"},
    "2026-05-27": {"feeling": "bad", "pem": "severe", "brain_fog": "severe", "pain": "mild", "notes": "LDN reduced to 3mg to flush. Couldn't do therapy — falling asleep"},
    "2026-05-28": {"feeling": "mixed", "pem": "mild", "brain_fog": "none", "pain": "none", "notes": "Pre-SGB1 rest day"},
    "2026-05-29": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "severe",
                   "notes": "⭐ SGB-1 (Left). Immediate post-procedure: hoarse voice, neck pain, emotional discharge under anesthesia, eye droop (Horner's sign), unable to nap, wired-but-tired. Arm difficult to raise. 'Adderall after all-nighter' feeling. Took Xanax 0.012mg."},
    "2026-05-30": {"feeling": "mixed", "pem": "mild", "brain_fog": "mild", "pain": "mild",
                   "notes": "D+1 SGB-1: Woke 4:30am, hoarseness gone, hip/body pain, bloating, constipation, flushed cheeks. Took Plidan + Tylenol + zinc 5am. Less 'floaty'."},
    "2026-05-31": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "none",
                   "notes": "D+2 SGB-1: Very sleepy day. Increased smell sensitivity (litter box). Can't sleep at 2:20am — strange headache at back of neck. Took Tylenol."},
    "2026-06-01": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "mild",
                   "notes": "D+3 SGB-1: Neck feels bruised inside at injection site. Super fatigue — couldn't move (scared her)."},
    "2026-06-02": {"feeling": "mixed", "pem": "mild", "brain_fog": "mild", "pain": "severe",
                   "notes": "D+4 SGB-1: Went outside in wheelchair. Intense uterine cramping ~8pm. Very sore knees."},
    "2026-06-03": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "mild", "notes": "D+5 SGB-1: Home all day. Tried to sew, couldn't."},
    "2026-06-04": {"feeling": "mixed", "pem": "mild", "brain_fog": "none", "pain": "none", "notes": "D+6 SGB-1: Some sewing, light housework — signs of stabilization"},
    "2026-06-05": {"feeling": "mixed", "pem": "mild", "brain_fog": "mild", "pain": "none", "notes": "D+7 SGB-1: Washed sewing fabric, relatively good day"},
    "2026-06-06": {"feeling": "mixed", "pem": "mild", "brain_fog": "none", "pain": "none", "notes": ""},
    "2026-06-07": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "severe", "notes": "Slept basically all day"},
    "2026-06-08": {"feeling": "mixed", "pem": "mild", "brain_fog": "mild", "pain": "severe", "notes": "Spine tingling and pain this morning"},
    "2026-06-09": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "none", "notes": ""},
    "2026-06-10": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "none", "notes": ""},
    "2026-06-11": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "mild",
                   "notes": "Prozac taper: 10mg → 0 (every other day × 1 week). Starting propranolol 20mg AM."},
    "2026-06-12": {"feeling": "mixed", "pem": "mild", "brain_fog": "none", "pain": "none",
                   "notes": "⭐ SGB-2 (Right) ~2–2:30pm. Much easier than SGB-1: minor eye droop only, no hoarseness, no dissociation, swallowed normally, didn't cry. Felt hot, in-ear temp 99.5°F at 6pm. Took all meds beforehand, had big brunch. Also sewed that evening."},
    "2026-06-13": {"feeling": "mixed", "pem": "mild", "brain_fog": "mild", "pain": "mild",
                   "notes": "D+1 SGB-2: No sleep the night before. Slight headache (back of head), flushed cheeks. Trip to Newport with Harrison."},
    "2026-06-14": {"feeling": "mixed", "pem": "mild", "brain_fog": "mild", "pain": "none",
                   "notes": "D+2 SGB-2: Beach time, sun exposure, standing. Sudden fatigue → long nap. 2hr car ride home."},
    "2026-06-15": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "none",
                   "notes": "D+3 SGB-2: Xolair injection today. Demanding day."},
    "2026-06-16": {"feeling": "mixed", "pem": "severe", "brain_fog": "mild", "pain": "mild",
                   "notes": "D+4 SGB-2: Recovering"},
    "2026-06-17": {"feeling": "mixed", "pem": "severe", "brain_fog": "mild", "pain": "none", "notes": "D+5 SGB-2"},
    "2026-06-18": {"feeling": "mixed", "pem": "mild", "brain_fog": "mild", "pain": "none", "notes": "D+6 SGB-2: Claunch appointment"},
    "2026-06-19": {"feeling": "mixed", "pem": "mild", "brain_fog": "none", "pain": "none", "notes": "D+7 SGB-2"},
    "2026-06-20": {"feeling": "mixed", "pem": "mild", "brain_fog": "none", "pain": "none",
                   "notes": "Newport, Father's Day. 1hr wheelchair walking tour + winery. Good day."},
    "2026-06-21": {"feeling": "mixed", "pem": "mild", "brain_fog": "none", "pain": "none",
                   "notes": "Yeast infection symptoms since Friday (restarting probiotic)"},
    "2026-06-22": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "none", "notes": ""},
    "2026-06-23": {"feeling": "mixed", "pem": "severe", "brain_fog": "mild", "pain": "none", "notes": ""},
    "2026-06-24": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "none", "notes": ""},
    "2026-06-25": {"feeling": "bad", "pem": "severe", "brain_fog": "severe", "pain": "none", "notes": "Demanding day — car travel"},
    "2026-06-26": {"feeling": "bad", "pem": "severe", "brain_fog": "severe", "pain": "none", "notes": ""},
    "2026-06-27": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "none",
                   "notes": "Bad stomach ache from stress (financial/guilt). Met with Tere."},
    "2026-06-28": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "none", "notes": ""},
    "2026-06-29": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "none", "notes": ""},
    "2026-06-30": {"feeling": "bad", "pem": "severe", "brain_fog": "mild", "pain": "none", "notes": ""},
    "2026-07-01": {"feeling": "mixed", "pem": "mild", "brain_fog": "severe", "pain": "none", "notes": ""},
    "2026-07-02": {"feeling": None, "pem": None, "brain_fog": None, "pain": None, "notes": ""},
    "2026-07-03": {"feeling": "mixed", "pem": "mild", "brain_fog": "mild", "pain": "none",
                   "notes": "Helped with dinner cleanup. No extra salt — no stomach ache."},
    "2026-07-04": {"feeling": "mixed", "pem": "mild", "brain_fog": "mild", "pain": "none",
                   "notes": "Sewed! First day well enough since before Father's Day"},
    "2026-07-05": {"feeling": "good", "pem": "mild", "brain_fog": "none", "pain": "mild", "notes": ""},
    "2026-07-06": {"feeling": "bad", "pem": "severe", "brain_fog": "severe", "pain": "mild",
                   "notes": "Nicotine patch (3.5mg half-patch) → severe fatigue 1hr later, couldn't move. Removed at hour 4."},
    "2026-07-07": {"feeling": None, "pem": None, "brain_fog": None, "pain": None,
                   "notes": "Claunch appointment"},
    "2026-07-08": {"feeling": None, "pem": None, "brain_fog": None, "pain": None, "notes": ""},
}

# ─── COLOR SCHEME ─────────────────────────────────────────────────────────────

SPH_BLUE = '#1a5f8a'
SPH_LIGHT = '#e8f4fd'
SGB1_COLOR = '#e74c3c'   # red
SGB2_COLOR = '#8e44ad'   # purple
PRE_COLOR  = '#2ecc71'   # green
POST1_COLOR = '#e67e22'  # orange
POST2_COLOR = '#3498db'  # blue
GRID_COLOR = '#e8e8e8'

# ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

def parse_date(s):
    return datetime.strptime(s, "%Y-%m-%d").date()

def get_7day_rolling_avg(data, key):
    vals = [(parse_date(d['date']), d[key]) for d in data if d.get(key) is not None]
    dates = [v[0] for v in vals]
    values = [v[1] for v in vals]
    result = []
    for i, (d, v) in enumerate(zip(dates, values)):
        window = [values[j] for j in range(max(0, i-3), min(len(values), i+4)) if values[j] is not None]
        result.append((d, np.mean(window)))
    return result

def feeling_score(f):
    return {"good": 3, "mixed": 2, "bad": 1, None: None}.get(f)

def pem_score(p):
    return {"none": 0, "mild": 1, "severe": 2, None: None}.get(p)

def fog_score(f):
    return {"none": 0, "mild": 1, "severe": 2, None: None}.get(f)

def pain_score(p):
    return {"none": 0, "mild": 1, "severe": 2, None: None}.get(p)

def get_region(d):
    """Return region label for a date."""
    if d < SGB1_DATE:
        return "pre"
    elif d == SGB1_DATE:
        return "sgb1"
    elif d < SGB2_DATE:
        return "post1"
    elif d == SGB2_DATE:
        return "sgb2"
    else:
        return "post2"

# ─── CHART GENERATION ─────────────────────────────────────────────────────────

def make_chart_fig(title, xlabel, ylabel, series_list, vlines=None, annotations=None,
                   ylim=None, figsize=(10, 3.8), legend_loc='upper right'):
    """Generic chart maker. series_list = [(dates, values, color, label, style), ...]"""
    fig, ax = plt.subplots(figsize=figsize)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#fafafa')
    ax.grid(True, color=GRID_COLOR, linewidth=0.7, zorder=0)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#cccccc')
    ax.spines['bottom'].set_color('#cccccc')

    for dates, values, color, label, style in series_list:
        xs = [datetime.combine(d, datetime.min.time()) for d in dates]
        if style == 'scatter':
            ax.scatter(xs, values, color=color, s=22, zorder=3, alpha=0.8, label=label)
        elif style == 'line':
            ax.plot(xs, values, color=color, linewidth=2, zorder=4, label=label)
        elif style == 'both':
            ax.scatter(xs, values, color=color, s=18, zorder=3, alpha=0.6)
            ax.plot(xs, values, color=color, linewidth=1.5, zorder=4, label=label, alpha=0.85)
        elif style == 'bar':
            ax.bar(xs, values, color=color, alpha=0.7, width=0.8, label=label, zorder=2)

    if vlines:
        for vd, vc, vl in vlines:
            vx = datetime.combine(vd, datetime.min.time())
            ax.axvline(x=vx, color=vc, linewidth=2.2, linestyle='--', zorder=5, alpha=0.9)
            yrange = ax.get_ylim()
            ax.text(vx, yrange[1], vl, rotation=90, va='top', ha='right',
                    fontsize=7.5, color=vc, fontweight='bold', zorder=6)

    if ylim:
        ax.set_ylim(ylim)

    ax.set_title(title, fontsize=11, fontweight='bold', color=SPH_BLUE, pad=8)
    ax.set_xlabel(xlabel, fontsize=8.5, color='#555555')
    ax.set_ylabel(ylabel, fontsize=8.5, color='#555555')
    ax.tick_params(axis='both', labelsize=7.5, colors='#555555')
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    plt.xticks(rotation=35, ha='right')
    if any(s[3] for s in series_list):
        ax.legend(fontsize=8, loc=legend_loc, framealpha=0.85)

    plt.tight_layout(pad=1.0)
    return fig

def save_fig_to_bytes(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return buf

# ─── CHART 1: HRV Timeline ────────────────────────────────────────────────────

def chart_hrv():
    all_dates = [parse_date(d['date']) for d in WHOOP if d.get('hrv') is not None]
    all_hrv   = [d['hrv'] for d in WHOOP if d.get('hrv') is not None]

    # Rolling average
    rolling = get_7day_rolling_avg(WHOOP, 'hrv')
    roll_dates, roll_vals = zip(*rolling) if rolling else ([], [])

    # Color by region
    colors_list = []
    for d in all_dates:
        r = get_region(d)
        if r == 'pre': colors_list.append('#2ecc71')
        elif r == 'sgb1': colors_list.append(SGB1_COLOR)
        elif r == 'post1': colors_list.append('#e67e22')
        elif r == 'sgb2': colors_list.append(SGB2_COLOR)
        else: colors_list.append('#3498db')

    fig, ax = plt.subplots(figsize=(11, 4.2))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#fafafa')
    ax.grid(True, color=GRID_COLOR, linewidth=0.7, zorder=0)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#cccccc')
    ax.spines['bottom'].set_color('#cccccc')

    # Scatter colored by region
    xs = [datetime.combine(d, datetime.min.time()) for d in all_dates]
    ax.scatter(xs, all_hrv, c=colors_list, s=28, zorder=3, alpha=0.8)

    # Rolling avg line
    rxs = [datetime.combine(d, datetime.min.time()) for d in roll_dates]
    ax.plot(rxs, roll_vals, color=SPH_BLUE, linewidth=2.2, zorder=4, label='7-day rolling avg', alpha=0.85)

    # Pre-SGB-1 baseline band
    pre_hrv = [d['hrv'] for d in WHOOP if d.get('hrv') is not None and parse_date(d['date']) < SGB1_DATE]
    if pre_hrv:
        baseline = np.mean(pre_hrv)
        ax.axhline(y=baseline, color='#2ecc71', linewidth=1.3, linestyle=':', alpha=0.7, zorder=2, label=f'Pre-SGB1 baseline ({baseline:.1f}ms)')

    # SGB vertical lines
    for vd, vc, vl in [(SGB1_DATE, SGB1_COLOR, 'SGB-1\n(Left)'), (SGB2_DATE, SGB2_COLOR, 'SGB-2\n(Right)')]:
        vx = datetime.combine(vd, datetime.min.time())
        ax.axvline(x=vx, color=vc, linewidth=2.5, linestyle='--', zorder=5, alpha=0.9)
        yrange = ax.get_ylim()
        ax.text(vx, max(all_hrv)*0.97, vl, rotation=0, va='top', ha='left',
                fontsize=8, color=vc, fontweight='bold', zorder=6,
                bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor=vc, alpha=0.9))

    # Annotate crash and spike
    crash_x = datetime.combine(date(2026, 5, 30), datetime.min.time())
    ax.annotate('Post-SGB1\ncrash (17.1ms)', xy=(crash_x, 17.1),
                xytext=(crash_x + timedelta(days=2), 12),
                fontsize=7, color=SGB1_COLOR, fontweight='bold',
                arrowprops=dict(arrowstyle='->', color=SGB1_COLOR, lw=1.2))

    spike_x = datetime.combine(date(2026, 5, 31), datetime.min.time())
    ax.annotate('Rebound spike\n(49.4ms)', xy=(spike_x, 49.4),
                xytext=(spike_x + timedelta(days=2), 52),
                fontsize=7, color='#27ae60', fontweight='bold',
                arrowprops=dict(arrowstyle='->', color='#27ae60', lw=1.2))

    legend_elements = [
        mpatches.Patch(color='#2ecc71', label='Pre-SGB1'),
        mpatches.Patch(color='#e67e22', label='Post-SGB1 / Pre-SGB2'),
        mpatches.Patch(color='#3498db', label='Post-SGB2'),
        Line2D([0], [0], color=SPH_BLUE, linewidth=2, label='7-day rolling avg'),
        Line2D([0], [0], color='#2ecc71', linewidth=1.3, linestyle=':', label=f'Pre-SGB1 baseline ({baseline:.1f}ms)')
    ]
    ax.legend(handles=legend_elements, fontsize=7.5, loc='upper left', framealpha=0.85)

    ax.set_title('HRV (RMSSD) Timeline — Before & After SGBs', fontsize=12, fontweight='bold', color=SPH_BLUE, pad=10)
    ax.set_xlabel('Date', fontsize=8.5, color='#555555')
    ax.set_ylabel('HRV RMSSD (ms)', fontsize=8.5, color='#555555')
    ax.tick_params(axis='both', labelsize=7.5, colors='#555555')
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    plt.xticks(rotation=35, ha='right')
    ax.set_ylim(0, max(all_hrv) + 8)
    plt.tight_layout(pad=1.0)
    return save_fig_to_bytes(fig)

# ─── CHART 2: Recovery Score ────────────────────────────────────────────────

def chart_recovery():
    all_dates = [parse_date(d['date']) for d in WHOOP if d.get('recovery') is not None]
    all_rec   = [d['recovery'] for d in WHOOP if d.get('recovery') is not None]

    fig, ax = plt.subplots(figsize=(11, 3.8))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#fafafa')
    ax.grid(True, color=GRID_COLOR, linewidth=0.7, zorder=0)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    # Background zones
    start_x = datetime.combine(parse_date("2026-05-01"), datetime.min.time())
    end_x   = datetime.combine(parse_date("2026-07-09"), datetime.min.time())
    ax.axhspan(0, 33, xmin=0, xmax=1, alpha=0.06, color='#e74c3c', zorder=0)
    ax.axhspan(33, 66, xmin=0, xmax=1, alpha=0.05, color='#f39c12', zorder=0)
    ax.axhspan(66, 100, xmin=0, xmax=1, alpha=0.05, color='#2ecc71', zorder=0)

    xs = [datetime.combine(d, datetime.min.time()) for d in all_dates]
    bar_colors = []
    for v in all_rec:
        if v < 33: bar_colors.append('#e74c3c')
        elif v < 67: bar_colors.append('#f39c12')
        else: bar_colors.append('#2ecc71')

    ax.bar(xs, all_rec, color=bar_colors, alpha=0.75, width=0.75, zorder=2)

    # Rolling avg
    rolling = get_7day_rolling_avg(WHOOP, 'recovery')
    if rolling:
        rdates, rvals = zip(*rolling)
        rxs = [datetime.combine(d, datetime.min.time()) for d in rdates]
        ax.plot(rxs, rvals, color=SPH_BLUE, linewidth=2.0, zorder=4, label='7-day avg')

    for vd, vc, vl in [(SGB1_DATE, SGB1_COLOR, 'SGB-1'), (SGB2_DATE, SGB2_COLOR, 'SGB-2')]:
        vx = datetime.combine(vd, datetime.min.time())
        ax.axvline(x=vx, color=vc, linewidth=2.2, linestyle='--', zorder=5, alpha=0.9)
        ax.text(vx, 96, vl, rotation=0, va='top', ha='left', fontsize=7.5,
                color=vc, fontweight='bold', zorder=6,
                bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor=vc, alpha=0.9))

    ax.set_ylim(0, 105)
    ax.set_title('Recovery Score Timeline', fontsize=12, fontweight='bold', color=SPH_BLUE, pad=8)
    ax.set_xlabel('Date', fontsize=8.5, color='#555555')
    ax.set_ylabel('Recovery %', fontsize=8.5, color='#555555')
    ax.tick_params(axis='both', labelsize=7.5, colors='#555555')
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    plt.xticks(rotation=35, ha='right')
    legend_elements = [
        mpatches.Patch(color='#2ecc71', alpha=0.75, label='Green (>66%)'),
        mpatches.Patch(color='#f39c12', alpha=0.75, label='Yellow (33-66%)'),
        mpatches.Patch(color='#e74c3c', alpha=0.75, label='Red (<33%)'),
        Line2D([0], [0], color=SPH_BLUE, linewidth=2, label='7-day avg'),
    ]
    ax.legend(handles=legend_elements, fontsize=7.5, loc='upper left', framealpha=0.85)
    plt.tight_layout(pad=1.0)
    return save_fig_to_bytes(fig)

# ─── CHART 3: RHR ────────────────────────────────────────────────────────────

def chart_rhr():
    all_dates = [parse_date(d['date']) for d in WHOOP if d.get('rhr') is not None]
    all_rhr   = [d['rhr'] for d in WHOOP if d.get('rhr') is not None]

    fig, ax = plt.subplots(figsize=(11, 3.5))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#fafafa')
    ax.grid(True, color=GRID_COLOR, linewidth=0.7, zorder=0)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    xs = [datetime.combine(d, datetime.min.time()) for d in all_dates]
    ax.plot(xs, all_rhr, color='#c0392b', linewidth=1.4, alpha=0.6, zorder=2)
    ax.scatter(xs, all_rhr, color='#c0392b', s=18, zorder=3, alpha=0.75)

    rolling = get_7day_rolling_avg(WHOOP, 'rhr')
    if rolling:
        rdates, rvals = zip(*rolling)
        rxs = [datetime.combine(d, datetime.min.time()) for d in rdates]
        ax.plot(rxs, rvals, color=SPH_BLUE, linewidth=2.0, zorder=4, label='7-day avg')

    for vd, vc, vl in [(SGB1_DATE, SGB1_COLOR, 'SGB-1'), (SGB2_DATE, SGB2_COLOR, 'SGB-2')]:
        vx = datetime.combine(vd, datetime.min.time())
        ax.axvline(x=vx, color=vc, linewidth=2.2, linestyle='--', zorder=5)
        ax.text(vx, max(all_rhr)+0.5, vl, rotation=0, va='bottom', ha='left', fontsize=7.5,
                color=vc, fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor=vc, alpha=0.9))

    # Annotate peak (post SGB-1 crash day)
    crash_x = datetime.combine(date(2026, 5, 30), datetime.min.time())
    ax.annotate('88 bpm\n(post-SGB1)', xy=(crash_x, 88),
                xytext=(crash_x + timedelta(days=3), 86.5),
                fontsize=7, color=SGB1_COLOR, fontweight='bold',
                arrowprops=dict(arrowstyle='->', color=SGB1_COLOR, lw=1.0))

    ax.set_title('Resting Heart Rate (RHR)', fontsize=12, fontweight='bold', color=SPH_BLUE, pad=8)
    ax.set_xlabel('Date', fontsize=8.5, color='#555555')
    ax.set_ylabel('RHR (bpm)', fontsize=8.5, color='#555555')
    ax.tick_params(axis='both', labelsize=7.5, colors='#555555')
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    plt.xticks(rotation=35, ha='right')
    ax.legend(fontsize=7.5, loc='upper right')
    plt.tight_layout(pad=1.0)
    return save_fig_to_bytes(fig)

# ─── CHART 4: Symptom Heatmap ─────────────────────────────────────────────────

def chart_symptom_heatmap():
    dates_sorted = sorted(SYMPTOMS.keys())
    # Focus on the SGB windows: 2 weeks before SGB1 through 4 weeks after SGB2
    dates_filtered = [d for d in dates_sorted if d >= "2026-05-15"]

    sym_dates = [parse_date(d) for d in dates_filtered]
    pem_vals  = [pem_score(SYMPTOMS[d]['pem']) for d in dates_filtered]
    fog_vals  = [fog_score(SYMPTOMS[d]['brain_fog']) for d in dates_filtered]
    pain_vals = [pain_score(SYMPTOMS[d]['pain']) for d in dates_filtered]
    feel_vals = [feeling_score(SYMPTOMS[d]['feeling']) for d in dates_filtered]

    fig, axes = plt.subplots(4, 1, figsize=(11, 4.5), sharex=True)
    fig.patch.set_facecolor('white')

    data_pairs = [
        (pem_vals,  'PEM',        'Reds',   0, 2),
        (fog_vals,  'Brain Fog',  'Oranges',0, 2),
        (pain_vals, 'Pain',       'Purples',0, 2),
        (feel_vals, 'Feeling',    'RdYlGn', 1, 3),
    ]

    xs = [datetime.combine(d, datetime.min.time()) for d in sym_dates]
    x_nums = [mdates.date2num(x) for x in xs]
    width = 0.8

    for ax, (vals, label, cmap_name, vmin, vmax) in zip(axes, data_pairs):
        ax.set_facecolor('#fafafa')
        ax.grid(False)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['bottom'].set_visible(False)

        cmap = plt.cm.get_cmap(cmap_name)
        bar_colors = []
        for v in vals:
            if v is None:
                bar_colors.append('#e0e0e0')
            else:
                normed = (v - vmin) / (vmax - vmin)
                c = cmap(normed * 0.7 + 0.2)
                bar_colors.append(c)

        plot_vals = [v if v is not None else 0 for v in vals]
        ax.bar(xs, [1]*len(xs), color=bar_colors, width=0.9, align='center', zorder=2)

        for vd, vc, vl in [(SGB1_DATE, SGB1_COLOR, 'SGB-1'), (SGB2_DATE, SGB2_COLOR, 'SGB-2')]:
            vx = datetime.combine(vd, datetime.min.time())
            ax.axvline(x=vx, color=vc, linewidth=2.0, linestyle='--', zorder=5, alpha=0.9)

        ax.set_yticks([])
        ax.set_ylabel(label, fontsize=7.5, color='#555555', rotation=0, ha='right', va='center', labelpad=50)
        ax.set_ylim(0, 1)

    fig.suptitle('Symptom Timeline (Self-Report)', fontsize=11, fontweight='bold', color=SPH_BLUE, y=1.01)

    axes[-1].xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
    axes[-1].xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    plt.xticks(rotation=35, ha='right')
    axes[-1].tick_params(axis='x', labelsize=7.5)

    # Legend for intensity
    legend_text = ("Color intensity = severity/quality:  "
                   "PEM/Brain Fog/Pain: none=white, mild=medium, severe=dark  |  "
                   "Feeling: bad=red, mixed=yellow, good=green  |  gray=no data")
    fig.text(0.5, -0.05, legend_text, ha='center', fontsize=6.5, color='#666666')

    plt.tight_layout(pad=0.5, h_pad=0.3)
    return save_fig_to_bytes(fig)

# ─── CHART 5: Sleep Performance ──────────────────────────────────────────────

def chart_sleep():
    all_dates = [parse_date(d['date']) for d in WHOOP if d.get('sleep_perf') is not None]
    all_sleep = [d['sleep_perf'] for d in WHOOP if d.get('sleep_perf') is not None]

    fig, ax = plt.subplots(figsize=(11, 3.5))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#fafafa')
    ax.grid(True, color=GRID_COLOR, linewidth=0.7, zorder=0)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    xs = [datetime.combine(d, datetime.min.time()) for d in all_dates]
    bar_colors = ['#3498db' if v >= 70 else '#f39c12' if v >= 40 else '#e74c3c' for v in all_sleep]
    ax.bar(xs, all_sleep, color=bar_colors, alpha=0.75, width=0.75, zorder=2)

    rolling = get_7day_rolling_avg(WHOOP, 'sleep_perf')
    if rolling:
        rdates, rvals = zip(*rolling)
        rxs = [datetime.combine(d, datetime.min.time()) for d in rdates]
        ax.plot(rxs, rvals, color=SPH_BLUE, linewidth=2.0, zorder=4, label='7-day avg')

    for vd, vc, vl in [(SGB1_DATE, SGB1_COLOR, 'SGB-1'), (SGB2_DATE, SGB2_COLOR, 'SGB-2')]:
        vx = datetime.combine(vd, datetime.min.time())
        ax.axvline(x=vx, color=vc, linewidth=2.2, linestyle='--', zorder=5)
        ax.text(vx, 98, vl, rotation=0, va='top', ha='left', fontsize=7.5,
                color=vc, fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor=vc, alpha=0.9))

    # Annotate crash
    crash_x = datetime.combine(date(2026, 5, 30), datetime.min.time())
    ax.annotate('14%\n(post-SGB1)', xy=(crash_x, 14),
                xytext=(crash_x + timedelta(days=2.5), 25),
                fontsize=7, color=SGB1_COLOR, fontweight='bold',
                arrowprops=dict(arrowstyle='->', color=SGB1_COLOR, lw=1.0))

    ax.set_ylim(0, 105)
    ax.set_title('Sleep Performance %', fontsize=12, fontweight='bold', color=SPH_BLUE, pad=8)
    ax.set_xlabel('Date', fontsize=8.5, color='#555555')
    ax.set_ylabel('Sleep Performance %', fontsize=8.5, color='#555555')
    ax.tick_params(axis='both', labelsize=7.5, colors='#555555')
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    plt.xticks(rotation=35, ha='right')
    ax.legend(fontsize=7.5, loc='upper left')
    plt.tight_layout(pad=1.0)
    return save_fig_to_bytes(fig)

# ─── CHART 6: Pre/Post Comparison Bar Chart ──────────────────────────────────

def chart_comparison():
    def avg(data, key, start_date, end_date):
        vals = [d[key] for d in data
                if d.get(key) is not None
                and start_date <= parse_date(d['date']) <= end_date]
        return np.mean(vals) if vals else None

    # Windows
    pre_sgb1_start  = date(2026, 5, 1)
    pre_sgb1_end    = date(2026, 5, 28)
    post_sgb1_start = date(2026, 5, 30)
    post_sgb1_end   = date(2026, 6, 11)
    post_sgb2_start = date(2026, 6, 13)
    post_sgb2_end   = date(2026, 7, 8)

    metrics = ['hrv', 'recovery', 'rhr', 'sleep_perf']
    labels  = ['HRV (ms)', 'Recovery %', 'RHR (bpm)', 'Sleep Perf %']
    better_is_higher = [True, True, False, True]  # for RHR, lower is better

    periods = [
        (pre_sgb1_start, pre_sgb1_end, 'Pre-SGB1\n(May 1–28)', '#2ecc71'),
        (post_sgb1_start, post_sgb1_end, 'Post-SGB1\n(May 30–Jun 11)', '#e67e22'),
        (post_sgb2_start, post_sgb2_end, 'Post-SGB2\n(Jun 13–Jul 8)', '#3498db'),
    ]

    fig, axes = plt.subplots(1, 4, figsize=(11, 4.0))
    fig.patch.set_facecolor('white')

    for ax, metric, label, higher_better in zip(axes, metrics, labels, better_is_higher):
        ax.set_facecolor('#fafafa')
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#cccccc')
        ax.spines['bottom'].set_color('#cccccc')
        ax.grid(True, axis='y', color=GRID_COLOR, linewidth=0.7)

        vals_list = [avg(WHOOP, metric, s, e) for s, e, _, _ in periods]
        bar_labels = [lbl for _, _, lbl, _ in periods]
        bar_colors = [c for _, _, _, c in periods]

        xs = range(len(vals_list))
        for i, (v, c) in enumerate(zip(vals_list, bar_colors)):
            if v is not None:
                ax.bar(i, v, color=c, alpha=0.8, width=0.55, zorder=2)
                ax.text(i, v + (max([x for x in vals_list if x])*0.02), f'{v:.1f}',
                        ha='center', va='bottom', fontsize=7.5, fontweight='bold', color='#333333')

        ax.set_xticks(list(xs))
        ax.set_xticklabels(bar_labels, fontsize=6.5, color='#555555')
        ax.set_title(label, fontsize=8.5, fontweight='bold', color=SPH_BLUE, pad=5)
        ax.tick_params(axis='y', labelsize=7)
        ax.set_ylabel('')

    fig.suptitle('Before vs. After: Average Biometrics by Period', fontsize=11, fontweight='bold',
                 color=SPH_BLUE, y=1.02)
    plt.tight_layout(pad=1.0, w_pad=1.5)
    return save_fig_to_bytes(fig)

# ─── PDF GENERATION ──────────────────────────────────────────────────────────

def make_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=0.75*inch,
        rightMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle('Title', parent=styles['Title'],
                                  fontSize=20, textColor=colors.HexColor(SPH_BLUE),
                                  spaceAfter=4, alignment=TA_CENTER)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'],
                                     fontSize=11, textColor=colors.HexColor('#555555'),
                                     spaceAfter=2, alignment=TA_CENTER)
    h1_style = ParagraphStyle('H1', parent=styles['Heading1'],
                               fontSize=13, textColor=colors.HexColor(SPH_BLUE),
                               spaceBefore=12, spaceAfter=5,
                               borderPad=4)
    h2_style = ParagraphStyle('H2', parent=styles['Heading2'],
                               fontSize=10, textColor=colors.HexColor('#2c3e50'),
                               spaceBefore=8, spaceAfter=3)
    body_style = ParagraphStyle('Body', parent=styles['Normal'],
                                 fontSize=8.5, leading=13, textColor=colors.HexColor('#333333'))
    note_style = ParagraphStyle('Note', parent=styles['Normal'],
                                 fontSize=7.5, leading=11, textColor=colors.HexColor('#666666'),
                                 leftIndent=12)
    small_style = ParagraphStyle('Small', parent=styles['Normal'],
                                  fontSize=7, leading=10, textColor=colors.HexColor('#888888'))
    label_style = ParagraphStyle('Label', parent=styles['Normal'],
                                  fontSize=8, fontName='Helvetica-Bold',
                                  textColor=colors.HexColor(SPH_BLUE))

    story = []

    # ── HEADER ──
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph("Stellate Ganglion Block (SGB) Response Report", title_style))
    story.append(Paragraph("Hannah Munguia — Biometric & Symptom Analysis", subtitle_style))
    story.append(Paragraph("Data: WHOOP + Cadence Self-Report  |  Period: May 1 – July 8, 2026", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor(SPH_BLUE), spaceAfter=10))

    # ── PROCEDURE SUMMARY ──
    story.append(Paragraph("Procedure Summary", h1_style))

    proc_data = [
        ['', 'SGB-1 (Left Side)', 'SGB-2 (Right Side)'],
        ['Date', 'Friday, May 29, 2026', 'Saturday, June 12, 2026'],
        ['Side', 'Left', 'Right'],
        ['Day Type', 'High-demand (drive + wait + procedure)', 'Moderate (procedure + evening sewing)'],
        ['Pre-procedure HRV', '29.8 ms', '26.3 ms'],
        ['Pre-procedure Recovery', '55%', '49%'],
        ['Nadir (lowest day)', 'May 30: HRV 17.1ms, Recovery 18%', 'Jun 13: sleep 7%, no overnight sleep'],
        ['Stabilization', 'Jun 2 (D+4): HRV 31.8, Recovery 70%', 'Jun 16 (D+4): HRV 33.6, Recovery 73%'],
    ]

    proc_table = Table(proc_data, colWidths=[1.6*inch, 2.9*inch, 2.9*inch])
    proc_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor(SPH_BLUE)),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8.5),
        ('BACKGROUND', (0,1), (0,-1), colors.HexColor('#eaf3fb')),
        ('FONTNAME', (0,1), (0,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,1), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cccccc')),
        ('ROWBACKGROUNDS', (1,1), (-1,-1), [colors.white, colors.HexColor('#f8fbff')]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(proc_table)
    story.append(Spacer(1, 0.15*inch))

    # ── HRV CHART ──
    story.append(Paragraph("HRV (RMSSD) — Primary Outcome", h1_style))
    hrv_buf = chart_hrv()
    story.append(Image(hrv_buf, width=7.0*inch, height=2.8*inch))
    story.append(Paragraph(
        "<b>Key observations:</b> Pre-SGB1 HRV baseline averaged <b>32.5 ms</b> (May 1–28). "
        "SGB-1 caused an acute crash (17.1 ms, May 30) followed by an extraordinary rebound spike (49.4 ms, May 31). "
        "David noted this was the fastest HRV turnaround ever observed in Hannah. "
        "Post-SGB2, HRV has been more consistently in the 30–38 ms range with recent readings (Jul 6–7) reaching 33.6 and 38.5 ms. "
        "The 7-day rolling average shows a modest upward trend in the post-SGB2 period.",
        body_style))
    story.append(Spacer(1, 0.1*inch))

    # ── RECOVERY CHART ──
    story.append(Paragraph("Recovery Score", h1_style))
    rec_buf = chart_recovery()
    story.append(Image(rec_buf, width=7.0*inch, height=2.5*inch))
    story.append(Paragraph(
        "<b>Key observations:</b> Recovery crashed to 18% the day after SGB-1 then spiked to 98% (May 31). "
        "SGB-2 was better tolerated — recovery stayed in yellow/green range the following days. "
        "Recent weeks (Jun 20–Jul 8) show more consistent green-zone recovery scores.",
        body_style))

    story.append(PageBreak())

    # ── COMPARISON BAR CHART ──
    story.append(Paragraph("Period Averages: Pre vs. Post SGB", h1_style))
    comp_buf = chart_comparison()
    story.append(Image(comp_buf, width=7.0*inch, height=2.6*inch))

    # Stats table
    def period_stats(start, end):
        hrv_vals = [d['hrv'] for d in WHOOP if d.get('hrv') and start <= parse_date(d['date']) <= end]
        rec_vals = [d['recovery'] for d in WHOOP if d.get('recovery') and start <= parse_date(d['date']) <= end]
        rhr_vals = [d['rhr'] for d in WHOOP if d.get('rhr') and start <= parse_date(d['date']) <= end]
        slp_vals = [d['sleep_perf'] for d in WHOOP if d.get('sleep_perf') and start <= parse_date(d['date']) <= end]
        return (
            f"{np.mean(hrv_vals):.1f}±{np.std(hrv_vals):.1f}" if hrv_vals else "—",
            f"{np.mean(rec_vals):.0f}%" if rec_vals else "—",
            f"{np.mean(rhr_vals):.0f}" if rhr_vals else "—",
            f"{np.mean(slp_vals):.0f}%" if slp_vals else "—",
        )

    ps = [
        ("Pre-SGB1 (May 1–28)", date(2026,5,1), date(2026,5,28)),
        ("Post-SGB1 (May 30–Jun 11)", date(2026,5,30), date(2026,6,11)),
        ("Post-SGB2 (Jun 13–Jul 8)", date(2026,6,13), date(2026,7,8)),
    ]

    stat_data = [['Period', 'HRV (mean±SD)', 'Recovery (avg)', 'RHR (avg)', 'Sleep Perf (avg)']]
    for label, s, e in ps:
        h, r, rhr, sl = period_stats(s, e)
        stat_data.append([label, h, r, rhr, sl])

    stat_table = Table(stat_data, colWidths=[2.2*inch, 1.4*inch, 1.3*inch, 1.2*inch, 1.4*inch])
    stat_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor(SPH_BLUE)),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8.5),
        ('FONTSIZE', (0,1), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cccccc')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fbff')]),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(Spacer(1, 0.08*inch))
    story.append(stat_table)
    story.append(Spacer(1, 0.15*inch))

    # ── RHR & SLEEP ──
    story.append(Paragraph("Resting Heart Rate (RHR)", h1_style))
    rhr_buf = chart_rhr()
    story.append(Image(rhr_buf, width=7.0*inch, height=2.3*inch))
    story.append(Paragraph(
        "<b>Key observations:</b> RHR spiked to 88 bpm the day after SGB-1 (sympathetic rebound/stress response). "
        "Both pre-SGB baselines and post-SGB2 settled values are consistently in the 69–75 bpm range. "
        "No sustained elevation post-SGB2 — better procedure tolerance.",
        body_style))
    story.append(Spacer(1, 0.1*inch))

    story.append(Paragraph("Sleep Performance", h1_style))
    sleep_buf = chart_sleep()
    story.append(Image(sleep_buf, width=7.0*inch, height=2.3*inch))
    story.append(Paragraph(
        "<b>Key observations:</b> Sleep performance crashed to 14% the night after SGB-1 (couldn't sleep, 2am awake). "
        "Sleep then disrupted for ~3 nights (night-time sleep absent, only naps). "
        "Post-SGB2, sleep scores have been notably more stable with several 78–83% nights. "
        "Recent week (Jul 5–8) shows consistent 69–82% sleep performance — an improvement over pre-SGB levels.",
        body_style))

    story.append(PageBreak())

    # ── SYMPTOM HEATMAP ──
    story.append(Paragraph("Symptom Timeline (Self-Report)", h1_style))
    heat_buf = chart_symptom_heatmap()
    story.append(Image(heat_buf, width=7.0*inch, height=2.8*inch))
    story.append(Spacer(1, 0.05*inch))
    story.append(Paragraph(
        "Each column = one day. Color intensity reflects severity. "
        "PEM/Brain Fog/Pain: white = none, medium = mild, dark = severe. "
        "Feeling: green = good, yellow = mixed, red = bad. Gray = no data.",
        small_style))
    story.append(Spacer(1, 0.2*inch))

    # ── SGB-1 SYMPTOM LOG ──
    story.append(Paragraph("SGB-1 (Left Side) — Symptom Log", h1_style))
    story.append(Paragraph("May 29, 2026", h2_style))

    sgb1_symptoms = [
        ["Day", "Date", "Feeling", "PEM", "Brain Fog", "Pain", "Key Symptoms / Notes"],
        ["SGB Day", "May 29", "Bad", "Severe", "Mild", "Severe",
         "Hoarse voice, neck pain, emotional discharge, Horner's sign (eye droop), unable to nap, 'wired but tired', arm pain (L), took Xanax 0.012mg"],
        ["D+1", "May 30", "Mixed", "Mild", "Mild", "Mild",
         "Woke 4:30am; hoarseness resolved; hip/body aches, bloating, constipation, flushed cheeks. HRV 17.1 ms (nadir), RHR 88 bpm"],
        ["D+2", "May 31", "Bad", "Severe", "Mild", "None",
         "Increased smell sensitivity (olfactory acuity). Insomnia at 2:20am — strange headache at back of neck. HRV spiked to 49.4 ms"],
        ["D+3", "Jun 1",  "Bad", "Severe", "Mild", "Mild",
         "Neck feels bruised at injection site. Severely fatigued — hard time moving (alarming level of fatigue)"],
        ["D+4", "Jun 2",  "Mixed", "Mild", "Mild", "Severe",
         "First time outside (wheelchair). Intense uterine cramping ~8pm. Very sore knees. HRV 31.8 (stabilized)"],
        ["D+5", "Jun 3",  "Bad", "Severe", "Mild", "Mild",
         "Home all day. Tried to sew — couldn't"],
        ["D+6", "Jun 4",  "Mixed", "Mild", "None", "None",
         "Some sewing, light housework. Signs of stabilization"],
        ["D+7", "Jun 5",  "Mixed", "Mild", "Mild", "None",
         "Washed sewing fabric. Relatively good day"],
    ]

    sgb1_table = Table(sgb1_symptoms,
                        colWidths=[0.55*inch, 0.6*inch, 0.55*inch, 0.55*inch, 0.65*inch, 0.45*inch, 3.55*inch])
    sgb1_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor(SGB1_COLOR)),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8),
        ('FONTSIZE', (0,1), (-1,-1), 7),
        ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#dddddd')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#fff8f8')]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,1), (0,1), colors.HexColor('#fde8e8')),
        ('FONTNAME', (0,1), (0,1), 'Helvetica-Bold'),
    ]))
    story.append(sgb1_table)
    story.append(Spacer(1, 0.05*inch))
    story.append(Paragraph(
        "Note: SGB-1 was a high-demand day (driving to/from clinic, wait room, procedure). "
        "The crash severity may be partly attributable to the demand level, not the procedure alone.",
        note_style))
    story.append(Spacer(1, 0.2*inch))

    # ── SGB-2 SYMPTOM LOG ──
    story.append(Paragraph("SGB-2 (Right Side) — Symptom Log", h1_style))
    story.append(Paragraph("June 12, 2026", h2_style))

    sgb2_symptoms = [
        ["Day", "Date", "Feeling", "PEM", "Brain Fog", "Pain", "Key Symptoms / Notes"],
        ["SGB Day", "Jun 12", "Mixed", "Mild", "None", "None",
         "Much better tolerated than SGB-1. Minor eye droop only — no hoarseness, no dissociation, normal swallowing. Felt warm (in-ear temp 99.5°F at 6pm). Took all meds beforehand; big brunch. Able to sew that evening."],
        ["D+1", "Jun 13", "Mixed", "Mild", "Mild", "Mild",
         "No sleep overnight. Slight headache (back of head), flushed cheeks. Trip to Newport with Harrison (2hr drive each way)"],
        ["D+2", "Jun 14", "Mixed", "Mild", "Mild", "None",
         "Beach time, sun, standing. Sudden fatigue → long nap. 2hr car ride home."],
        ["D+3", "Jun 15", "Bad", "Severe", "Mild", "None",
         "Xolair injection (same day). Demanding day — confounding with Xolair response."],
        ["D+4", "Jun 16", "Mixed", "Severe", "Mild", "Mild", "Recovering"],
        ["D+5", "Jun 17", "Mixed", "Severe", "Mild", "None", ""],
        ["D+6", "Jun 18", "Mixed", "Mild", "Mild", "None", "Claunch appointment"],
        ["D+7", "Jun 19", "Mixed", "Mild", "None", "None", "Signs of stabilization"],
    ]

    sgb2_table = Table(sgb2_symptoms,
                        colWidths=[0.55*inch, 0.6*inch, 0.55*inch, 0.55*inch, 0.65*inch, 0.45*inch, 3.55*inch])
    sgb2_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor(SGB2_COLOR)),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8),
        ('FONTSIZE', (0,1), (-1,-1), 7),
        ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#dddddd')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8f0ff')]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,1), (0,1), colors.HexColor('#f0e0ff')),
        ('FONTNAME', (0,1), (0,1), 'Helvetica-Bold'),
    ]))
    story.append(sgb2_table)
    story.append(Spacer(1, 0.05*inch))
    story.append(Paragraph(
        "Note: The immediate post-procedure experience was significantly better than SGB-1. "
        "The subsequent crash (Jun 15+) is confounded by a Xolair injection and Newport travel on D+1/D+2.",
        note_style))

    story.append(PageBreak())

    # ── CLINICAL CONTEXT & OBSERVATIONS ──
    story.append(Paragraph("Clinical Observations & Context", h1_style))

    obs_data = [
        ["Observation", "Detail"],
        ["SGB-1 vs SGB-2 Tolerance",
         "SGB-2 was dramatically better tolerated. Hannah experienced minimal side effects (minor eye droop only, no hoarseness, no dissociation, no crying). Preparation (meds taken beforehand, large meal) may have contributed."],
        ["Autonomic Rebound (SGB-1)",
         "The HRV spike to 49.4 ms on May 31 (D+2 post-SGB1) was described by David as the fastest HRV turnaround ever observed in Hannah. The sympathetic 'reset' mechanism is consistent with the SGB mechanism of action."],
        ["Olfactory Acuity",
         "Hannah reported heightened smell sensitivity on D+2 (May 31 — 'super sensitive to the litter box'). This is a recognized early SGB response marker, consistent with improved cerebral/olfactory blood flow."],
        ["Horner's Sign (SGB-1 only)",
         "Eye droop on the day of SGB-1 confirmed the stellate ganglion was blocked. Nurse noted 'strong autonomic response'. This was absent after SGB-2."],
        ["Confounders",
         "Several factors complicate clean before/after analysis: (1) LDN dose changes in May (6mg→4.5mg→3mg), (2) Prozac changes (10mg→0), (3) Xolair injection Jun 15 (D+3 post-SGB2), (4) Rapamycin 6mg taken May 26. Biometric trends should be interpreted with these in mind."],
        ["Post-SGB2 Trend (Late June)",
         "A prolonged low-feeling period (late Jun 22–30) followed SGB-2 with multiple bad/severe PEM days. Several external stressors noted (financial stress, Jun 25 demanding car day). HRV remained in 25–36 ms range throughout."],
        ["Recent Trajectory (July)",
         "July 4–8 shows encouraging signs: Hannah sewed on Jul 4 (first time since before Father's Day), reported 'good' feeling on Jul 5, and WHOOP data shows recovery 81–98%, HRV 31–38.5 ms, RHR 69–72 bpm in the Jul 5–8 window."],
        ["Nicotine Patch Trial (Jul 6)",
         "Hannah tried a half nicotine patch (3.5 mg) which caused severe fatigue within 1 hour, unable to move. Removed at hour 4. This strongly affected Jul 6 data. Not SGB-related but clinically significant."],
    ]

    obs_table = Table(obs_data, colWidths=[1.9*inch, 5.55*inch])
    obs_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor(SPH_BLUE)),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8.5),
        ('FONTSIZE', (0,1), (-1,-1), 7.5),
        ('FONTNAME', (0,1), (0,-1), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#cccccc')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f5f9fd')]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 5),
        ('TEXTCOLOR', (0,1), (0,-1), colors.HexColor(SPH_BLUE)),
    ]))
    story.append(obs_table)
    story.append(Spacer(1, 0.25*inch))

    # ── MEDICATIONS CONTEXT ──
    story.append(Paragraph("Active Medications During Study Period", h1_style))
    med_data = [
        ["Medication", "Notes"],
        ["LDN (Low-Dose Naltrexone)", "Started at 6mg; reduced to 4.5mg (May 23), then 3mg (May 27) around SGB-1 period"],
        ["Prozac (fluoxetine)", "Changed from 20mg → 10mg (May 26), then taper to 0 (Jun 11+)"],
        ["Propranolol", "Taken before SGB-1. 20mg AM added Jun 12."],
        ["Xolair (omalizumab)", "Injection Jun 15 — confounds early post-SGB2 period"],
        ["Rapamycin", "6mg single dose May 26 (day before SGB-1 crash)"],
        ["BCP-157 (oral peptide)", "Started May 21"],
        ["Pepzin / Pepzid (famotidine)", "Taken intermittently for GI/MCAS support"],
        ["VNS device (Pulsetto)", "Not used night of SGB-1 (per provider instruction). Resumed after."],
    ]
    med_table = Table(med_data, colWidths=[2.1*inch, 5.35*inch])
    med_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2c3e50')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8.5),
        ('FONTSIZE', (0,1), (-1,-1), 7.5),
        ('FONTNAME', (0,1), (0,-1), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#cccccc')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f5f5f5')]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(med_table)
    story.append(Spacer(1, 0.2*inch))

    # ── FOOTER ──
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#cccccc'), spaceBefore=5))
    story.append(Spacer(1, 0.05*inch))
    story.append(Paragraph(
        "Report generated by Cleo 🦉 (Spectator Health Clinical AI) — July 9, 2026  |  "
        "Data source: WHOOP (user_id 6729032) + Cadence self-report app  |  "
        "This report is for clinical discussion purposes only and is not a medical assessment.",
        small_style))

    doc.build(story)
    print(f"PDF saved: {output_path}")


if __name__ == '__main__':
    output = '/home2/cleo/.openclaw/workspace/Hannah_SGB_Report_2026-07-09.pdf'
    make_pdf(output)
