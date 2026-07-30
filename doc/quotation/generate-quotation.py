#!/usr/bin/env python3
"""Generate a polished Traffic Digital Solutions Quotation as .docx — English Only"""

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

LOGO_PATH = "/root/tds-geo/assets/logos/tds-geo-black.png"
OUTPUT_PATH = "/root/tds-geo/doc/quotation/TDS-GEO-Quotation.docx"


def set_shading(cell, hex_color):
    cell._tc.get_or_add_tcPr().append(
        parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    )


def no_borders(table):
    pr = table._tbl.tblPr or parse_xml(f'<w:tblPr {nsdecls("w")}/>')
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


def bullet(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.left_indent = Cm(0.5)
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

    # ═══════════════════════════════════════════════════════
    #  HEADER
    # ═══════════════════════════════════════════════════════
    hdr = doc.add_table(rows=1, cols=2)
    no_borders(hdr)

    c0 = hdr.cell(0, 0); c0.width = Cm(4.5)
    if os.path.exists(LOGO_PATH):
        lp = c0.paragraphs[0]; lp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        lp.add_run().add_picture(LOGO_PATH, width=Cm(4.0))

    c1 = hdr.cell(0, 1); c1.width = Cm(11.5)
    p = c1.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p.add_run("Traffic Digital Solutions"); r.bold = True; r.font.size = Pt(20); r.font.color.rgb = BLACK
    p2 = c1.add_paragraph(); p2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p2.add_run("AI-Powered Content & SEO Platform\n"); r.font.size = Pt(9); r.font.color.rgb = GRAY
    r = p2.add_run("Commercial Registration: XXXXX  |  Tax ID: XXXXX\n"); r.font.size = Pt(8); r.font.color.rgb = GRAY
    r = p2.add_run("Villa 125, Axis 80, 5th Settlement, Cairo, Egypt\n"); r.font.size = Pt(8); r.font.color.rgb = GRAY
    r = p2.add_run("webdevelopment@trafficdigitalsolutions.com  |  trafficdigitalsolutions.com"); r.font.size = Pt(8); r.font.color.rgb = GRAY

    rule(doc, "FCB900", 20)

    # ═══════════════════════════════════════════════════════
    #  TITLE
    # ═══════════════════════════════════════════════════════
    ti = doc.add_paragraph()
    ti.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ti.paragraph_format.space_before = Pt(18)
    ti.paragraph_format.space_after = Pt(2)
    r = ti.add_run("PROFESSIONAL SERVICES QUOTATION")
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
        (0, 0, "PREPARED FOR", ["{CLIENT_NAME}", "{CLIENT_ADDRESS}", "{CLIENT_EMAIL}"]),
        (0, 1, "PROJECT DETAILS", ["Project: {PROJECT_NAME}", "Description: {PROJECT_DESC}", "Start Date: {START_DATE}", "Duration: {DURATION}"]),
        (1, 0, "PAYMENT & CURRENCY", ["Currency: {CURRENCY}", "Payment Terms: {PAYMENT_TERMS}", "Tax: {TAX_TREATMENT}"]),
        (1, 1, "DELIVERY METHOD", ["Format: Digital Delivery", "Schedule: {DELIVERY_SCHEDULE}", "Handover: {HANDOVER_METHOD}"]),
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
    #  1. PROJECT OVERVIEW
    # ═══════════════════════════════════════════════════════
    heading(doc, 1, "PROJECT OVERVIEW")
    body(doc, "{PROJECT_OVERVIEW}")

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run("Key Objectives:")
    r.bold = True; r.font.size = Pt(9.5); r.font.color.rgb = NAVY
    for obj in ["{OBJECTIVE_1}", "{OBJECTIVE_2}", "{OBJECTIVE_3}"]:
        bullet(doc, obj)

    # ═══════════════════════════════════════════════════════
    #  2. SCOPE OF SERVICES
    # ═══════════════════════════════════════════════════════
    heading(doc, 2, "SCOPE OF SERVICES")
    body(doc, "The following services are included in this engagement:")

    services = [
        ("AI-Powered Content Generation",
         "Automated creation of SEO-optimized articles tailored to your brand voice, target keywords, and audience. Each article follows our proprietary EEAT Content Framework for quality, topical authority, and long-term ranking performance."),
        ("SEO Optimization Pipeline",
         "Full on-page SEO including meta tags, headings, keyword placement, internal linking, schema markup, readability scoring, and content structure optimization."),
        ("Multi-Platform Publishing",
         "Direct API-based publishing to Shopify, WordPress, Webflow, or Ghost. Includes scheduled publishing with an integrated approval workflow."),
        ("Google Search Console Integration",
         "Real-time search performance tracking: impressions, clicks, CTR, and average position. Full sync and analysis of your search presence."),
        ("Analytics & Reporting Dashboard",
         "Real-time dashboard with metric cards, performance charts, top queries table, and exportable monthly reports."),
        ("Multi-Language Content Support",
         "Content generation and SEO in up to 13 languages: English, Arabic, French, German, Spanish, Portuguese, Italian, Russian, Turkish, Japanese, Chinese, Korean, and Dutch."),
    ]

    for title, desc in services:
        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(6)
        sp.paragraph_format.space_after = Pt(2)
        r = sp.add_run(f"  {title}")
        r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        body(doc, desc, size=9.5, after=4)

    # ═══════════════════════════════════════════════════════
    #  3. EXCLUSIONS
    # ═══════════════════════════════════════════════════════
    heading(doc, 3, "EXCLUSIONS")
    body(doc, "The following are explicitly not included unless separately agreed in writing:")
    for ex in [
        "Website design, development, or hosting services",
        "Graphic design or brand identity creation (except AI-generated article images)",
        "Manual content writing, editing, or proofreading",
        "Paid advertising management (Google Ads, Social Media Ads)",
        "Domain registration, email hosting, or SSL certificates",
        "Third-party software licenses or subscriptions",
        "Video production, animation, or photography",
    ]:
        bullet(doc, ex)

    # ═══════════════════════════════════════════════════════
    #  4. TIMELINE & MILESTONES
    # ═══════════════════════════════════════════════════════
    heading(doc, 4, "TIMELINE & MILESTONES")

    for phase, dur, desc in [
        ("Phase 1 — Setup & Onboarding", "Days 1-5",
         "Account creation, platform configuration, API integrations, brand profile setup, keyword research initialization, and test run."),
        ("Phase 2 — First Content Batch", "Days 6-12",
         "Initial content generation (up to 5 articles), review and revision cycle, and publishing pipeline validation."),
        ("Phase 3 — Ongoing Delivery", "Weekly",
         "Scheduled content generation per agreed cadence with continuous optimization and monthly performance reporting."),
    ]:
        mp = doc.add_paragraph()
        mp.paragraph_format.space_before = Pt(6)
        mp.paragraph_format.space_after = Pt(2)
        r = mp.add_run(f"  {phase}"); r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        r2 = mp.add_run(f"  —  {dur}"); r2.font.size = Pt(9); r2.font.color.rgb = GOLD; r2.bold = True
        body(doc, desc, size=9.5, after=4)

    body(doc, "Total estimated duration: {DURATION} from start date. Timeline may be adjusted based on client feedback cycles and scope changes.", size=9.5, italic=True)

    # ═══════════════════════════════════════════════════════
    #  5. CLIENT RESPONSIBILITIES
    # ═══════════════════════════════════════════════════════
    heading(doc, 5, "CLIENT RESPONSIBILITIES")
    body(doc, "To ensure successful delivery, you agree to:")
    for rsp in [
        "Provide API access to your CMS platforms (Shopify, WordPress, etc.)",
        "Share brand guidelines, target keywords, and content preferences",
        "Review and approve generated content within 3 business days of delivery",
        "Provide timely feedback on content quality and strategic direction",
        "Maintain a valid payment method and adhere to agreed payment terms",
        "Designate a point of contact for day-to-day coordination",
    ]:
        bullet(doc, rsp)

    # ═══════════════════════════════════════════════════════
    #  6. INVESTMENT & PRICING
    # ═══════════════════════════════════════════════════════
    heading(doc, 6, "INVESTMENT & PRICING")

    items = [
        ("#", "SERVICE", "QTY", "UNIT PRICE", "TOTAL"),
        ("1", "Setup & Onboarding", "1", "{SETUP_PRICE}", "{SETUP_TOTAL}"),
        ("2", "{PLAN_NAME} — {BILLING_CYCLE}", "{PLAN_QTY}", "{PLAN_UNIT_PRICE}", "{PLAN_TOTAL}"),
        ("3", "Extra Article Pack (×{EXTRA_QTY})", "{EXTRA_QTY}", "{EXTRA_UNIT_PRICE}", "{EXTRA_TOTAL}"),
        ("4", "Strategy Consulting ({CONSULT_HRS} hours)", "{CONSULT_HRS}", "{CONSULT_RATE}/hr", "{CONSULT_TOTAL}"),
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

    # Subtotal & Discount rows
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

    vat = doc.add_paragraph()
    vat.paragraph_format.space_before = Pt(4)
    r = vat.add_run("VAT (14%) will be added where applicable. All prices in {CURRENCY} unless otherwise stated.  ")
    r.font.size = Pt(8); r.font.color.rgb = GRAY; r.italic = True
    r2 = vat.add_run("Quarterly prepaid plans include a 10% discount. Annual prepaid plans include a 15% discount.")
    r2.font.size = Pt(8); r2.font.color.rgb = GOLD; r2.bold = True

    # ═══════════════════════════════════════════════════════
    #  7. PAYMENT SCHEDULE
    # ═══════════════════════════════════════════════════════
    heading(doc, 7, "PAYMENT SCHEDULE")

    options = [
        ("Option A — Full Upfront (Recommended)", "100% upon signing. Best value."),
        ("Option B — 50/50 Split", "50% upon signing, 50% upon delivery confirmation."),
        ("Option C — 30/70 Split", "30% deposit upon signing, 70% within 15 days of completion."),
        ("Option D — Net 15", "Full payment within 15 days of invoice date."),
        ("Option E — Net 30", "Full payment within 30 days of invoice date."),
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
        ("1. Minimum Term",
         "The initial commitment is a minimum of three (3) calendar months. After the initial term, the agreement auto-renews monthly unless either party gives 30 days' written cancellation notice."),
        ("2. Payment Terms",
         "All fees are in the stated currency. Invoices are due according to the selected payment schedule. Late payments incur 2% monthly interest on overdue amounts. Services may be suspended if payment is more than 15 days past due."),
        ("3. Intellectual Property",
         "You own all content generated specifically for your brand upon full payment. We retain ownership of our platform, algorithms, software, and methodologies."),
        ("4. Confidentiality",
         "All non-public information shared during this engagement is strictly confidential and will not be disclosed to third parties without your consent."),
        ("5. Data Protection & Security",
         "We maintain industry-standard security measures including encryption (AES-256 at rest, TLS 1.3 in transit), access controls, and regular backups. Your data will be deleted within 90 days of contract termination, unless retention is required by law."),
        ("6. No Guarantee of Rankings",
         "We deliver high-quality content and apply SEO best practices. However, search engine rankings depend on many factors beyond our control and are never guaranteed."),
        ("7. Limitation of Liability",
         "Our total liability is capped at the total fees paid in the twelve (12) months preceding any claim. We are not liable for indirect, incidental, or consequential damages."),
        ("8. Termination",
         "Either party may terminate for material breach with 15 days' written notice. If you terminate before the minimum term ends, the remaining balance for the minimum term becomes immediately due."),
        ("9. Governing Law & Dispute Resolution",
         "This agreement is governed by {GOVERNING_LAW}. Disputes will first be resolved through good-faith negotiation, then mediation, and finally binding arbitration if necessary."),
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
    print(f"Quotation saved to: {OUTPUT_PATH}")
    print(f"File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")


if __name__ == "__main__":
    create_document()
