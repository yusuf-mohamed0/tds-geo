#!/usr/bin/env python3
"""
Traffic Digital Solutions — Odoo Implementation Quotation
Professional Services Agreement Template
v2.0 — Legal Review Pass Complete
"""

from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml
import os

# ─── Brand Colors ──────────────────────────────────────
BLACK = RGBColor(0x17, 0x14, 0x14)
GOLD = RGBColor(0xFC, 0xB9, 0x00)
NAVY = RGBColor(0x14, 0x24, 0x44)
GRAY = RGBColor(0x83, 0x80, 0x81)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
DARK_GRAY = RGBColor(0x3D, 0x3B, 0x3B)

OUTPUT_PATH = "/root/tds-geo/doc/quotation/TDS-GEO-Quotation.docx"


def set_shading(cell, hex_color):
    cell._tc.get_or_add_tcPr().append(
        parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    )


def no_borders(table):
    pr = table._tbl.tblPr
    if pr is None:
        pr = parse_xml(f'<w:tblPr {nsdecls("w")}/>')
        table._tbl.insert(0, pr)
    pr.append(parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'</w:tblBorders>'
    ))


def rule(doc, color="FCB900", sz=12):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    pr = p._p.get_or_add_pPr()
    pr.append(parse_xml(
        f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="{sz}" w:space="1" w:color="{color}"/></w:pBdr>'
    ))


def heading(doc, number, title):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(f"{number}.  {title}")
    r.bold = True
    r.font.size = Pt(13)
    r.font.color.rgb = NAVY
    r.font.name = 'Calibri Light'
    rule(doc, "FCB900", 8)
    return p


def body(doc, text, size=10, color=DARK_GRAY, bold=False, italic=False, after=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.15
    r = p.add_run(text)
    r.font.size = Pt(size)
    r.font.color.rgb = color
    r.bold = bold
    r.italic = italic
    return p


def bullet(doc, text, indent=0.5):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.left_indent = Cm(indent)
    r = p.add_run(f"  \u2022  {text}")
    r.font.size = Pt(9.5)
    r.font.color.rgb = DARK_GRAY
    return p


def create_document():
    doc = Document()

    for s in doc.sections:
        s.page_width = Cm(21.0)
        s.page_height = Cm(29.7)
        s.top_margin = Cm(2.0)
        s.bottom_margin = Cm(1.5)
        s.left_margin = Cm(2.5)
        s.right_margin = Cm(2.5)

    style = doc.styles['Normal']
    style.font.name = 'Calibri'
    style.font.size = Pt(10.5)
    style.font.color.rgb = DARK_GRAY
    style.paragraph_format.space_after = Pt(6)
    style.paragraph_format.line_spacing = 1.15

    # ═══════════════════════════════════════════════════
    #  HEADER
    # ═══════════════════════════════════════════════════
    hdr = doc.add_table(rows=1, cols=2)
    no_borders(hdr)

    c0 = hdr.cell(0, 0); c0.width = Cm(4.5)
    lp = c0.paragraphs[0]; lp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = lp.add_run("Traffic Digital Solutions")
    r.bold = True; r.font.size = Pt(18); r.font.color.rgb = BLACK

    c1 = hdr.cell(0, 1); c1.width = Cm(11.5)
    p = c1.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p.add_run("Odoo Gold Implementation Partner\n"); r.font.size = Pt(9); r.font.color.rgb = GRAY
    r = p.add_run("Villa 125, Axis 80, 5th Settlement, Cairo, Egypt\n"); r.font.size = Pt(8); r.font.color.rgb = GRAY
    r = p.add_run("webdevelopment@trafficdigitalsolutions.com  |  trafficdigitalsolutions.com"); r.font.size = Pt(8); r.font.color.rgb = GRAY

    rule(doc, "FCB900", 20)

    # ═══════════════════════════════════════════════════
    #  TITLE
    # ═══════════════════════════════════════════════════
    ti = doc.add_paragraph()
    ti.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ti.paragraph_format.space_before = Pt(18)
    ti.paragraph_format.space_after = Pt(2)
    r = ti.add_run("ODOO IMPLEMENTATION QUOTATION")
    r.bold = True; r.font.size = Pt(26); r.font.color.rgb = BLACK; r.font.name = 'Calibri Light'

    q = doc.add_paragraph()
    q.alignment = WD_ALIGN_PARAGRAPH.CENTER
    q.paragraph_format.space_after = Pt(6)
    r = q.add_run("Quotation No: {NUMBER}     |     Issued: {ISSUE_DATE}     |     Valid Until: {VALID_UNTIL}")
    r.font.size = Pt(9); r.font.color.rgb = GRAY

    rule(doc, "FCB900", 12)

    # ═══════════════════════════════════════════════════
    #  INFO TABLE
    # ═══════════════════════════════════════════════════
    info = doc.add_table(rows=2, cols=2); no_borders(info)

    cells = [
        (0, 0, "PREPARED FOR", ["{CLIENT_NAME}", "{CLIENT_ADDRESS}", "{CLIENT_EMAIL}", "{CLIENT_PHONE}"]),
        (0, 1, "PROJECT DETAILS", ["Project: {PROJECT_NAME}", "Odoo Edition: {ODOO_EDITION}", "Users: {USER_COUNT}", "Proposed Start: {START_DATE}", "Duration: {DURATION}"]),
        (1, 0, "PAYMENT & CURRENCY", ["Currency: {CURRENCY}", "Payment Terms: {PAYMENT_TERMS}", "Tax Treatment: {TAX_TREATMENT}"]),
        (1, 1, "DELIVERY METHOD", ["Format: Cloud / On-Premise", "Location: On-site / Remote", "Handover: {HANDOVER_METHOD}"]),
    ]
    for ri, ci, label, lines in cells:
        cell = info.cell(ri, ci)
        p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(2)
        r = p.add_run(label); r.bold = True; r.font.size = Pt(7.5); r.font.color.rgb = GOLD
        for l in lines:
            lp = cell.add_paragraph(); lp.paragraph_format.space_after = Pt(1)
            r = lp.add_run(l); r.font.size = Pt(10); r.font.color.rgb = BLACK

    rule(doc, "FCB900", 10)

    # ═══════════════════════════════════════════════════
    #  1. EXECUTIVE SUMMARY
    # ═══════════════════════════════════════════════════
    heading(doc, 1, "EXECUTIVE SUMMARY")
    body(doc, "{EXECUTIVE_SUMMARY}")

    # ═══════════════════════════════════════════════════
    #  2. WHY TRAFFIC DIGITAL SOLUTIONS
    # ═══════════════════════════════════════════════════
    heading(doc, 2, "WHY TRAFFIC DIGITAL SOLUTIONS")

    body(doc, (
        "Traffic Digital Solutions is a full-service digital agency founded in 2019 with over 100 successful projects delivered. "
        "We combine deep technical expertise in Odoo ERP with a proven track record across web development, branding, and digital marketing. "
        "Our team has delivered Odoo implementations for enterprises across Egypt, the UAE, and internationally, serving industries "
        "including retail, healthcare, manufacturing, and professional services."
    ))

    body(doc, "Why leading organizations choose us:")
    for reason in [
        "Proven Odoo expertise — Certified Odoo development team with end-to-end implementation experience",
        "100+ satisfied clients — From startups to large enterprises across multiple industries",
        "Full-service capability — Beyond Odoo: web, branding, marketing, and content under one roof",
        "Data-driven methodology — Structured implementation with clear milestones, testing, and sign-off at every phase",
        "Post-go-live commitment — Multi-tier support options to keep your business running smoothly",
        "Located in Cairo — On-site visits and face-to-face meetings available when needed",
    ]:
        bullet(doc, reason)

    # ═══════════════════════════════════════════════════
    #  3. SCOPE OF WORK
    # ═══════════════════════════════════════════════════
    heading(doc, 3, "SCOPE OF WORK — ODOO MODULES & SERVICES")
    body(doc, "We will implement, configure, and deploy the following Odoo modules and services for your organization:")

    modules = [
        "Odoo Installation & Server Configuration (Cloud / On-Premise)",
        "Sales & CRM — Pipeline management, lead tracking, quotation templates, invoicing workflow",
        "Accounting & Finance — Chart of accounts, tax rules, multi-currency, financial reports, bank reconciliation",
        "Inventory & Warehouse Management — Stock locations, transfers, valuation methods, reordering rules",
        "Purchasing & Vendor Management — Purchase orders, vendor pricing, approval workflows",
        "Human Resources — Employee records, contracts, leave management, payroll configuration",
        "Manufacturing / Bill of Materials — BOM structure, work orders, routing (if applicable)",
        "Website & E-commerce — Storefront setup, theme customization, product pages, checkout flow",
        "Email Marketing — Campaign creation, subscriber management, performance analytics",
        "Project Management — Project planning, task assignment, timesheets, profitability analysis",
    ]

    for mod in modules:
        bullet(doc, mod)

    doc.add_paragraph()
    body(doc, "Included Professional Services:")

    extras = [
        ("System Architecture & Configuration",
         "Complete Odoo Online or On-Premise setup including user roles, security groups, email server integration, "
         "localized settings (Egyptian / UAE / regional), and third-party API connections as required."),
        ("Data Migration & Cleansing",
         "Secure extraction, validation, cleansing, and import of master data from your existing system. "
         "Includes customers, vendors, products, price lists, chart of accounts, open receivables/payables, "
         "and inventory balances. Full reconciliation post-migration."),
        ("Custom Development",
         "Custom fields, views, reports, automated actions, server actions, and workflow modifications "
         "as documented in the agreed requirements specification. Any custom module development required "
         "to support unique business processes."),
        ("User Training & Knowledge Transfer",
         "Up to {TRAINING_SESSIONS} structured group training sessions covering all deployed modules. "
         "Training includes live system walkthroughs, documented user guides, and recorded sessions for future reference."),
        ("Testing & Quality Assurance",
         "Module integration testing, user acceptance testing (UAT) coordination, issue tracking, "
         "and resolution of all critical and high-priority defects before go-live."),
        ("Go-Live & Hypercare Support",
         "Production deployment with dedicated support for {GO_LIVE_SUPPORT_DAYS} business days post-go-live. "
         "Includes real-time issue resolution, performance monitoring, and stabilization."),
    ]

    for label, desc in extras:
        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(6)
        sp.paragraph_format.space_after = Pt(2)
        r = sp.add_run(f"  {label}"); r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        body(doc, desc, size=9.5, after=4)

    # ═══════════════════════════════════════════════════
    #  4. EXCLUSIONS
    # ═══════════════════════════════════════════════════
    heading(doc, 4, "EXCLUSIONS")
    body(doc, "The following are explicitly excluded from this quotation unless separately agreed in writing:")
    for ex in [
        "Odoo Online subscription fees or Odoo Enterprise license costs (paid directly to Odoo S.A. by you)",
        "Third-party Odoo apps or modules purchased from the Odoo App Store",
        "Website content creation (copywriting, photography, videography)",
        "Custom mobile or tablet application development",
        "Ongoing support and maintenance beyond the 30-day warranty period (separate support plans available — see Section 7)",
        "Hardware, server infrastructure, or IT equipment procurement",
        "Graphic design, brand identity, or logo creation beyond Odoo website theme configuration",
        "Integration with systems not explicitly listed in this quotation",
    ]:
        bullet(doc, ex)

    # ═══════════════════════════════════════════════════
    #  5. IMPLEMENTATION METHODOLOGY & TIMELINE
    # ═══════════════════════════════════════════════════
    heading(doc, 5, "IMPLEMENTATION METHODOLOGY & TIMELINE")

    phases = [
        ("Phase 1 — Discovery & Requirements", "Week 1",
         "Business process workshops, requirements documentation, module selection finalization, "
         "and project plan with milestone dates."),
        ("Phase 2 — System Configuration", "Weeks 2-3",
         "Server setup, Odoo installation/activation, module configuration, chart of accounts, "
         "tax rules, email configuration, and user role setup."),
        ("Phase 3 — Data Migration", "Weeks 3-4",
         "Data extraction, cleansing, transformation, and import into Odoo. "
         "Full reconciliation with your team before proceeding."),
        ("Phase 4 — Customization & Development", "Weeks 4-6",
         "Development of custom fields, views, reports, workflows, and modules. "
         "Iterative review and feedback cycles with your project team."),
        ("Phase 5 — Testing & Training", "Weeks 6-7",
         "Integration testing, UAT, defect resolution, and user training sessions. "
         "Your acceptance sign-off is required to proceed to go-live."),
        ("Phase 6 — Go-Live & Hypercare", "Week 8",
         "Production deployment, data verification, go-live support, and {GO_LIVE_SUPPORT_DAYS}-day hypercare period."),
    ]

    for phase, dur, desc in phases:
        mp = doc.add_paragraph()
        mp.paragraph_format.space_before = Pt(6)
        mp.paragraph_format.space_after = Pt(2)
        r = mp.add_run(f"  {phase}"); r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        r2 = mp.add_run(f"  —  {dur}"); r2.font.size = Pt(9); r2.font.color.rgb = GOLD; r2.bold = True
        body(doc, desc, size=9.5, after=4)

    body(doc, (
        "Total estimated duration: {DURATION} from project kickoff meeting. "
        "Timeline assumes timely delivery of client inputs, data, and approvals. "
        "Any delays in client responsibilities may extend the timeline, which will be communicated promptly."
    ), size=9.5, italic=True)

    # ═══════════════════════════════════════════════════
    #  6. CLIENT RESPONSIBILITIES
    # ═══════════════════════════════════════════════════
    heading(doc, 6, "CLIENT RESPONSIBILITIES")
    body(doc, "To ensure successful and timely delivery, the Client agrees to:")
    for rsp in [
        "Appoint a dedicated project manager and key stakeholders from each affected department",
        "Provide timely access to existing data, business documents, templates, and process documentation",
        "Make configuration and customization decisions within agreed timelines",
        "Provide test users and actively participate in user acceptance testing",
        "Ensure stakeholder availability for scheduled training sessions",
        "Provide Odoo Online / Enterprise license credentials and administrative access as needed",
        "Review deliverables and approve milestones within 3 business days of submission",
        "Communicate any changes in requirements or priorities in writing through the designated project manager",
    ]:
        bullet(doc, rsp)

    # ═══════════════════════════════════════════════════
    #  7. INVESTMENT & PRICING
    # ═══════════════════════════════════════════════════
    heading(doc, 7, "INVESTMENT & PRICING")

    items = [
        ("#", "SERVICE / DELIVERABLE", "QTY", "UNIT PRICE", "TOTAL"),
        ("1", "Odoo Installation & Server Setup", "1", "{SETUP_PRICE}", "{SETUP_TOTAL}"),
        ("2", "Core Module Configuration ({NUM_MODULES} modules)", "{MODULE_QTY}", "{MODULE_UNIT_PRICE}", "{MODULE_TOTAL}"),
        ("3", "Data Migration & Cleansing", "{MIG_HOURS} hrs", "{MIG_RATE}/hr", "{MIG_TOTAL}"),
        ("4", "Custom Development & Configuration", "{DEV_HOURS} hrs", "{DEV_RATE}/hr", "{DEV_TOTAL}"),
        ("5", "User Training ({TRAINING_SESSIONS} sessions)", "{TRAINING_QTY}", "{TRAINING_UNIT_PRICE}", "{TRAINING_TOTAL}"),
        ("6", "Project Management & Coordination", "{PM_HOURS} hrs", "{PM_RATE}/hr", "{PM_TOTAL}"),
    ]

    tbl = doc.add_table(rows=len(items), cols=5)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, w in enumerate([Cm(1.0), Cm(8.5), Cm(2.0), Cm(3.0), Cm(3.5)]):
        for row in tbl.rows:
            row.cells[i].width = w

    for ri, row_data in enumerate(items):
        for ci, text in enumerate(row_data):
            cell = tbl.cell(ri, ci)
            p = cell.paragraphs[0]
            if ri == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER if ci != 1 else WD_ALIGN_PARAGRAPH.LEFT
                set_shading(cell, "171414")
                r = p.add_run(text); r.bold = True; r.font.size = Pt(8); r.font.color.rgb = WHITE
            else:
                align = WD_ALIGN_PARAGRAPH.CENTER if ci == 0 else (WD_ALIGN_PARAGRAPH.LEFT if ci == 1 else WD_ALIGN_PARAGRAPH.RIGHT)
                p.alignment = align
                r = p.add_run(text); r.font.size = Pt(8.5); r.font.color.rgb = DARK_GRAY if ci != 4 else BLACK
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)

    for label, val in [("Subtotal", "{SUBTOTAL}"), ("Discount ({DISCOUNT_PCT}%)", "({DISCOUNT_AMOUNT})")]:
        tr = tbl.add_row()
        for ci in range(5):
            cell = tr.cells[ci]; p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2); p.paragraph_format.space_after = Pt(2)
            if ci < 3:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                if ci == 2:
                    r = p.add_run(label); r.bold = True; r.font.size = Pt(9); r.font.color.rgb = NAVY
            elif ci == 4:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                r = p.add_run(val); r.font.size = Pt(9); r.font.color.rgb = GRAY

    tr = tbl.add_row()
    for ci in range(5):
        cell = tr.cells[ci]; p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(6); p.paragraph_format.space_after = Pt(4)
        if ci < 3:
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            if ci == 2:
                set_shading(cell, "171414")
                r = p.add_run("TOTAL DUE"); r.bold = True; r.font.size = Pt(10); r.font.color.rgb = WHITE
        elif ci == 4:
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT; set_shading(cell, "FCB900")
            r = p.add_run("{GRAND_TOTAL}"); r.bold = True; r.font.size = Pt(13); r.font.color.rgb = BLACK
        elif ci == 3:
            r = p.add_run("{CURRENCY}"); r.font.size = Pt(9); r.font.color.rgb = GRAY

    doc.add_paragraph()

    # ── Post-Implementation Support ──
    support_heading = doc.add_paragraph()
    support_heading.paragraph_format.space_after = Pt(4)
    r = support_heading.add_run("Post-Implementation Support Plans (Optional)")
    r.bold = True; r.font.size = Pt(11); r.font.color.rgb = NAVY; r.font.name = 'Calibri Light'

    body(doc, "After the 30-day warranty period, the following support plans are available:", size=9.5, after=4)

    for label, desc in [
        ("Bronze — Basic", "{BRONZE_PRICE}/month — Email-only support, bug fixes, 48-hour response time, quarterly system health check."),
        ("Silver — Standard", "{SILVER_PRICE}/month — Email + phone support, bug fixes, minor configuration changes, 24-hour response, monthly health check."),
        ("Gold — Premium (Recommended)", "{GOLD_PRICE}/month — Dedicated account manager, priority phone + email, 8-hour response, unlimited minor changes, quarterly business review, discounted rate on major changes."),
    ]:
        sp = doc.add_paragraph()
        sp.paragraph_format.space_after = Pt(2)
        sp.paragraph_format.left_indent = Cm(0.5)
        r = sp.add_run(f"  {label}:  "); r.bold = True; r.font.size = Pt(9.5); r.font.color.rgb = NAVY
        r2 = sp.add_run(desc); r2.font.size = Pt(9.5); r2.font.color.rgb = DARK_GRAY

    body(doc, "VAT (14%) will be added where applicable. All prices in {CURRENCY} unless otherwise stated.", size=8, color=GRAY, italic=True)

    # ═══════════════════════════════════════════════════
    #  8. PAYMENT SCHEDULE
    # ═══════════════════════════════════════════════════
    heading(doc, 8, "PAYMENT SCHEDULE")

    options = [
        ("Milestone-Based (Recommended)",
         "30% upon signing  |  30% upon UAT sign-off  |  30% upon successful go-live  |  10% upon 30-day post-go-live review"),
        ("50/50 Split", "50% upon signing, 50% upon successful go-live."),
        ("Monthly Installments", "Equal monthly payments over the implementation period."),
        ("Net 30", "Full payment within 30 days of final invoice."),
        ("Full Upfront — 5% Discount", "Full payment upon signing. A 5% discount applies to the total project value."),
    ]
    for label, desc in options:
        pp = doc.add_paragraph()
        pp.paragraph_format.space_after = Pt(2)
        r = pp.add_run(f"  {label}"); r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        body(doc, desc, size=9.5, after=4)

    body(doc, "Selected Payment Terms: {SELECTED_PAYMENT_TERMS}", size=10, bold=True, color=BLACK)

    # ═══════════════════════════════════════════════════
    #  9. TERMS & CONDITIONS (Lawyer-Reviewed)
    # ═══════════════════════════════════════════════════
    heading(doc, 9, "TERMS & CONDITIONS")

    terms = [
        ("1. Scope of Work",
         "The scope of work is defined exclusively in Section 3 of this Quotation. Any services, deliverables, or modifications "
         "not expressly listed are excluded unless subsequently agreed in a written change order signed by both parties. "
         "Additional work will be billed at {ADDITIONAL_WORK_RATE}/hour."),
        ("2. Fees & Payment",
         "All fees are in the currency stated on page 1. Invoices are due per the selected payment schedule. "
         "If payment is not received within 15 calendar days of the due date, we reserve the right to suspend all work "
         "until payment is received. Overdue amounts accrue interest at 2% per month (24% per annum). "
         "You may not withhold, offset, or deduct any amounts without our prior written consent."),
        ("3. Change Orders",
         "Any request to modify the scope, timeline, or deliverables must be submitted in writing. "
         "We will assess the impact on cost and timeline and provide a change order for your approval. "
         "Work on any change begins only after both parties sign the change order. "
         "Changes requested orally or via informal channels are not binding."),
        ("4. Intellectual Property",
         "4.1 Custom Developments: Upon full payment of all amounts due, you own all custom-developed code, "
         "configurations, reports, and workflows created specifically for this project. "
         "We grant you a perpetual, irrevocable, royalty-free license to use such developments. "
         "4.2 Our IP: We retain all rights, title, and interest in our pre-existing methodologies, frameworks, "
         "tools, libraries, know-how, and Odoo modules not developed specifically for this project. "
         "4.3 Odoo IP: Odoo S.A. retains all rights to the Odoo platform and its modules."),
        ("5. Confidentiality",
         "Each party agrees to hold the other's Confidential Information in strict confidence. "
         "'Confidential Information' means all non-public information disclosed in connection with this Quotation, "
         "including business processes, financial data, customer information, and technical specifications. "
         "This obligation survives termination of this agreement for a period of two (2) years. "
         "Nothing in this clause prevents disclosure required by law or regulatory authority."),
        ("6. Data Protection",
         "We will process your data solely to provide the services under this Quotation. "
         "We maintain administrative, technical, and physical safeguards appropriate to the nature of the data, "
         "including encryption in transit (TLS 1.3) and at rest (AES-256), access controls, "
         "and regular data backups. Upon termination, we will return or delete your data within 90 days, "
         "unless retention is required by applicable law."),
        ("7. Warranty & Disclaimer",
         "7.1 We warrant that: (a) all services will be performed in a professional and workmanlike manner "
         "in accordance with industry standards; (b) custom developments will conform to the agreed specifications "
         "for a period of 30 days following go-live (the 'Warranty Period'). "
         "7.2 Disclaimer: Except as expressly stated in this Section 7.1, the services and deliverables "
         "are provided 'AS IS' without any other warranties, express or implied, including merchantability "
         "or fitness for a particular purpose. We do not warrant that the Odoo platform will be error-free "
         "or that all defects will be corrected."),
        ("8. Limitation of Liability",
         "8.1 Liability Cap: Our total aggregate liability arising from or related to this Quotation, "
         "whether in contract, tort (including negligence), or otherwise, shall not exceed the total fees "
         "paid or payable by you under this Quotation. "
         "8.2 Excluded Damages: In no event shall we be liable for: (a) indirect, incidental, special, "
         "consequential, or punitive damages; (b) loss of profits, revenue, data, goodwill, or business opportunity; "
         "(c) costs of substitute services, even if we have been advised of the possibility of such damages. "
         "8.3 This limitation of liability is fundamental to the pricing of this Quotation."),
        ("9. Indemnification",
         "You agree to indemnify and hold us harmless from any claims, damages, or expenses arising from: "
         "(a) your breach of this Quotation; (b) your data or content provided to us; "
         "(c) your use of the deliverables in violation of applicable law."),
        ("10. Termination",
         "10.1 Either party may terminate this agreement immediately by written notice if the other party "
         "materially breaches any provision and fails to cure the breach within 15 days of receiving written notice. "
         "10.2 If you terminate without cause before the project is complete, you will pay for all work "
         "satisfactorily completed up to the termination date, plus any non-cancellable commitments made on your behalf. "
         "10.3 Upon termination for any reason, you must pay all amounts due for work completed."),
        ("11. Force Majeure",
         "Neither party shall be liable for delays or failures caused by events beyond its reasonable control, "
         "including but not limited to: acts of God, war, terrorism, pandemic, government action, "
         "internet outages, power failures, or third-party service disruptions. "
         "The affected party will notify the other within 7 days and resume performance as soon as reasonably possible."),
        ("12. Governing Law & Dispute Resolution",
         "12.1 This Quotation is governed by the laws of {GOVERNING_LAW}. "
         "12.2 Any dispute arising from this Quotation will first be resolved through good-faith negotiations "
         "between senior representatives of both parties. "
         "12.3 If negotiation fails, the dispute will be referred to mediation with a mutually agreed mediator. "
         "12.4 If mediation fails, the dispute will be finally settled by binding arbitration in accordance with "
         "the rules of the Cairo Regional Centre for International Commercial Arbitration (CRCICA). "
         "12.5 The language of proceedings shall be English. Each party bears its own legal costs."),
        ("13. General Provisions",
         "13.1 Entire Agreement: This Quotation (including any attachments) constitutes the entire agreement "
         "between the parties and supersedes all prior discussions, representations, and agreements. "
         "13.2 Amendments: Any modification to this Quotation must be in writing and signed by both parties. "
         "13.3 Severability: If any provision is held invalid, the remainder continues in full force. "
         "13.4 Waiver: Failure to enforce any provision does not constitute a waiver. "
         "13.5 Assignment: You may not assign this Quotation without our prior written consent. We may assign "
         "to an affiliate or successor entity. "
         "13.6 Notices: All formal notices must be in writing to the addresses stated on page 1. "
         "13.7 Relationship: The parties are independent contractors. No partnership, joint venture, "
         "or employment relationship is created."),
    ]

    for label, desc in terms:
        tp = doc.add_paragraph()
        tp.paragraph_format.space_before = Pt(5)
        tp.paragraph_format.space_after = Pt(2)
        r = tp.add_run(f"  {label}"); r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        body(doc, desc, size=9.5, after=3)

    # ═══════════════════════════════════════════════════
    #  10. ACCEPTANCE & SIGNATURE
    # ═══════════════════════════════════════════════════
    heading(doc, 10, "ACCEPTANCE & SIGNATURE")

    body(doc,
         "By signing below, both parties acknowledge that they have read, understood, and agree to be bound "
         "by all terms and conditions of this Quotation. This Quotation becomes a legally binding agreement "
         "upon signature by both parties and is valid for 30 calendar days from the issue date.",
         size=9.5, after=10)

    sig = doc.add_table(rows=1, cols=2); no_borders(sig)

    for ci, (title, lines) in enumerate([
        ("CLIENT", ["",
                    "Name: ______________________________",
                    "Title: ______________________________",
                    "Date: ______________________________",
                    "Signature: ______________________________",
                    "Company Stamp:"]),
        ("TRAFFIC DIGITAL SOLUTIONS", ["",
                                        "Name: ______________________________",
                                        "Title: ______________________________",
                                        "Date: ______________________________",
                                        "Signature: ______________________________",
                                        "Company Stamp:"]),
    ]):
        cell = sig.cell(0, ci)
        p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(4)
        r = p.add_run(title); r.bold = True; r.font.size = Pt(10); r.font.color.rgb = GOLD
        for l in lines:
            lp = cell.add_paragraph(); lp.paragraph_format.space_after = Pt(3)
            r = lp.add_run(l); r.font.size = Pt(9.5); r.font.color.rgb = DARK_GRAY

    # ═══════════════════════════════════════════════════
    #  FOOTER
    # ═══════════════════════════════════════════════════
    doc.add_paragraph()
    rule(doc, "838081", 6)

    ft = doc.add_paragraph()
    ft.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ft.paragraph_format.space_before = Pt(6)
    r = ft.add_run("Traffic Digital Solutions  •  Villa 125, Axis 80, 5th Settlement, Cairo, Egypt\n")
    r.font.size = Pt(7); r.font.color.rgb = GRAY
    r = ft.add_run("webdevelopment@trafficdigitalsolutions.com  •  trafficdigitalsolutions.com  •  +201271112396\n")
    r.font.size = Pt(7); r.font.color.rgb = GRAY
    r = ft.add_run("Commercial Registration: XXXXX  |  Tax ID: XXXXX  |  Quotation No: {NUMBER}")
    r.font.size = Pt(7); r.font.color.rgb = GRAY; r.italic = True

    doc.save(OUTPUT_PATH)
    print(f"Odoo Implementation Quotation saved to: {OUTPUT_PATH}")
    print(f"File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")


if __name__ == "__main__":
    create_document()
