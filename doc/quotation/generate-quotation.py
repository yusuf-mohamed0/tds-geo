#!/usr/bin/env python3
"""
Traffic Digital Solutions - Odoo Implementation Quotation
Professional Services Agreement Template
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


def styled_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    if widths:
        for i, width in enumerate(widths):
            for row in table.rows:
                row.cells[i].width = width

    for i, header in enumerate(headers):
        cell = table.cell(0, i)
        set_shading(cell, "171414")
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run(header)
        r.bold = True
        r.font.size = Pt(8)
        r.font.color.rgb = WHITE

    for row_data in rows:
        row = table.add_row()
        for i, value in enumerate(row_data):
            p = row.cells[i].paragraphs[0]
            p.paragraph_format.space_before = Pt(3)
            p.paragraph_format.space_after = Pt(3)
            r = p.add_run(value)
            r.font.size = Pt(8.5)
            r.font.color.rgb = DARK_GRAY
    return table


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
    r = p.add_run("Odoo Implementation Services - {ODOO_PARTNER_STATUS}\n"); r.font.size = Pt(9); r.font.color.rgb = GRAY
    r = p.add_run("Villa 125, Axis 80, 5th Settlement, Cairo, Egypt\n"); r.font.size = Pt(8); r.font.color.rgb = GRAY
    r = p.add_run("webdevelopment@trafficdigitalsolutions.com  -  trafficdigitalsolutions.com"); r.font.size = Pt(8); r.font.color.rgb = GRAY

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
    r = q.add_run("Quotation No: {NUMBER}    -    Issued: {ISSUE_DATE}    -    Valid Until: {VALID_UNTIL}")
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
        "Proven Odoo expertise: certified development team covering setup, configuration, launch, and support",
        "Over 100 satisfied clients: from startups to large enterprises across multiple industries",
        "Full service capability: Odoo, web, branding, marketing, and content all under one roof",
        "Structured delivery: clear milestones, testing, and sign off at every phase of the project",
        "Post go-live commitment: support plans to keep your business running smoothly after launch",
        "Based in Cairo: on-site visits and face-to-face meetings available when you need them",
    ]:
        bullet(doc, reason)

    body(doc, "Implementation strength at a glance:", bold=True, color=NAVY, after=4)
    styled_table(doc, ["Capability", "Current Position"], [
        ("Projects delivered", "100+ digital and ERP-related projects delivered since 2019"),
        ("Industries served", "Retail, healthcare, manufacturing, professional services, education, and e-commerce"),
        ("Delivery model", "Business analysis, configuration, development, migration, training, launch, and support"),
        ("Support availability", "Dedicated post-go-live support with clear response times and escalation path"),
        ("Local presence", "Cairo-based team available for workshops, stakeholder meetings, and on-site support"),
    ], [Cm(5.0), Cm(12.0)])

    body(doc, "Why Traffic wins:", bold=True, color=NAVY, after=4)
    styled_table(doc, ["Proof Point", "Proposal Value"], [
        ("Completed Odoo implementations", "{COMPLETED_ODOO_IMPLEMENTATIONS}+ implementations across selected industries"),
        ("Average go-live time", "{AVERAGE_GO_LIVE_TIME} for projects of similar scope"),
        ("Client satisfaction", "{CLIENT_SATISFACTION_RATE}% satisfaction based on post-project feedback"),
        ("Certified capability", "{ODOO_CERTIFICATIONS} Odoo certifications and {ODOO_CONSULTANTS} active consultants"),
        ("Support desk", "{SUPPORT_TEAM_SIZE} support specialists with documented SLA and escalation process"),
        ("Local delivery", "Cairo-based team with on-site workshop and executive steering support when needed"),
    ], [Cm(5.2), Cm(11.8)])

    body(doc, "Our implementation approach:", bold=True, color=NAVY, after=4)
    styled_table(doc, ["Stage", "Output"], [
        ("1. Discovery", "Stakeholder interviews, current-state review, data audit"),
        ("2. Business Analysis", "Process maps, GAP Analysis, BRD, implementation priorities"),
        ("3. Solution Design", "Target workflows, roles, approvals, reports, integrations"),
        ("4. Configuration", "Odoo modules configured according to the approved BRD"),
        ("5. Development", "Approved custom fields, reports, automations, and integrations"),
        ("6. Testing", "Internal QA, UAT support, defect closure, acceptance evidence"),
        ("7. Training", "Role-based sessions, user manual, SOPs, admin guide"),
        ("8. Go-Live", "Production launch, checklist completion, stakeholder sign-off"),
        ("9. Hypercare", "Post-launch support, stabilization, adoption monitoring"),
        ("10. Continuous Support", "Ongoing SLA support, enhancements, and quarterly reviews if selected"),
    ], [Cm(4.6), Cm(12.4)])

    body(doc, "Representative case study:", bold=True, color=NAVY, after=4)
    styled_table(doc, ["Item", "Details"], [
        ("Client", "{CASE_STUDY_CLIENT_NAME} ({CASE_STUDY_CONFIDENTIAL_NAME})"),
        ("Industry", "{CASE_STUDY_INDUSTRY}"),
        ("Modules", "{CASE_STUDY_MODULES}"),
        ("Users", "{CASE_STUDY_USERS}"),
        ("Timeline", "{CASE_STUDY_TIMELINE}"),
        ("Results", "{CASE_STUDY_RESULTS}"),
    ], [Cm(4.2), Cm(12.8)])

    body(doc, "Proposed delivery team:", bold=True, color=NAVY, after=4)
    styled_table(doc, ["Role", "Responsibility"], [
        ("Project Manager", "Timeline, communication, risks, milestones, and steering updates"),
        ("Business Analyst", "Discovery workshops, BRD, process maps, acceptance criteria"),
        ("Functional Consultant", "Odoo configuration, business rules, workflows, user journeys"),
        ("Odoo Developer", "Custom fields, reports, automations, integrations, technical fixes"),
        ("QA Specialist", "Test scenarios, defect tracking, UAT support, release checks"),
        ("Trainer", "Role-based training, user manuals, SOPs, admin guide"),
        ("Support Lead", "Hypercare, SLA tracking, escalation, post-go-live stabilization"),
    ], [Cm(4.2), Cm(12.8)])

    body(doc, "Final references and live case studies can be shared subject to client confidentiality approvals.", size=8.5, color=GRAY, italic=True)

    # ═══════════════════════════════════════════════════
    #  3. DISCOVERY OUTPUTS
    # ═══════════════════════════════════════════════════
    heading(doc, 3, "DISCOVERY OUTPUTS")
    body(doc, (
        "The first stage is designed to remove ambiguity before configuration starts. "
        "It gives both teams a shared written understanding of the business processes, gaps, risks, and implementation priorities."
    ))
    styled_table(doc, ["Discovery Output", "Purpose", "Client Approval"], [
        ("Process Mapping", "Current and target workflows for each selected department", "Required"),
        ("GAP Analysis", "Fit-gap review between standard Odoo and required business processes", "Required"),
        ("Business Requirements Document", "Final written scope, rules, reports, roles, and exceptions", "Required"),
        ("Implementation Plan", "Confirmed phases, owners, data requirements, dependencies, and milestone dates", "Required"),
        ("Data Migration Plan", "Data sources, ownership, cleansing rules, mapping, and reconciliation method", "Required"),
    ], [Cm(4.2), Cm(9.0), Cm(3.2)])

    # ═══════════════════════════════════════════════════
    #  4. SCOPE OF WORK
    # ═══════════════════════════════════════════════════
    heading(doc, 4, "CLIENT-SPECIFIC SCOPE OF WORK")
    body(doc, (
        "This proposal is based on the modules and business processes confirmed during the initial discussion. "
        "Only the modules listed below are included in this quotation. Any additional module, workflow, integration, "
        "or report requested after approval will be handled through the change request process in Section 12."
    ))

    modules = [
        "{MODULE_1}: {MODULE_1_SCOPE}",
        "{MODULE_2}: {MODULE_2_SCOPE}",
        "{MODULE_3}: {MODULE_3_SCOPE}",
        "{MODULE_4}: {MODULE_4_SCOPE}",
        "{MODULE_5}: {MODULE_5_SCOPE}",
        "Odoo Installation & Environment Setup: cloud or on-premise setup, access rights, base configuration, and email settings",
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

    body(doc, "Deliverables matrix:", bold=True, color=NAVY, after=4)
    styled_table(doc, ["Phase", "Main Deliverable", "Client Approval"], [
        ("Discovery", "BRD, GAP Analysis, process maps, implementation plan", "Required"),
        ("Configuration", "Configured modules, roles, workflows, templates, and base reports", "Required"),
        ("Migration", "Imported master data and reconciliation report", "Required"),
        ("Customization", "Approved custom fields, reports, automations, and integrations", "Required"),
        ("Training", "User manual, admin guide, recorded sessions, and attendance record", "Required"),
        ("Go-Live", "Production system, launch checklist, warranty start confirmation", "Required"),
    ], [Cm(4.0), Cm(9.0), Cm(3.3)])

    # ═══════════════════════════════════════════════════
    #  5. IMPLEMENTATION METHODOLOGY & TIMELINE
    # ═══════════════════════════════════════════════════
    heading(doc, 5, "IMPLEMENTATION METHODOLOGY & MILESTONES")

    phases = [
        ("Phase 1: Discovery & Requirements", "Week 1",
         "Business process workshops, requirements documentation, module selection finalization, "
         "and project plan with milestone dates."),
        ("Phase 2: System Configuration", "Weeks 2-3",
         "Server setup, Odoo installation/activation, module configuration, chart of accounts, "
         "tax rules, email configuration, and user role setup."),
        ("Phase 3: Data Migration", "Weeks 3-4",
         "Data extraction, cleansing, transformation, and import into Odoo. "
         "Full reconciliation with your team before proceeding."),
        ("Phase 4: Customization & Development", "Weeks 4-6",
         "Development of custom fields, views, reports, workflows, and modules. "
         "Iterative review and feedback cycles with your project team."),
        ("Phase 5: Testing & Training", "Weeks 6-7",
         "Integration testing, UAT, defect resolution, and user training sessions. "
         "Your acceptance sign-off is required to proceed to go-live."),
        ("Phase 6: Go-Live & Hypercare", "Week 8",
         "Production deployment, data verification, go-live support, and {GO_LIVE_SUPPORT_DAYS}-day hypercare period."),
    ]

    for phase, dur, desc in phases:
        mp = doc.add_paragraph()
        mp.paragraph_format.space_before = Pt(6)
        mp.paragraph_format.space_after = Pt(2)
        r = mp.add_run(f"  {phase}"); r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        r2 = mp.add_run(f"  ({dur})"); r2.font.size = Pt(9); r2.font.color.rgb = GOLD; r2.bold = True
        body(doc, desc, size=9.5, after=4)

    body(doc, (
        "Total estimated duration: {DURATION} from project kickoff meeting. "
        "Timeline assumes timely delivery of client inputs, data, and approvals. "
        "Any delays in client responsibilities may extend the timeline, which will be communicated promptly."
    ), size=9.5, italic=True)

    body(doc, "High-level implementation timeline:", bold=True, color=NAVY, after=4)
    styled_table(doc, ["Workstream", "W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"], [
        ("Discovery", "X", "", "", "", "", "", "", ""),
        ("Configuration", "", "X", "X", "", "", "", "", ""),
        ("Data Migration", "", "", "X", "X", "", "", "", ""),
        ("Customization", "", "", "", "X", "X", "X", "", ""),
        ("Testing and UAT", "", "", "", "", "", "X", "X", ""),
        ("Training", "", "", "", "", "", "", "X", ""),
        ("Go-Live", "", "", "", "", "", "", "", "X"),
        ("Hypercare", "", "", "", "", "", "", "", "X"),
    ], [Cm(4.0), Cm(1.3), Cm(1.3), Cm(1.3), Cm(1.3), Cm(1.3), Cm(1.3), Cm(1.3), Cm(1.3)])

    body(doc, "Milestone acceptance checkpoints:", bold=True, color=NAVY, after=4)
    styled_table(doc, ["Milestone", "Acceptance Evidence", "Sign-off Required"], [
        ("Discovery complete", "Approved BRD, GAP Analysis, process maps, and project plan", "Yes"),
        ("Configuration complete", "Configured modules demonstrated to client stakeholders", "Yes"),
        ("Migration complete", "Reconciliation report accepted by client owner", "Yes"),
        ("UAT complete", "All critical and high-priority issues closed or accepted", "Yes"),
        ("Training complete", "Training materials delivered and attendance recorded", "Yes"),
        ("Go-live approved", "Launch checklist completed and production access confirmed", "Yes"),
    ], [Cm(4.4), Cm(9.0), Cm(3.0)])

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
    #  7. ASSUMPTIONS, RISKS, AND SUCCESS CRITERIA
    # ═══════════════════════════════════════════════════
    heading(doc, 7, "ASSUMPTIONS, RISKS, AND SUCCESS CRITERIA")
    body(doc, "Key assumptions:", bold=True, color=NAVY, after=4)
    for assumption in [
        "The Client will provide clean and complete master data in the agreed format",
        "Odoo licenses, hosting access, SMTP details, payment gateway credentials, and third-party API credentials will be available when needed",
        "Client stakeholders will be available for discovery workshops, UAT, training, and approvals",
        "Legacy system data exports will be technically accessible and legally authorized for migration",
        "Internet connectivity, devices, printers, barcode scanners, and other local infrastructure are outside this quotation unless explicitly listed",
    ]:
        bullet(doc, assumption)

    body(doc, "Main delivery risks and mitigation:", bold=True, color=NAVY, after=4)
    styled_table(doc, ["Risk", "Potential Impact", "Mitigation"], [
        ("Delayed approvals", "Timeline extension", "Approval deadlines and weekly steering updates"),
        ("Poor data quality", "Migration delays or reconciliation issues", "Early data audit, cleansing template, and sample import"),
        ("Scope changes", "Additional cost and timeline", "Formal change request workflow before development"),
        ("Third-party API issues", "Integration delays", "Early credential validation and sandbox testing"),
        ("Low user adoption", "Reduced business value", "Role-based training, SOPs, and hypercare support"),
    ], [Cm(4.0), Cm(5.6), Cm(6.8)])

    body(doc, "Project success metrics:", bold=True, color=NAVY, after=4)
    for metric in [
        "Approved BRD and implementation plan before configuration starts",
        "100% of agreed master data migrated or formally excluded by client sign-off",
        "Financial reports reconcile with agreed legacy balances before go-live",
        "Inventory opening balances reconcile with the approved migration file",
        "All critical and high-priority UAT issues resolved before production launch",
        "User acceptance sign-off received from the nominated client project owner",
    ]:
        bullet(doc, metric)

    # ═══════════════════════════════════════════════════
    #  8. INVESTMENT & PRICING
    # ═══════════════════════════════════════════════════
    heading(doc, 8, "INVESTMENT & PRICING")

    items = [
        ("#", "SERVICE / DELIVERABLE", "QTY", "UNIT PRICE", "TOTAL"),
        ("1", "Discovery, BRD, GAP Analysis, and Implementation Plan", "1", "{DISCOVERY_PRICE}", "{DISCOVERY_TOTAL}"),
        ("2", "Odoo Installation and Environment Setup", "1", "{SETUP_PRICE}", "{SETUP_TOTAL}"),
        ("3", "{MODULE_1} Configuration", "1", "{MODULE_1_PRICE}", "{MODULE_1_TOTAL}"),
        ("4", "{MODULE_2} Configuration", "1", "{MODULE_2_PRICE}", "{MODULE_2_TOTAL}"),
        ("5", "{MODULE_3} Configuration", "1", "{MODULE_3_PRICE}", "{MODULE_3_TOTAL}"),
        ("6", "Data Migration and Reconciliation", "1", "{MIGRATION_PRICE}", "{MIGRATION_TOTAL}"),
        ("7", "Custom Reports, Workflows, and Integrations", "1", "{CUSTOMIZATION_PRICE}", "{CUSTOMIZATION_TOTAL}"),
        ("8", "User Training, Manuals, SOPs, and Admin Guide", "1", "{TRAINING_PRICE}", "{TRAINING_TOTAL}"),
        ("9", "Go-Live Support and Hypercare", "1", "{HYPERCARE_PRICE}", "{HYPERCARE_TOTAL}"),
        ("10", "Project Management and Coordination", "1", "{PM_PRICE}", "{PM_TOTAL}"),
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

    # ═══════════════════════════════════════════════════
    #  9. SUPPORT SLA
    # ═══════════════════════════════════════════════════
    heading(doc, 9, "SUPPORT SLA AND POST-GO-LIVE OPTIONS")

    body(doc, "After the 30-day warranty period, the following support plans are available:", size=9.5, after=4)

    styled_table(doc, ["Plan", "Working Hours", "Response Time", "Resolution Target", "Escalation"], [
        ("Bronze", "Business hours", "48 hours", "Best effort based on issue severity", "Support lead"),
        ("Silver", "Business hours", "24 hours", "2-5 business days for standard issues", "Support lead, then project manager"),
        ("Gold", "Extended business hours", "8 hours", "1-3 business days for standard issues", "Support lead, project manager, senior consultant"),
    ], [Cm(2.2), Cm(3.0), Cm(2.7), Cm(4.4), Cm(4.0)])

    body(doc, "Support priority matrix:", bold=True, color=NAVY, after=4)
    styled_table(doc, ["Severity", "Definition", "Response", "Resolution Target"], [
        ("Critical", "Production system unavailable or core transaction blocked", "2 hours", "8 business hours"),
        ("High", "Major business function impaired with no practical workaround", "4 hours", "24 business hours"),
        ("Medium", "Issue affects a limited process and workaround is available", "1 business day", "3 business days"),
        ("Low", "Minor issue, question, cosmetic defect, or enhancement request", "2 business days", "Next agreed release"),
    ], [Cm(2.4), Cm(7.2), Cm(3.0), Cm(3.8)])

    body(doc, "Emergency support for production-blocking issues can be added as a separate paid add-on if required.", size=8.5, color=GRAY, italic=True)

    body(doc, "Warranty scope:", bold=True, color=NAVY, after=4)
    styled_table(doc, ["Included During Warranty", "Excluded From Warranty"], [
        ("Bug fixes for approved deliverables that do not match the signed BRD", "New requirements or changes after requirements freeze"),
        ("Configuration corrections for agreed workflows", "Odoo license fees, hosting, infrastructure, or third-party service fees"),
        ("Integration fixes for integrations explicitly included in scope", "Third-party API changes, downtime, or vendor-side defects"),
        ("Data import corrections caused by implementation error", "Incorrect, incomplete, or late client-provided data"),
        ("Clarification support for trained users during hypercare", "New training sessions outside the agreed training plan"),
    ], [Cm(8.2), Cm(8.2)])

    body(doc, "Definition of done:", bold=True, color=NAVY, after=4)
    for done_item in [
        "The module or deliverable matches the approved BRD and agreed acceptance criteria",
        "Configuration or development has passed internal QA checks",
        "Client UAT has been completed with no unresolved critical or high-priority issues",
        "Documentation, SOPs, or user guidance has been delivered where applicable",
        "Training has been completed for the agreed user groups where applicable",
        "The nominated client approver has provided written sign-off or accepted go-live approval",
    ]:
        bullet(doc, done_item)

    for label, desc in [
        ("Bronze: Basic", "{BRONZE_PRICE}/month. Email-only support, bug fixes, 48-hour response time, quarterly system health check."),
        ("Silver: Standard", "{SILVER_PRICE}/month. Email and phone support, bug fixes, minor configuration changes, 24-hour response, monthly health check."),
        ("Gold: Premium", "{GOLD_PRICE}/month. Dedicated account manager, priority phone and email, 8-hour response, unlimited minor changes, quarterly business review, discounted rate on major changes."),
    ]:
        sp = doc.add_paragraph()
        sp.paragraph_format.space_after = Pt(2)
        sp.paragraph_format.left_indent = Cm(0.5)
        r = sp.add_run(f"  {label}:  "); r.bold = True; r.font.size = Pt(9.5); r.font.color.rgb = NAVY
        r2 = sp.add_run(desc); r2.font.size = Pt(9.5); r2.font.color.rgb = DARK_GRAY

    body(doc, "VAT (14%) will be added where applicable. All prices in {CURRENCY} unless otherwise stated.", size=8, color=GRAY, italic=True)

    # ═══════════════════════════════════════════════════
    #  10. PAYMENT SCHEDULE
    # ═══════════════════════════════════════════════════
    heading(doc, 10, "PAYMENT SCHEDULE")

    body(doc, "Selected payment terms: {SELECTED_PAYMENT_TERMS}", size=10, bold=True, color=BLACK)
    styled_table(doc, ["Payment Milestone", "Trigger", "Percentage", "Amount"], [
        ("Initial Payment", "Upon quotation signing", "30%", "{PAYMENT_1_AMOUNT}"),
        ("Configuration Milestone", "Upon approval of configured core modules", "30%", "{PAYMENT_2_AMOUNT}"),
        ("Go-Live Milestone", "Upon successful production launch", "30%", "{PAYMENT_3_AMOUNT}"),
        ("Post-Go-Live Review", "After 30-day warranty review", "10%", "{PAYMENT_4_AMOUNT}"),
    ], [Cm(4.2), Cm(7.0), Cm(2.2), Cm(3.0)])

    # ═══════════════════════════════════════════════════
    #  11. CHANGE REQUEST PROCESS
    # ═══════════════════════════════════════════════════
    heading(doc, 11, "CHANGE REQUEST PROCESS")
    body(doc, (
        "After BRD approval and requirements freeze, any new requirement or material change must follow the process below. "
        "This keeps cost, delivery dates, and responsibilities clear for both parties."
    ))
    styled_table(doc, ["Step", "Action", "Output"], [
        ("1", "Client submits written change request", "Logged change request"),
        ("2", "Traffic Digital Solutions reviews business and technical impact", "Impact analysis"),
        ("3", "Cost, timeline, and dependency impact are estimated", "Change quotation"),
        ("4", "Client approves or rejects the change in writing", "Signed approval or rejection"),
        ("5", "Approved change is scheduled for delivery", "Updated project plan"),
    ], [Cm(1.4), Cm(8.0), Cm(6.8)])

    # ═══════════════════════════════════════════════════
    #  12. EXCLUSIONS AND REQUIREMENTS FREEZE
    # ═══════════════════════════════════════════════════
    heading(doc, 12, "EXCLUSIONS AND REQUIREMENTS FREEZE")
    body(doc, "The following are explicitly excluded from this quotation unless separately agreed in writing:")
    for ex in [
        "Any requirement, module, report, integration, or workflow not listed in the approved Business Requirements Document",
        "Changes requested after BRD approval and requirements freeze, unless approved through a signed change request",
        "Odoo Online subscription fees or Odoo Enterprise license costs (paid directly to Odoo S.A. by you)",
        "Third-party Odoo apps or modules purchased from the Odoo App Store",
        "Website content creation (copywriting, photography, videography)",
        "Custom mobile or tablet application development",
        "Ongoing support and maintenance beyond the 30-day warranty period, unless covered by a selected support plan",
        "Hardware, server infrastructure, or IT equipment procurement",
        "Graphic design, brand identity, or logo creation beyond Odoo website theme configuration",
        "Integration with systems not explicitly listed in this quotation",
    ]:
        bullet(doc, ex)

    # ═══════════════════════════════════════════════════
    #  13. TERMS & CONDITIONS
    # ═══════════════════════════════════════════════════
    heading(doc, 13, "TERMS & CONDITIONS")

    terms = [
        ("1. Scope of Work",
         "The scope of work is defined exclusively in Section 4 of this Quotation. Any services, deliverables, or modifications "
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
         "4.1 Client-Specific Work: Upon full payment of all amounts due, you own the custom code, configurations, "
         "reports, workflows, documents, and deliverables created specifically and exclusively for this project. "
         "4.2 Traffic Digital Solutions Materials: We retain ownership of our pre-existing methods, templates, tools, "
         "libraries, reusable components, know-how, implementation accelerators, and generic Odoo modules that were not "
         "created exclusively for you. Where such materials are used in your project, we grant you a non-exclusive, "
         "perpetual license to use them as part of your implemented Odoo system. "
         "4.3 Odoo Platform: Odoo S.A. retains all rights to the Odoo platform, standard modules, and licensed software."),
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
         "10.3 Client delays exceeding 30 calendar days may require project rescheduling and revised delivery dates, "
         "subject to Traffic Digital Solutions resource availability. "
         "10.4 Upon termination for any reason, you must pay all amounts due for work completed."),
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
    #  14. ACCEPTANCE & SIGNATURE
    # ═══════════════════════════════════════════════════
    heading(doc, 14, "ACCEPTANCE & SIGNATURE")

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
    r = ft.add_run("Commercial Registration: XXXXX  -  Tax ID: XXXXX  -  Quotation No: {NUMBER}")
    r.font.size = Pt(7); r.font.color.rgb = GRAY; r.italic = True

    doc.save(OUTPUT_PATH)
    print(f"Odoo Implementation Quotation saved to: {OUTPUT_PATH}")
    print(f"File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")


if __name__ == "__main__":
    create_document()
