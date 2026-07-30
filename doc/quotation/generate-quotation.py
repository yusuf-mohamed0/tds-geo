#!/usr/bin/env python3
"""Generate Traffic Digital Solutions Odoo Implementation Quotation — English Only"""

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


def numbered(doc, num, text, indent=0.5):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.left_indent = Cm(indent)
    r = p.add_run(f"  {num}.  {text}")
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

    # ═══════════════════════════════════════════════════════
    #  HEADER
    # ═══════════════════════════════════════════════════════
    hdr = doc.add_table(rows=1, cols=2)
    no_borders(hdr)

    c0 = hdr.cell(0, 0); c0.width = Cm(4.5)
    lp = c0.paragraphs[0]; lp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = lp.add_run("Traffic Digital Solutions")
    r.bold = True; r.font.size = Pt(18); r.font.color.rgb = BLACK

    c1 = hdr.cell(0, 1); c1.width = Cm(11.5)
    p = c1.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p.add_run("Odoo Implementation Partner\n"); r.font.size = Pt(9); r.font.color.rgb = GRAY
    r = p.add_run("Villa 125, Axis 80, 5th Settlement, Cairo, Egypt\n"); r.font.size = Pt(8); r.font.color.rgb = GRAY
    r = p.add_run("webdevelopment@trafficdigitalsolutions.com  |  trafficdigitalsolutions.com"); r.font.size = Pt(8); r.font.color.rgb = GRAY

    rule(doc, "FCB900", 20)

    # ═══════════════════════════════════════════════════════
    #  TITLE
    # ═══════════════════════════════════════════════════════
    ti = doc.add_paragraph()
    ti.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ti.paragraph_format.space_before = Pt(18)
    ti.paragraph_format.space_after = Pt(2)
    r = ti.add_run("ODEO IMPLEMENTATION QUOTATION")
    r.bold = True; r.font.size = Pt(26); r.font.color.rgb = BLACK; r.font.name = 'Calibri Light'

    q = doc.add_paragraph()
    q.alignment = WD_ALIGN_PARAGRAPH.CENTER
    q.paragraph_format.space_after = Pt(6)
    r = q.add_run("Quotation No: {NUMBER}     |     Issued: {ISSUE_DATE}     |     Valid Until: {VALID_UNTIL}")
    r.font.size = Pt(9); r.font.color.rgb = GRAY

    rule(doc, "FCB900", 12)

    # ═══════════════════════════════════════════════════════
    #  INFO TABLE
    # ═══════════════════════════════════════════════════════
    info = doc.add_table(rows=2, cols=2); no_borders(info)

    cells = [
        (0, 0, "PREPARED FOR", ["{CLIENT_NAME}", "{CLIENT_ADDRESS}", "{CLIENT_EMAIL}", "{CLIENT_PHONE}"]),
        (0, 1, "PROJECT DETAILS", ["Project: {PROJECT_NAME}", "Odoo Edition: {ODOO_EDITION}", "Users: {USER_COUNT}", "Start Date: {START_DATE}", "Duration: {DURATION}"]),
        (1, 0, "PAYMENT & CURRENCY", ["Currency: {CURRENCY}", "Payment Terms: {PAYMENT_TERMS}", "Tax: {TAX_TREATMENT}"]),
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

    # ═══════════════════════════════════════════════════════
    #  1. EXECUTIVE SUMMARY
    # ═══════════════════════════════════════════════════════
    heading(doc, 1, "EXECUTIVE SUMMARY")
    body(doc, "{EXECUTIVE_SUMMARY}")

    # ═══════════════════════════════════════════════════════
    #  2. SCOPE OF WORK — MODULES & SERVICES
    # ═══════════════════════════════════════════════════════
    heading(doc, 2, "SCOPE OF WORK — ODOO MODULES & SERVICES")
    body(doc, "We will implement, configure, and deploy the following Odoo modules and services for your organization:")

    modules = [
        "Odoo Installation & Server Setup",
        "Sales & CRM Module — Configuration & Customization",
        "Accounting & Invoicing — Chart of Accounts, Tax Rules, Reports",
        "Inventory & Warehouse Management — Stock Locations, Transfers, Valuation",
        "Purchasing & Vendor Management",
        "Human Resources — Employee Records, Contracts, Leaves, Payroll",
        "Manufacturing / Bill of Materials (if applicable)",
        "Website & E-commerce Module — Storefront Setup & Theme",
        "Email Marketing & Campaign Automation",
        "Project Management & Timesheets",
    ]

    for mod in modules:
        bullet(doc, mod)

    doc.add_paragraph()
    body(doc, "Additional Services Included:")

    extras = [
        ("System Configuration", "Odoo Online / On-Premise setup, user roles, security groups, email server configuration, and localized settings."),
        ("Data Migration", "Secure import of master data (customers, vendors, products, chart of accounts, open invoices, inventory balances) from your existing system. Includes data cleansing and validation."),
        ("Customization & Development", "Custom fields, views, reports, and workflows tailored to your business processes. Any custom module development as specified in the requirements."),
        ("User Training", "Hands-on training sessions for your team — up to {TRAINING_SESSIONS} group sessions covering all deployed modules."),
        ("Testing & Quality Assurance", "Module integration testing, user acceptance testing (UAT) support, and bug fixing during the implementation phase."),
        ("Go-Live Support", "Dedicated support during the first {GO_LIVE_SUPPORT_DAYS} business days after go-live to ensure smooth operations."),
    ]

    for label, desc in extras:
        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(6)
        sp.paragraph_format.space_after = Pt(2)
        r = sp.add_run(f"  {label}"); r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        body(doc, desc, size=9.5, after=4)

    # ═══════════════════════════════════════════════════════
    #  3. EXCLUSIONS
    # ═══════════════════════════════════════════════════════
    heading(doc, 3, "EXCLUSIONS")
    body(doc, "The following are explicitly not included unless separately agreed in writing:")
    for ex in [
        "Odoo Online subscription fees or Odoo Enterprise license costs (paid directly to Odoo S.A.)",
        "Third-party Odoo apps or modules purchased from the Odoo App Store",
        "Website content creation (copywriting, photography, video)",
        "Custom mobile app development",
        "Ongoing support and maintenance beyond the warranty period",
        "Hardware, hosting infrastructure, or IT equipment",
        "Graphic design or branding outside of Odoo website theme customization",
    ]:
        bullet(doc, ex)

    # ═══════════════════════════════════════════════════════
    #  4. IMPLEMENTATION METHODOLOGY & TIMELINE
    # ═══════════════════════════════════════════════════════
    heading(doc, 4, "IMPLEMENTATION METHODOLOGY & TIMELINE")

    phases = [
        ("Phase 1 — Discovery & Requirements", "Week 1",
         "Business process analysis, requirements gathering, module selection finalization, and project plan approval."),
        ("Phase 2 — System Configuration", "Weeks 2-3",
         "Server setup, Odoo installation, module configuration, chart of accounts setup, email and workflow configuration."),
        ("Phase 3 — Data Migration", "Weeks 3-4",
         "Data extraction, cleansing, transformation, and import. Reconciliation and validation with your team."),
        ("Phase 4 — Customization & Development", "Weeks 4-6",
         "Custom fields, views, reports, workflows, and any required module development. Iterative review cycles."),
        ("Phase 5 — Testing & Training", "Weeks 6-7",
         "Integration testing, UAT, bug fixing, and user training sessions. Acceptance sign-off."),
        ("Phase 6 — Go-Live & Hypercare", "Week 8",
         "Production deployment, go-live support, and hypercare period with dedicated assistance."),
    ]

    for phase, dur, desc in phases:
        mp = doc.add_paragraph()
        mp.paragraph_format.space_before = Pt(6)
        mp.paragraph_format.space_after = Pt(2)
        r = mp.add_run(f"  {phase}"); r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        r2 = mp.add_run(f"  —  {dur}"); r2.font.size = Pt(9); r2.font.color.rgb = GOLD; r2.bold = True
        body(doc, desc, size=9.5, after=4)

    body(doc, "Total estimated duration: {DURATION} from project kickoff. Timeline is based on timely client feedback and data availability.", size=9.5, italic=True)

    # ═══════════════════════════════════════════════════════
    #  5. CLIENT RESPONSIBILITIES
    # ═══════════════════════════════════════════════════════
    heading(doc, 5, "CLIENT RESPONSIBILITIES")
    body(doc, "To ensure successful delivery, you agree to:")
    for rsp in [
        "Appoint a project manager and key stakeholders for each department",
        "Provide timely access to existing data, templates, and business documentation",
        "Make decisions on configuration and customization within agreed timelines",
        "Provide test users and participate in UAT",
        "Ensure availability for training sessions",
        "Provide Odoo Online / Enterprise license credentials in a timely manner",
        "Approve milestones and sign off on deliverables",
    ]:
        bullet(doc, rsp)

    # ═══════════════════════════════════════════════════════
    #  6. INVESTMENT & PRICING
    # ═══════════════════════════════════════════════════════
    heading(doc, 6, "INVESTMENT & PRICING")

    items = [
        ("#", "SERVICE", "QTY", "UNIT PRICE", "TOTAL"),
        ("1", "Odoo Installation & Server Setup", "1", "{SETUP_PRICE}", "{SETUP_TOTAL}"),
        ("2", "Core Modules Configuration ({NUM_MODULES} modules)", "{MODULE_QTY}", "{MODULE_UNIT_PRICE}", "{MODULE_TOTAL}"),
        ("3", "Data Migration Services", "{MIG_HOURS} hrs", "{MIG_RATE}/hr", "{MIG_TOTAL}"),
        ("4", "Customization & Development", "{DEV_HOURS} hrs", "{DEV_RATE}/hr", "{DEV_TOTAL}"),
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

    # Subtotal & Discount
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

    # Grand Total
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

    # Post-implementation support
    doc.add_paragraph()
    support_p = doc.add_paragraph()
    support_p.paragraph_format.space_after = Pt(2)
    r = support_p.add_run("Post-Implementation Support & Maintenance")
    r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY

    support_options = [
        ("Bronze — Basic Support", "{BRONZE_SUPPORT_PRICE}/month — Email support, bug fixes, 48h response time."),
        ("Silver — Standard Support", "{SILVER_SUPPORT_PRICE}/month — Email + phone support, bug fixes, minor changes, 24h response."),
        ("Gold — Premium Support", "{GOLD_SUPPORT_PRICE}/month — All Silver + dedicated account manager, 8h response, quarterly business reviews."),
    ]

    for label, desc in support_options:
        sp = doc.add_paragraph()
        sp.paragraph_format.space_after = Pt(2)
        sp.paragraph_format.left_indent = Cm(0.5)
        r = sp.add_run(f"  {label}:  "); r.bold = True; r.font.size = Pt(9.5); r.font.color.rgb = NAVY
        r2 = sp.add_run(desc); r2.font.size = Pt(9.5); r2.font.color.rgb = DARK_GRAY

    body(doc, "VAT (14%) will be added where applicable. All prices in {CURRENCY}.", size=8, color=GRAY, italic=True)

    # ═══════════════════════════════════════════════════════
    #  7. PAYMENT SCHEDULE
    # ═══════════════════════════════════════════════════════
    heading(doc, 7, "PAYMENT SCHEDULE")

    options = [
        ("Milestone-Based (Recommended)", 
         "30% upon signing  |  30% upon UAT sign-off  |  30% upon go-live  |  10% upon 30-day post-go-live review"),
        ("50/50 Split", "50% upon signing, 50% upon successful go-live."),
        ("Monthly Installments", "Equal monthly payments over the implementation period."),
        ("Net 30", "Full payment within 30 days of final invoice."),
        ("Full Upfront", "Full payment upon signing. Includes a 5% discount on the total project value."),
    ]
    for label, desc in options:
        pp = doc.add_paragraph()
        pp.paragraph_format.space_after = Pt(2)
        r = pp.add_run(f"  {label}"); r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        body(doc, desc, size=9.5, after=4)

    body(doc, "Selected Payment Terms: {SELECTED_PAYMENT_TERMS}", size=10, bold=True, color=BLACK)

    # ═══════════════════════════════════════════════════════
    #  8. TERMS & CONDITIONS
    # ═══════════════════════════════════════════════════════
    heading(doc, 8, "TERMS & CONDITIONS")

    terms = [
        ("1. Project Scope",
         "The scope of work is defined in Section 2 above. Any additional work outside this scope will be billed separately at our standard hourly rate of {ADDITIONAL_WORK_RATE}/hour upon your written approval."),
        ("2. Payment Terms",
         "Invoices are due according to the selected payment schedule. Late payments incur 2% monthly interest on overdue amounts. Work may be suspended if payment is more than 15 days past due."),
        ("3. Change Orders",
         "Any changes to the agreed scope must be submitted via a formal change order and approved in writing by both parties. Work on change orders begins only after approval."),
        ("4. Intellectual Property",
         "Upon full payment, you own all custom-developed code, configurations, and reports created specifically for this project. We retain ownership of our pre-existing methodologies, tools, and frameworks."),
        ("5. Confidentiality",
         "All business information shared during this engagement is strictly confidential. We will sign an NDA if required."),
        ("6. Data Protection & Security",
         "We follow industry-standard security practices including encrypted data transfer, access controls, and secure handling of your business data in compliance with applicable data protection regulations."),
        ("7. Warranty",
         "We warrant that all work will conform to the agreed specifications. Any defects reported within 30 days of go-live will be corrected at no additional charge."),
        ("8. Limitation of Liability",
         "Our total liability is capped at the total fees paid under this quotation. We are not liable for indirect, incidental, or consequential damages, including loss of data or business interruption."),
        ("9. Termination",
         "Either party may terminate for material breach with 15 days' written notice. In the event of termination, you will pay for all work completed up to the termination date."),
        ("10. Governing Law",
         "This agreement is governed by {GOVERNING_LAW}. Both parties will first attempt to resolve disputes through good-faith negotiation."),
    ]

    for label, desc in terms:
        tp = doc.add_paragraph()
        tp.paragraph_format.space_before = Pt(5)
        tp.paragraph_format.space_after = Pt(2)
        r = tp.add_run(f"  {label}"); r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        body(doc, desc, size=9.5, after=3)

    # ═══════════════════════════════════════════════════════
    #  9. ACCEPTANCE & SIGNATURE
    # ═══════════════════════════════════════════════════════
    heading(doc, 9, "ACCEPTANCE & SIGNATURE")

    body(doc,
         "By signing below, both parties acknowledge and agree to the terms of this quotation. "
         "This quotation becomes a legally binding agreement upon signature by both parties and is valid for 30 days from the issue date.",
         size=9.5, after=10)

    sig = doc.add_table(rows=1, cols=2); no_borders(sig)

    for ci, (title, lines) in enumerate([
        ("CLIENT", ["", "Name: ______________________________",
                    "Title: ______________________________",
                    "Date: ______________________________",
                    "Signature: ______________________________",
                    "Company Stamp:"]),
        ("TRAFFIC DIGITAL SOLUTIONS", ["", "Name: ______________________________",
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

    # ═══════════════════════════════════════════════════════
    #  FOOTER
    # ═══════════════════════════════════════════════════════
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
