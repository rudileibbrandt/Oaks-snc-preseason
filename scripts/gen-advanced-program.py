#!/usr/bin/env python3
"""Regenerate services/advancedProgram.ts from the "Pre-Season #1" Google Sheet.

Usage:
  1. In Google Sheets: File > Download > Microsoft Excel (.xlsx).
  2. python3 scripts/gen-advanced-program.py ~/Downloads/Pre-Season_1_simple.xlsx

Reads the sheet layout as the coaches built it: a "Week N · <phase> · <dates>" header row,
a row of day names (Mon..Sun in columns B..H), then one item per cell:
  "A  Front squat   3 × 6"   lettered = superset lift (logs weight/sets/reps)
  "•  Recovery #5"           bullet   = tick-off item
  "Note: ..."                day-level instruction
  "Day Off: ..."             rest day
Cell hyperlinks become video links and cell notes become coaching notes. A lift with no link
borrows the link from the same lift elsewhere in the sheet. The program's Monday of week 1 is
WEEK1_MONDAY below; change it for a new season.
"""
import datetime
import html
import json
import re
import sys
import zipfile
from pathlib import Path

WEEK1_MONDAY = datetime.date(2026, 11, 2)
COLS = 'BCDEFGH'
DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
OUT = Path(__file__).resolve().parent.parent / 'services' / 'advancedProgram.ts'


def read_sheet(xlsx_path):
    """Return (cells, links, notes) for the first worksheet, each keyed by cell ref like 'B7'."""
    z = zipfile.ZipFile(xlsx_path)
    names = z.namelist()
    shared = [html.unescape(re.sub(r'<[^>]+>', '', si))
              for si in re.findall(r'<si>(.*?)</si>', z.read('xl/sharedStrings.xml').decode(), re.S)]
    sheet = z.read('xl/worksheets/sheet1.xml').decode()

    cells = {}
    for ref, attrs, inner in re.findall(r'<c r="([A-Z]+\d+)"([^>]*?)(?:/>|>(.*?)</c>)', sheet, re.S):
        if not inner:
            continue
        v = re.search(r'<v>(.*?)</v>', inner)
        t = re.search(r't="(\w+)"', attrs)
        if v:
            val = shared[int(v.group(1))] if t and t.group(1) == 's' else html.unescape(v.group(1))
        else:
            inline = re.search(r'<t[^>]*>(.*?)</t>', inner, re.S)
            val = html.unescape(inline.group(1)) if inline else ''
        if val.strip():
            cells[ref] = val

    rels = {}
    rels_name = 'xl/worksheets/_rels/sheet1.xml.rels'
    if rels_name in names:
        for el in re.findall(r'<Relationship [^>]*/>', z.read(rels_name).decode()):
            rels[re.search(r'Id="(\w+)"', el).group(1)] = html.unescape(re.search(r'Target="([^"]*)"', el).group(1))
    links = {ref: rels.get(rid) for rid, ref in re.findall(r'<hyperlink r:id="(rId\d+)" ref="([A-Z]+\d+)"', sheet)}

    notes = {}
    comments = next((n for n in names if re.match(r'xl/comments\d*\.xml$', n)), None)
    if comments:
        for attrs, body in re.findall(r'<comment ([^>]*)>(.*?)</comment>', z.read(comments).decode(), re.S):
            ref = re.search(r'ref="([A-Z]+\d+)"', attrs).group(1)
            notes[ref] = html.unescape(re.sub(r'<[^>]+>', '', body)).strip()
    return cells, links, notes


def split_item(text):
    """'A  Front squat   3 × 6' -> ('A', 'Front squat', '3 × 6'); bullets get group None."""
    m = re.match(r'^([A-E])\s{2}(.*)$', text)
    if m:
        group, rest = m.group(1), m.group(2)
    elif text.startswith('•'):
        group, rest = None, text[1:].strip()
    else:
        return None
    parts = re.split(r'\s{3,}', rest.strip(), maxsplit=1)
    return group, parts[0].strip(), (parts[1].strip() if len(parts) > 1 else '')


def build_weeks(cells, links, notes):
    week_rows = sorted(int(k[1:]) for k, v in cells.items() if k.startswith('B') and v.startswith('Week '))
    if not week_rows:
        sys.exit('No "Week N" header rows found in column B.')
    last_row = max(int(k[1:]) for k in cells) + 1

    video_by_name = {}
    for ref, url in links.items():
        if url and ref in cells:
            item = split_item(cells[ref])
            if item and item[0]:
                video_by_name.setdefault(item[1].lower(), url)

    weeks, placed = [], 0
    for wi, header_row in enumerate(week_rows):
        parts = [p.strip() for p in cells[f'B{header_row}'].split('·')]
        week_no = int(re.search(r'Week (\d+)', parts[0]).group(1))
        phase = re.sub(r'\s*\(.*?\)\s*', '', parts[1]).strip()  # drop asides like "(added, not Rugby Ready)"
        end_row = week_rows[wi + 1] if wi + 1 < len(week_rows) else last_row
        monday = WEEK1_MONDAY + datetime.timedelta(weeks=week_no - 1)
        days = []
        for ci, col in enumerate(COLS):
            date = monday + datetime.timedelta(days=ci)
            day_id = f'adv_w{week_no}_{DAY_KEYS[ci]}'
            exercises, day_notes, rest = [], [], None
            for r in range(header_row + 2, end_row):  # +2 skips the day-name row
                ref = f'{col}{r}'
                text = cells.get(ref)
                if not text:
                    continue
                placed += 1
                item = split_item(text)
                if item is None:
                    label, _, body = text.partition(':')
                    if label.strip() == 'Note':
                        day_notes.append(body.strip())
                    else:
                        rest = body.strip() or label.strip()
                    continue
                group, name, reps = item
                url = links.get(ref) or (video_by_name.get(name.lower()) if group else None)
                ex = {'id': f'{day_id}_{len(exercises) + 1}', 'name': name, 'reps': reps,
                      'isMetric': group is not None}
                if group:
                    ex['group'] = group
                if url:
                    ex['videoUrl'] = url
                if ref in notes:
                    ex['note'] = notes[ref]
                exercises.append(ex)
            has_lift = any(e['isMetric'] for e in exercises)
            day = {'id': day_id, 'title': f"{date.strftime('%a')} {date.day} {date.strftime('%b')}",
                   'focus': 'Strength' if has_lift else ('Conditioning & Recovery' if exercises else 'Rest Day'),
                   'date': date.isoformat(), 'exercises': exercises}
            if day_notes:
                day['note'] = ' '.join(day_notes)
            if rest:
                day['restNote'] = rest
            days.append(day)
        weeks.append({'week': week_no, 'phase': phase, 'startDate': monday.isoformat(), 'days': days})

    # Every content cell below the first week header must land in a day.
    day_name = re.compile(r'^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s')
    expected = sum(1 for k, v in cells.items()
                   if int(k[1:]) > week_rows[0] and k[0] in COLS
                   and not v.startswith('Week ') and not day_name.match(v))
    if placed != expected:
        sys.exit(f'Placed {placed} of {expected} sheet cells; the sheet layout has changed.')
    return weeks, placed


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    weeks, placed = build_weeks(*read_sheet(sys.argv[1]))
    body = json.dumps(weeks, indent=2, ensure_ascii=False)
    OUT.write_text(f'''// Advanced S&C program: "Pre-Season #1" (Mon 2 Nov – Sun 20 Dec 2026).
// Generated by scripts/gen-advanced-program.py from the coaches' Google Sheet.
// Edit the sheet and regenerate rather than hand-editing.
// Letters A–E are supersets. Lettered lifts log weight/sets/reps; runs, recovery and
// Team Training are tick-off only.
import {{ AdvancedWeek }} from '../types';

export const ADVANCED_WEEKS: AdvancedWeek[] = {body};
''')
    print(f'Wrote {OUT.name}: {len(weeks)} weeks, {sum(len(w["days"]) for w in weeks)} days, {placed} sheet items.')


if __name__ == '__main__':
    main()
