from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak
from reportlab.pdfbase.pdfmetrics import stringWidth

OUT = 'output/pdf/hotel_booking_day_1_7_plan.pdf'

NAVY = colors.HexColor('#14213D')
AMBER = colors.HexColor('#D97706')
PALE_AMBER = colors.HexColor('#FFF7ED')
MIST = colors.HexColor('#F8FAFC')
LINE = colors.HexColor('#E2E8F0')
MUTED = colors.HexColor('#64748B')
GREEN = colors.HexColor('#166534')

styles = getSampleStyleSheet()
title = ParagraphStyle('title', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=25, leading=29, textColor=NAVY, spaceAfter=5)
subtitle = ParagraphStyle('subtitle', parent=styles['Normal'], fontName='Helvetica', fontSize=10.5, leading=14, textColor=MUTED, spaceAfter=14)
day_style = ParagraphStyle('day', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=11, textColor=AMBER)
task_style = ParagraphStyle('task', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=NAVY)
detail_style = ParagraphStyle('detail', parent=styles['Normal'], fontName='Helvetica', fontSize=8.7, leading=11.4, textColor=NAVY)
outcome_style = ParagraphStyle('outcome', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8.7, leading=11, textColor=GREEN)
h2 = ParagraphStyle('h2', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=15, leading=18, textColor=NAVY, spaceBefore=10, spaceAfter=8)
body = ParagraphStyle('body', parent=styles['Normal'], fontName='Helvetica', fontSize=10, leading=14, textColor=NAVY)
small = ParagraphStyle('small', parent=styles['Normal'], fontName='Helvetica', fontSize=8.5, leading=11, textColor=MUTED)

tasks = [
    ('DAY 1', 'Understand the project', 'Read the project report and SQL file. Learn the meaning of Customer, Room, Reservation, Payment, primary key, and foreign key.', 'You can explain the problem statement and project goal in 30 seconds.'),
    ('DAY 2', 'Run and inspect the database', 'Start MySQL, run the SQL file once, open MySQL Workbench, and inspect all tables, views, procedures, and triggers.', 'Database runs without errors and you have screenshots of the schema and tables.'),
    ('DAY 3', 'Understand the database design', 'Study the ER diagram and 3NF explanation. Draw the ER diagram neatly in draw.io and export it as an image.', 'ER diagram ready for your report and presentation.'),
    ('DAY 4', 'Practise SQL features', 'Run the availability procedure, reservation view, revenue query, and the double-booking trigger test. Understand what each result means.', 'You can demonstrate DDL, DML, joins, views, procedures, triggers, and indexes.'),
    ('DAY 5', 'Use the web frontend', 'Start the frontend, search rooms for future dates, create one reservation, then verify it in MySQL Workbench.', 'You can prove that frontend updates are saved in the backend database.'),
    ('DAY 6', 'Complete report and slides', 'Replace your name/roll number in the report. Add six screenshots. Create the 11 slides using the presentation outline.', 'Submission-ready report and presentation deck.'),
    ('DAY 7', 'Rehearse the faculty demo', 'Practise the 3-5 minute demo: dashboard, availability search, booking, MySQL proof, trigger, ER diagram, and conclusion.', 'You can present confidently and answer common viva questions.'),
]

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=16*mm, rightMargin=16*mm, topMargin=15*mm, bottomMargin=14*mm)
story = []
story.append(Paragraph('DBMS Mini Project - Day 1 to Day 7 Plan', title))
story.append(Paragraph('Hotel Booking and Reservation Management System | Beginner-friendly weekly checklist', subtitle))

for day, task, details, outcome in tasks:
    left = Table([[Paragraph(day, day_style)]], colWidths=[19*mm], rowHeights=[24*mm])
    left.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), PALE_AMBER), ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#FED7AA')), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'), ('ALIGN', (0,0), (-1,-1), 'CENTER'), ('LEFTPADDING', (0,0), (-1,-1), 3), ('RIGHTPADDING', (0,0), (-1,-1), 3)]))
    middle = [Paragraph(task, task_style), Spacer(1, 2), Paragraph(details, detail_style)]
    right = [Paragraph('END-OF-DAY RESULT', day_style), Spacer(1, 2), Paragraph(outcome, outcome_style)]
    row = Table([[left, middle, right]], colWidths=[20*mm, 90*mm, 68*mm], rowHeights=[24*mm])
    row.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), colors.white), ('BOX', (0,0), (-1,-1), 0.5, LINE), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'), ('LEFTPADDING', (1,0), (-1,-1), 8), ('RIGHTPADDING', (1,0), (-1,-1), 8), ('TOPPADDING', (1,0), (-1,-1), 4), ('BOTTOMPADDING', (1,0), (-1,-1), 4), ('LINEBEFORE', (2,0), (2,0), 0.5, LINE)]))
    story.append(KeepTogether([row, Spacer(1, 5)]))

story.append(PageBreak())
story.append(Paragraph('Final submission checklist', h2))
checklist = [
    ['Database', 'MySQL script runs successfully; tables, triggers, procedures, views, and sample data are visible.'],
    ['Frontend', 'Dashboard opens at http://localhost:3000 and a new reservation appears in MySQL.'],
    ['Report', 'Name and roll number added; ER diagram and at least six screenshots included.'],
    ['Presentation', '11-slide deck completed; you can explain the database and demo flow in 3-5 minutes.'],
]
table = Table([[Paragraph('<b>AREA</b>', small), Paragraph('<b>READY WHEN...</b>', small)]] + [[Paragraph(a, body), Paragraph(b, body)] for a,b in checklist], colWidths=[34*mm, 144*mm])
table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY), ('TEXTCOLOR',(0,0),(-1,0),colors.white), ('BACKGROUND',(0,1),(-1,-1),MIST), ('GRID',(0,0),(-1,-1),0.4,LINE), ('VALIGN',(0,0),(-1,-1),'TOP'), ('LEFTPADDING',(0,0),(-1,-1),7), ('RIGHTPADDING',(0,0),(-1,-1),7), ('TOPPADDING',(0,0),(-1,-1),6), ('BOTTOMPADDING',(0,0),(-1,-1),6)]))
story.append(table)
story.append(Spacer(1, 10))
story.append(Paragraph('Tip: Do not memorise every line of code. Understand the flow: user action -> frontend -> Node.js backend -> MySQL database -> result shown on dashboard.', small))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE); canvas.line(16*mm, 10*mm, 194*mm, 10*mm)
    canvas.setFont('Helvetica', 8); canvas.setFillColor(MUTED)
    canvas.drawString(16*mm, 6*mm, 'Hotel Booking and Reservation Management System')
    canvas.drawRightString(194*mm, 6*mm, f'Page {doc.page}')
    canvas.restoreState()

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
