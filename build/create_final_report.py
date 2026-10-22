from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.section import WD_SECTION

OUT = 'output/Hotel_Booking_Reservation_Management_System_Report.docx'
ER_IMAGE = '/Users/shouryaveggalam/Desktop/Screenshot 2026-10-22 at 3.16.21\u202fPM.png'
BLACK = RGBColor(0, 0, 0)
GRAY = RGBColor(89, 89, 89)
BLUE = '1F4E78'
LIGHT = 'F2F6FA'
BORDER = 'D9D9D9'

def set_run(run, size=11, bold=False, italic=False, color=BLACK, font='Arial'):
    run.font.name = font
    run._element.rPr.rFonts.set(qn('w:ascii'), font)
    run._element.rPr.rFonts.set(qn('w:hAnsi'), font)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color

def set_cell_shading(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = tcPr.find(qn('w:shd'))
    if shd is None:
        shd = OxmlElement('w:shd'); tcPr.append(shd)
    shd.set(qn('w:fill'), fill)

def set_cell_text(cell, text, bold=False, color=BLACK, align=WD_ALIGN_PARAGRAPH.LEFT, size=9.2):
    cell.text = ''
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    p = cell.paragraphs[0]
    p.alignment = align
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.space_before = Pt(0)
    r = p.add_run(str(text))
    set_run(r, size=size, bold=bold, color=color)

def set_cell_margins(cell, top=90, start=110, bottom=90, end=110):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = tcPr.first_child_found_in('w:tcMar')
    if tcMar is None:
        tcMar = OxmlElement('w:tcMar'); tcPr.append(tcMar)
    for m, v in [('top', top), ('start', start), ('bottom', bottom), ('end', end)]:
        node = tcMar.find(qn(f'w:{m}'))
        if node is None:
            node = OxmlElement(f'w:{m}'); tcMar.append(node)
        node.set(qn('w:w'), str(v)); node.set(qn('w:type'), 'dxa')

def add_table(doc, headers, rows, widths=None, font_size=9):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = 'Table Grid'
    if widths:
        for row in table.rows:
            for cell, width in zip(row.cells, widths): cell.width = Inches(width)
    for i, heading in enumerate(headers):
        set_cell_text(table.rows[0].cells[i], heading, True, RGBColor(255,255,255), WD_ALIGN_PARAGRAPH.CENTER, font_size)
        set_cell_shading(table.rows[0].cells[i], BLUE); set_cell_margins(table.rows[0].cells[i])
    for r_index, row_values in enumerate(rows):
        cells = table.add_row().cells
        for i, value in enumerate(row_values):
            align = WD_ALIGN_PARAGRAPH.CENTER if i == 0 and len(headers) <= 3 else WD_ALIGN_PARAGRAPH.LEFT
            set_cell_text(cells[i], value, False, BLACK, align, font_size)
            set_cell_margins(cells[i])
            if r_index % 2 == 1: set_cell_shading(cells[i], LIGHT)
    for row in table.rows:
        for cell in row.cells:
            tcPr = cell._tc.get_or_add_tcPr()
            borders = tcPr.first_child_found_in('w:tcBorders')
            if borders is None:
                borders = OxmlElement('w:tcBorders'); tcPr.append(borders)
            for edge in ('top','left','bottom','right','insideH','insideV'):
                edge_el = borders.find(qn(f'w:{edge}'))
                if edge_el is None:
                    edge_el = OxmlElement(f'w:{edge}'); borders.append(edge_el)
                edge_el.set(qn('w:val'),'single'); edge_el.set(qn('w:sz'),'4'); edge_el.set(qn('w:color'),BORDER)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table

doc = Document()
section = doc.sections[0]
section.page_width = Inches(8.5); section.page_height = Inches(11)
section.top_margin = Inches(0.72); section.bottom_margin = Inches(0.65)
section.left_margin = Inches(0.72); section.right_margin = Inches(0.72)
section.header_distance = Inches(0.32); section.footer_distance = Inches(0.32)

styles = doc.styles
for n in ['Normal','Title','Heading 1','Heading 2','Heading 3']:
    s = styles[n]; s.font.name = 'Arial'; s._element.rPr.rFonts.set(qn('w:ascii'),'Arial'); s._element.rPr.rFonts.set(qn('w:hAnsi'),'Arial'); s.font.color.rgb = BLACK
styles['Normal'].font.size = Pt(11)
styles['Normal'].paragraph_format.space_after = Pt(6)
styles['Normal'].paragraph_format.line_spacing = 1.12
styles['Title'].font.size = Pt(25); styles['Title'].font.bold = True
title_ppr = styles['Title']._element.get_or_add_pPr()
title_border = title_ppr.find(qn('w:pBdr'))
if title_border is not None:
    title_ppr.remove(title_border)
styles['Heading 1'].font.size = Pt(16); styles['Heading 1'].font.bold = True
styles['Heading 1'].paragraph_format.space_before = Pt(7); styles['Heading 1'].paragraph_format.space_after = Pt(7)
styles['Heading 2'].font.size = Pt(12.5); styles['Heading 2'].font.bold = True
styles['Heading 2'].paragraph_format.space_before = Pt(6); styles['Heading 2'].paragraph_format.space_after = Pt(4)

header = section.header.paragraphs[0]
header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
set_run(header.add_run('DBMS MINI PROJECT REPORT'), 8, bold=True, color=GRAY)
footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_run(footer.add_run('Hotel Booking and Reservation Management System'), 8, color=GRAY)

def p(text='', style=None, align=None, bold_lead=None, italic=False):
    para = doc.add_paragraph(style=style)
    if align is not None: para.alignment = align
    if bold_lead and text.startswith(bold_lead):
        r = para.add_run(bold_lead); set_run(r, 11, bold=True)
        r = para.add_run(text[len(bold_lead):]); set_run(r, 11)
    else:
        r = para.add_run(text); set_run(r, 11, italic=italic)
    return para

def h(text, level=1):
    para = doc.add_paragraph(style=f'Heading {level}')
    r = para.add_run(text); set_run(r, 16 if level==1 else 12.5, bold=True)
    return para

def bullets(items):
    for item in items:
        para = doc.add_paragraph(style='List Bullet')
        para.paragraph_format.space_after = Pt(3)
        set_run(para.add_run(item), 10.7)

def code(text):
    para = doc.add_paragraph()
    para.paragraph_format.left_indent = Inches(.18)
    para.paragraph_format.space_before = Pt(2); para.paragraph_format.space_after = Pt(6)
    run = para.add_run(text); set_run(run, 8.5, font='Courier New')

def page_break(): doc.add_page_break()

# PAGE 1
doc.add_paragraph().paragraph_format.space_after = Pt(68)
title_p = doc.add_paragraph(style='Title'); title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_run(title_p.add_run('Hotel Booking and Reservation Management System'), 25, bold=True)
sub = doc.add_paragraph(); sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_run(sub.add_run('Database Management System Mini Project'), 14, color=GRAY)
doc.add_paragraph().paragraph_format.space_after = Pt(36)
meta = add_table(doc, ['PROJECT INFORMATION', 'DETAILS'], [
    ('Subject', 'Database Management System'), ('Project Topic', 'Hotel Booking and Reservation Management System'),
    ('Submitted by', '[Your Name]'), ('Roll Number', '[Your Roll Number]'), ('Class and Section', '[Your Class and Section]'),
    ('Faculty', 'Dr Ramakrishna Reddy K'), ('Academic Year', '2026 to 2027')], [2.1,4.7], 10)
p('Replace the bracketed details with your own information before submitting this report.', align=WD_ALIGN_PARAGRAPH.CENTER)
page_break()

# PAGE 2
h('Abstract')
p('The Hotel Booking and Reservation Management System is a MySQL based database application developed to organize hotel room, customer, reservation, and payment information. Manual registers can lead to duplicate room bookings, delayed search, and incomplete payment records. The proposed system centralizes the data and applies database constraints, stored procedures, triggers, views, indexes, and transactions to maintain accuracy.')
p('The system supports room availability search, reservation creation, payment tracking, status updates, audit logging, and revenue reporting. A lightweight web frontend communicates with a Node.js backend, which reads and writes the same MySQL database. The design follows Third Normal Form to reduce redundancy and improve data consistency.')
h('Keywords', 2)
p('MySQL, hotel management, reservation, database design, normalization, trigger, stored procedure, transaction, frontend backend integration.')
h('Report Structure', 2)
add_table(doc, ['SECTION', 'CONTENTS'], [
    ('1 to 3', 'Introduction, problem statement, objectives, scope, and requirements'),
    ('4 to 6', 'ER design, relational model, normalization, and constraints'),
    ('7 to 10', 'SQL implementation, queries, views, procedures, triggers, and indexes'),
    ('11 to 13', 'Web application integration, testing, validation, and result discussion'),
    ('14 to 15', 'Conclusion, future enhancements, references, and screenshot checklist')], [1.2,5.6])
page_break()

# PAGE 3
h('1 Introduction')
p('Hotel operations involve recurring activities such as registering guests, checking room availability, confirming bookings, recording payments, and preparing reports. When these activities are handled with paper registers or unrelated spreadsheets, staff can accidentally enter inconsistent information. The effect is most visible during busy periods, when a room might be promised to two guests for the same dates.')
h('1.1 Problem Statement', 2)
p('The hotel requires a reliable database system to store customer information, room inventory, reservations, payment records, and booking status. The system must show rooms that are available during a selected date range, avoid overlapping reservations, calculate the bill according to room type and number of nights, and produce understandable reports for hotel staff.')
h('1.2 Proposed Solution', 2)
p('The proposed solution is a relational database named hotel_booking_db. It separates master data such as customers, room types, and rooms from transactional data such as reservations and payments. A web interface provides an easy way to search and create bookings, while the database remains responsible for validation and business rules.')
h('1.3 Need for the System', 2)
bullets(['Reduces duplicate and incomplete data entries.', 'Allows staff to retrieve room and reservation information quickly.', 'Prevents double booking through automatic date-overlap validation.', 'Tracks the payment amount and remaining balance for each booking.', 'Keeps an audit trail when the reservation status changes.'])
page_break()

# PAGE 4
h('2 Objectives and Scope')
h('2.1 Objectives', 2)
bullets(['Maintain customer, room type, room, reservation, payment, and audit data in one database.', 'Search rooms based on check-in date, check-out date, and required guest capacity.', 'Create valid reservations and calculate the bill using room price and duration.', 'Prevent invalid dates, unavailable rooms, overlapping reservations, and overpayment.', 'Generate booking details, balance due, and revenue reports.', 'Demonstrate DDL, DML, DCL, views, joins, procedures, triggers, indexes, and transactions.'])
h('2.2 Scope', 2)
p('The project is intended for a small hotel. It includes the rooms available in the hotel, guest profiles, reservation lifecycle, and payment collection. The current version provides a local web dashboard and a local MySQL installation. Staff authentication, online payment gateway integration, and external notification services are not included in the present scope.')
h('2.3 Users', 2)
add_table(doc, ['USER', 'MAIN ACTIVITY'], [
    ('Hotel Staff', 'Search available rooms, create reservations, update reservation status, and record payments.'),
    ('Hotel Manager', 'Review booking details, balances, and revenue information through reports.'),
    ('Database Administrator', 'Maintain the database, users, permissions, backups, and performance indexes.')], [1.7,5.1])
page_break()

# PAGE 5
h('3 Requirements Analysis')
h('3.1 Functional Requirements', 2)
add_table(doc, ['ID', 'REQUIREMENT'], [
    ('FR1', 'The system shall store customer contact information.'), ('FR2', 'The system shall maintain room type, price, capacity, and room status.'),
    ('FR3', 'The system shall search rooms available for requested dates and guest count.'), ('FR4', 'The system shall create a reservation with a calculated total amount.'),
    ('FR5', 'The system shall record payments and show the balance due.'), ('FR6', 'The system shall prevent overlapping active reservations.'),
    ('FR7', 'The system shall record reservation status changes in an audit log.'), ('FR8', 'The system shall provide reservation and revenue reports.')], [.7,6.1])
h('3.2 Non Functional Requirements', 2)
add_table(doc, ['AREA', 'REQUIREMENT'], [
    ('Integrity', 'Keys, constraints, triggers, and transactions must preserve valid data.'),
    ('Performance', 'Indexes must support common searches by room, dates, customer, and payment.'),
    ('Usability', 'The web interface should be simple enough for staff to use during booking.'),
    ('Maintainability', 'Tables and SQL code should have clear names and be normalized to 3NF.'),
    ('Security', 'The database can use restricted staff permissions through GRANT and REVOKE.')], [1.45,5.35])
page_break()

# PAGE 6
h('4 Entity Relationship Design')
p('The database has six main entities. Customer, Room Type, and Room are master entities. Reservation and Payment record daily hotel operations. Reservation Status Log records changes for audit purposes.')
p('Table 4.1. Entity Summary', italic=True)
add_table(doc, ['ENTITY', 'PURPOSE'], [
    ('Customer', 'Stores guest contact details.'),
    ('Room Type', 'Stores room category, price, and capacity.'),
    ('Room', 'Stores the physical hotel rooms.'),
    ('Reservation', 'Stores each customer booking.'),
    ('Payment', 'Stores payment details for a booking.'),
    ('Reservation Status Log', 'Stores each reservation status change.')], [1.75,5.05], 8.2)
h('4.1 Relationships', 2)
p('Table 4.2. Relationship Summary', italic=True)
add_table(doc, ['RELATIONSHIP', 'CARDINALITY', 'MEANING'], [
    ('Customer — Reservation', '1 : M', 'One customer can make many reservations.'),
    ('Room Type — Room', '1 : M', 'One type classifies many physical rooms.'),
    ('Room — Reservation', '1 : M', 'One room occurs in many bookings over time.'),
    ('Reservation — Payment', '1 : M', 'One booking can receive multiple payments.'),
    ('Reservation — Status Log', '1 : M', 'One booking creates multiple audit entries.')], [2.15,1.05,3.6], 7.4)
er_para = doc.add_paragraph(); er_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
er_para.add_run().add_picture(ER_IMAGE, width=Inches(2.75))
p('Figure 1. Entity Relationship Diagram for the Hotel Booking and Reservation Management System.', align=WD_ALIGN_PARAGRAPH.CENTER, italic=True)
page_break()

# PAGE 7
h('5 Schema Design Relational Model')
p('The ER model is converted into the following relational schema. PK indicates a primary key, FK indicates a foreign key, and UK indicates a unique key.')
code('CUSTOMER(customer_id PK, first_name, last_name, phone UK, email UK, address, created_at)')
code('ROOM_TYPE(room_type_id PK, type_name UK, base_price, capacity, description)')
code('ROOM(room_id PK, room_number UK, room_type_id FK, floor_no, room_status)')
code('RESERVATION(reservation_id PK, customer_id FK, room_id FK, check_in_date, check_out_date,')
code('            adults, children, reservation_status, booking_date, total_amount, remarks)')
code('PAYMENT(payment_id PK, reservation_id FK, payment_date, amount, payment_method,')
code('        payment_status, transaction_reference UK)')
code('RESERVATION_STATUS_LOG(log_id PK, reservation_id FK, old_status, new_status, changed_at, changed_by)')
h('5.1 Key Constraints', 2)
add_table(doc, ['TABLE', 'CONSTRAINT', 'PURPOSE'], [
    ('Customer', 'phone and email unique', 'Avoids duplicate guest contact records.'),
    ('Room', 'room_number unique; room_type_id FK', 'Every physical room has one valid type.'),
    ('Reservation', 'customer_id FK; room_id FK; date check', 'Links booking data and ensures check-out is later than check-in.'),
    ('Payment', 'reservation_id FK; positive amount; unique reference', 'Links payment to a valid booking and prevents duplicate reference numbers.'),
    ('Audit Log', 'reservation_id FK', 'Every audit record belongs to a valid reservation.')], [1.25,2.0,3.55])
page_break()

# PAGE 8
h('6 Normalization')
h('6.1 First Normal Form')
p('Each table has a primary key, each column stores one atomic value, and repeating groups are removed. For example, separate payment rows are used instead of storing multiple payment values inside a reservation row.')
h('6.2 Second Normal Form')
p('Every non key attribute depends on the complete primary key. The tables use single-column primary keys, so attributes such as a customer phone number or a room floor depend only on their own table identifier.')
h('6.3 Third Normal Form')
p('Transitive dependencies are removed. Price and capacity depend on room type, so they are stored in ROOM_TYPE instead of ROOM or RESERVATION. Customer contact details are stored in CUSTOMER instead of RESERVATION. Payment details are stored in PAYMENT instead of RESERVATION.')
add_table(doc, ['POSSIBLE REDUNDANCY', 'NORMALIZED SOLUTION', 'BENEFIT'], [
    ('Customer phone repeated for every booking', 'Store phone only in CUSTOMER.', 'One update changes the value for all future reports.'),
    ('Room type price repeated for every physical room', 'Store base price in ROOM_TYPE.', 'Prevents inconsistent pricing records.'),
    ('Several payments in one reservation column', 'Store one row per PAYMENT.', 'Supports instalments and proper totals.'),
    ('Status changes overwrite past status', 'Store change history in RESERVATION_STATUS_LOG.', 'Creates a reviewable audit trail.')], [2.25,2.25,2.3])
h('6.4 Result')
p('The schema is in 3NF because non-key attributes depend on the key, the whole key, and nothing but the key. This reduces insert, update, and delete anomalies.')
page_break()

# PAGE 9
h('7 SQL Implementation')
h('7.1 Data Definition Language')
p('The MySQL script first creates hotel_booking_db and then creates six related tables. The following example shows the main structure of the ROOM table.')
code('CREATE TABLE room (')
code('  room_id INT AUTO_INCREMENT PRIMARY KEY,')
code('  room_number VARCHAR(10) NOT NULL UNIQUE,')
code('  room_type_id INT NOT NULL, floor_no INT NOT NULL,')
code("  room_status ENUM('Available','Maintenance','Inactive') NOT NULL DEFAULT 'Available',")
code('  CONSTRAINT fk_room_type FOREIGN KEY (room_type_id) REFERENCES room_type(room_type_id)'); code(');')
h('7.2 Data Manipulation Language', 2)
p('Sample room types, rooms, customers, reservations, and payments are inserted so that reports and procedures can be tested using realistic data.')
code("INSERT INTO room_type(type_name, base_price, capacity) VALUES ('Standard',2500,2), ('Deluxe',4000,3), ('Suite',6500,4);")
h('7.3 Constraints Used', 2)
bullets(['NOT NULL makes important fields compulsory.', 'UNIQUE is used for phone, email, room number, and transaction reference.', 'CHECK ensures positive amounts/capacities and valid stay dates.', 'FOREIGN KEY ensures that child records refer to an existing parent record.'])
page_break()

# PAGE 10
h('8 Queries Views and Indexes')
h('8.1 View for Reservation Details', 2)
p('vw_reservation_details combines customer, room, room type, reservation, and payment records. It shows the total bill, amount paid, and remaining balance in one result.')
code('SELECT * FROM vw_reservation_details;')
add_table(doc, ['RESERVATION', 'CUSTOMER', 'ROOM', 'STATUS', 'TOTAL', 'BALANCE'], [
    ('1', 'Aarav Sharma', '101', 'Checked Out', '7500', '0'),
    ('2', 'Diya Reddy', '201', 'Confirmed', '12000', '7000'),
    ('3', 'Kabir Khan', '202', 'Pending', '8000', '8000')], [.85,1.55,.65,1.25,.9,.9])
h('8.2 Revenue Query', 2)
code('SELECT rt.type_name, COUNT(res.reservation_id) AS bookings, SUM(res.total_amount) AS revenue')
code('FROM room_type rt JOIN room r ON r.room_type_id = rt.room_type_id')
code('LEFT JOIN reservation res ON res.room_id = r.room_id GROUP BY rt.type_name;')
h('8.3 Indexes', 2)
p('Indexes idx_reservation_room_dates, idx_reservation_customer, idx_payment_reservation, and idx_room_type_status support the most common searches. In particular, the room and date index supports overlap checks and availability search.')
p('Figure 2. Paste a MySQL Workbench screenshot of vw_reservation_details or the revenue query result below this paragraph before final submission.', italic=True)
page_break()

# PAGE 11
h('9 Stored Procedures Triggers and Transactions')
h('9.1 Stored Procedures', 2)
add_table(doc, ['PROCEDURE', 'PURPOSE'], [
    ('sp_check_room_availability', 'Lists available rooms for a supplied check-in date, check-out date, and number of guests.'),
    ('sp_create_reservation', 'Locks the selected room, validates dates, calculates price times nights, inserts a confirmed reservation, and commits the transaction.')], [2.25,4.45])
code("CALL sp_check_room_availability('2026-11-05','2026-11-08',2);")
h('9.2 Triggers', 2)
add_table(doc, ['TRIGGER', 'WHEN IT RUNS', 'RESULT'], [
    ('trg_reservation_before_insert', 'Before new booking', 'Rejects invalid dates, unavailable rooms, and overlapping active reservations.'),
    ('trg_reservation_before_update', 'Before reservation update', 'Stops an update that would create an overlap.'),
    ('trg_reservation_status_audit', 'After status update', 'Adds an old/new status record to the audit table.'),
    ('trg_payment_before_insert', 'Before payment', 'Rejects payments that would exceed the booking total.')], [2.05,1.4,3.25])
h('9.3 Transaction Management', 2)
p('The reservation procedure uses START TRANSACTION, SELECT FOR UPDATE, COMMIT, and an exception handler with ROLLBACK. The lock reduces the chance that two staff users select the same room at the same time. If any validation fails, the transaction is rolled back so no partial reservation is saved.')
page_break()

# PAGE 12
h('10 Frontend and Backend Integration')
p('The project includes a simple web frontend for hotel staff. The frontend calls REST API endpoints in a Node.js Express backend. The backend uses mysql2 to connect to hotel_booking_db. Therefore, actions in the dashboard modify the same MySQL records that are visible in MySQL Workbench.')
add_table(doc, ['LAYER', 'TECHNOLOGY', 'RESPONSIBILITY'], [
    ('Frontend', 'HTML CSS JavaScript', 'Displays dashboard, room availability form, reservation form, and status controls.'),
    ('Backend', 'Node.js Express', 'Validates requests, exposes API endpoints, and calls MySQL queries/procedures.'),
    ('Database', 'MySQL 8', 'Stores data and enforces constraints, triggers, transactions, and reports.')], [1.15,1.7,3.85])
h('10.1 Data Flow', 2)
code('User action -> Frontend fetch request -> Express API -> MySQL query or procedure -> JSON result -> Dashboard refresh')
h('10.2 Main API Operations', 2)
add_table(doc, ['API ENDPOINT', 'ACTION'], [
    ('GET /api/dashboard', 'Returns the dashboard metrics, recent reservations, and rooms.'),
    ('GET /api/availability', 'Calls the availability procedure for selected dates and guests.'),
    ('POST /api/reservations', 'Calls sp_create_reservation and saves the booking.'),
    ('PATCH /api/reservations/id/status', 'Updates booking status and triggers the audit record.'),
    ('POST /api/payments', 'Stores a payment after the database checks remaining balance.')], [2.55,4.15])
p('Figure 3. Paste a screenshot of the Staywise hotel dashboard and the Create Reservation dialog below this paragraph before submission.', italic=True)
page_break()

# PAGE 13
h('11 Testing and Validation')
p('Testing was performed with sample data and expected database rules. Each test confirms a functional requirement or data-integrity requirement.')
add_table(doc, ['TEST ID', 'TEST CASE', 'EXPECTED RESULT', 'STATUS'], [
    ('T1', 'Search rooms for valid dates', 'Only rooms without an overlapping active booking are displayed.', 'Pass'),
    ('T2', 'Create valid reservation', 'Reservation saved; total equals price multiplied by nights.', 'Pass'),
    ('T3', 'Insert overlapping reservation', 'Trigger rejects insert with double-booking error.', 'Pass'),
    ('T4', 'Enter checkout before check-in', 'Check constraint/trigger rejects invalid dates.', 'Pass'),
    ('T5', 'Record payment within balance', 'Payment saved and view shows reduced balance.', 'Pass'),
    ('T6', 'Record payment above total bill', 'Payment trigger rejects excess amount.', 'Pass'),
    ('T7', 'Update reservation status', 'Audit log receives old status and new status.', 'Pass'),
    ('T8', 'Rollback test payment', 'Uncommitted test payment is not retained.', 'Pass')], [.65,1.65,3.45,.65], 8.3)
h('11.1 Validation Summary', 2)
p('The test results confirm that the system supports the planned booking workflow. The critical data-integrity rule is double-booking prevention. It is handled both in the availability procedure and in database triggers, so a booking is protected even if it is inserted outside the web interface.')
p('Figure 4. Paste a screenshot of the overlap error message and a screenshot of the reservation status log here before submission.', italic=True)
page_break()

# PAGE 14
h('12 Results Discussion')
p('The implemented database successfully separates master data from transactional data. The dashboard displays five available rooms and current reservation data from MySQL. A successful reservation created from the frontend appears in the reservation view, showing that frontend and backend are connected.')
h('12.1 Important Outputs', 2)
add_table(doc, ['OUTPUT', 'INTERPRETATION'], [
    ('Availability result', 'Displays rooms that meet capacity requirement and have no booking overlap for selected dates.'),
    ('Reservation detail view', 'Shows customer, room, dates, nights, status, bill amount, paid amount, and balance due.'),
    ('Revenue view', 'Summarizes booked revenue and booking count for each room.'),
    ('Trigger error', 'Prevents an overlapping booking or an amount exceeding the bill.'),
    ('Audit log', 'Records changes made to a reservation status.')], [2.0,4.7])
h('12.2 Limitations', 2)
bullets(['The application currently runs on a local computer and requires MySQL service to be running.', 'A production system would need user login, password security, backup policy, and role-based access.', 'Room price is taken from the current room type; seasonal rates and discounts are not implemented.', 'Payment gateway, invoice printing, SMS, and email confirmation are proposed future features.'])
h('12.3 Conclusion', 2)
p('The Hotel Booking and Reservation Management System meets the main project objectives. It demonstrates relational design, SQL implementation, integrity constraints, query reporting, procedures, triggers, indexing, transactions, testing, and a working frontend-backend connection.')
page_break()

# PAGE 15
h('13 Future Enhancements')
bullets(['Add staff accounts with receptionist, manager, and administrator roles.', 'Add secure password hashing and role-based access control.', 'Add online payment gateway integration and invoice generation.', 'Support cancellation, refund, seasonal pricing, discount coupons, and late checkout charges.', 'Add email and SMS booking confirmation.', 'Deploy the web application on a server with a managed database and regular backups.', 'Add dashboard charts for occupancy rate, room-wise revenue, and customer history.'])
h('References', 1)
p('1. Course Handout, Database Management System, ICFAI Foundation for Higher Education, Academic Year 2026 to 2027.')
p('2. Ramakrishnan, R. and Gehrke, J. Database Management Systems, Third Edition.')
p('3. Silberschatz, A., Korth, H. F., and Sudarshan, S. Database System Concepts, Seventh Edition.')
p('4. MySQL 8 Reference Manual. Oracle.')
h('Before You Submit', 2)
add_table(doc, ['CHECK', 'ACTION'], [
    ('Personal details', 'Replace name, roll number, class, and section on the cover page.'),
    ('ER diagram', 'Insert your draw.io ER diagram in Figure 1 position.'),
    ('Screenshots', 'Insert MySQL Workbench and frontend screenshots in the marked Figure 2, 3, and 4 positions.'),
    ('Formatting', 'Check the final page count remains at or below 15 after you insert screenshots.'),
    ('Demo', 'Run MySQL first, then run the frontend, and keep the SQL file open in Workbench.')], [1.5,5.2])
p('End of Report', align=WD_ALIGN_PARAGRAPH.CENTER)

doc.save(OUT)
print(OUT)
