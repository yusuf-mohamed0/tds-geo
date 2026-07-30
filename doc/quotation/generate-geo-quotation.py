#!/usr/bin/env python3
"""
Traffic Digital Solutions - TDS GEO Empire Quotation
Client-ready proposal for AI SEO, AEO, GEO, LLMO, content automation, and citation growth.
"""

import os

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
from docx.shared import Cm, Pt, RGBColor


BLACK = RGBColor(0x17, 0x14, 0x14)
GOLD = RGBColor(0xFC, 0xB9, 0x00)
NAVY = RGBColor(0x14, 0x24, 0x44)
GRAY = RGBColor(0x83, 0x80, 0x81)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
DARK_GRAY = RGBColor(0x3D, 0x3B, 0x3B)

OUTPUT_PATH = "/root/tds-geo/doc/quotation/TDS-GEO-Empire-Quotation.docx"


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
    r.font.name = "Calibri Light"
    rule(doc, "FCB900", 8)


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
    r = p.add_run(f"- {text}")
    r.font.size = Pt(9.5)
    r.font.color.rgb = DARK_GRAY


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

    for section in doc.sections:
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(1.5)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10.5)
    style.font.color.rgb = DARK_GRAY
    style.paragraph_format.space_after = Pt(6)
    style.paragraph_format.line_spacing = 1.15

    header = doc.add_table(rows=1, cols=2)
    no_borders(header)
    c0 = header.cell(0, 0)
    c0.width = Cm(6.0)
    p = c0.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = p.add_run("TDS GEO")
    r.bold = True
    r.font.size = Pt(22)
    r.font.color.rgb = BLACK
    r.font.name = "Calibri Light"

    c1 = header.cell(0, 1)
    c1.width = Cm(10.0)
    p = c1.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p.add_run("AI SEO, AEO, GEO, LLMO, and Citation Growth\n")
    r.font.size = Pt(9)
    r.font.color.rgb = GRAY
    r = p.add_run("Villa 125, Axis 80, 5th Settlement, Cairo, Egypt\n")
    r.font.size = Pt(8)
    r.font.color.rgb = GRAY
    r = p.add_run("webdevelopment@trafficdigitalsolutions.com  -  trafficdigitalsolutions.com")
    r.font.size = Pt(8)
    r.font.color.rgb = GRAY

    rule(doc, "FCB900", 20)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(18)
    title.paragraph_format.space_after = Pt(2)
    r = title.add_run("TDS GEO EMPIRE QUOTATION")
    r.bold = True
    r.font.size = Pt(26)
    r.font.color.rgb = BLACK
    r.font.name = "Calibri Light"

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(6)
    r = subtitle.add_run("Quotation No: {NUMBER}    -    Issued: {ISSUE_DATE}    -    Valid Until: {VALID_UNTIL}")
    r.font.size = Pt(9)
    r.font.color.rgb = GRAY

    rule(doc, "FCB900", 12)

    info = doc.add_table(rows=2, cols=2)
    no_borders(info)
    cells = [
        (0, 0, "PREPARED FOR", ["{CLIENT_NAME}", "{CLIENT_ADDRESS}", "{CLIENT_EMAIL}", "{CLIENT_PHONE}"]),
        (0, 1, "PROPOSED GEO PROGRAM", ["Plan: {SELECTED_PLAN}", "Websites: {WEBSITE_COUNT}", "Markets: {TARGET_MARKETS}", "Languages: {LANGUAGES}"]),
        (1, 0, "COMMERCIALS", ["Currency: {CURRENCY}", "Billing: {BILLING_CYCLE}", "Setup Fee: {SETUP_FEE}", "Monthly Fee: {MONTHLY_FEE}"]),
        (1, 1, "DELIVERY", ["Start Date: {START_DATE}", "Onboarding: 3-5 business days", "First Content: within 7 business days", "Review Owner: {CLIENT_REVIEW_OWNER}"]),
    ]
    for row_idx, col_idx, label, lines in cells:
        cell = info.cell(row_idx, col_idx)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(label)
        r.bold = True
        r.font.size = Pt(7.5)
        r.font.color.rgb = GOLD
        for line in lines:
            lp = cell.add_paragraph()
            lp.paragraph_format.space_after = Pt(1)
            r = lp.add_run(line)
            r.font.size = Pt(10)
            r.font.color.rgb = BLACK

    rule(doc, "FCB900", 10)

    heading(doc, 1, "EXECUTIVE SUMMARY")
    body(doc, (
        "TDS GEO is a growth system for businesses that want to be found, cited, and trusted across Google, "
        "AI Overviews, ChatGPT, Perplexity, Gemini, Copilot, and the wider answer-engine ecosystem. "
        "The objective is not simply to publish more content. The objective is to build a measurable GEO empire: "
        "search visibility, answer extraction, entity authority, citation share, and compounding content assets."
    ))
    body(doc, "This quotation covers the setup, onboarding, subscription, content workflow, reporting, and support for the selected TDS GEO plan.")

    heading(doc, 2, "WHY TDS GEO")
    styled_table(doc, ["Problem", "How TDS GEO Solves It"], [
        ("Organic traffic is becoming less predictable", "Builds content for SEO, answer extraction, and AI citation surfaces"),
        ("AI engines summarize before users click", "Structures content so brands can be mentioned, quoted, and cited"),
        ("Manual content operations are slow", "Automates research, drafting, metadata, publishing, scheduling, and reporting"),
        ("Teams cannot measure AI visibility", "Tracks search performance, citation signals, content output, and weak points"),
        ("Most tools only generate text", "Combines strategy, content, CMS publishing, quality controls, and monthly optimization"),
    ], [Cm(6.0), Cm(10.8)])

    body(doc, "GEO empire operating model:", bold=True, color=NAVY, after=4)
    styled_table(doc, ["Layer", "Purpose"], [
        ("SEO Foundation", "Technical readiness, metadata, internal linking, keyword and topic coverage"),
        ("AEO Structure", "Answer-first sections, FAQs, schema-ready formatting, snippet-friendly writing"),
        ("GEO Citability", "Clear claims, original structure, source-ready passages, comparison tables, brand context"),
        ("LLMO Authority", "Consistent entity signals, topical depth, brand facts, authoritative references"),
        ("Monthly Ops", "Freshness checks, content gaps, weak-point fixes, reporting, and next actions"),
    ], [Cm(4.5), Cm(12.2)])

    heading(doc, 3, "SCOPE OF WORK")
    body(doc, "Included deliverables for the selected program:")
    for item in [
        "Client onboarding and brand profile setup",
        "Website and CMS connection for Shopify, WordPress, or supported CMS platforms",
        "AI SEO, AEO, GEO, and LLMO content strategy setup",
        "Keyword, topic, content gap, and weak-point mapping",
        "Article, product description, and blog content generation according to approved plan limits",
        "SEO metadata, summary, title tag, meta description, and draft publishing support",
        "Google Search Console integration where access is provided",
        "Citation and AI visibility tracking where supported by the selected plan",
        "Monthly performance reporting and optimization recommendations",
        "Support, training, and platform usage guidance according to the selected SLA",
    ]:
        bullet(doc, item)

    body(doc, "Out of scope unless separately quoted:", bold=True, color=NAVY, after=4)
    for item in [
        "Website redesign, development, hosting, domain management, or paid advertising management",
        "Manual photography, videography, offline brand production, or graphic design outside included AI images",
        "Legal, medical, financial, or regulated-content approval by licensed professionals",
        "Third-party software licenses, CMS subscription fees, app fees, or marketplace costs",
        "Guarantees of ranking, traffic, sales, AI citation placement, or search-engine inclusion",
    ]:
        bullet(doc, item)

    heading(doc, 4, "PACKAGE OPTIONS")
    styled_table(doc, ["Plan", "Best For", "Monthly Fee", "Core Inclusions"], [
        ("Starter", "Small stores testing AI SEO and content automation", "$29/month", "Basic content generation, SEO metadata, draft publishing workflow"),
        ("Professional", "Growing stores that need consistent content and GEO analysis", "$79/month", "Higher content volume, GEO analysis, citations, reporting, priority workflow"),
        ("Enterprise", "Multi-site brands, agencies, or aggressive GEO growth", "$199/month", "Advanced workflow, citation tracking, support SLA, monthly strategy review"),
    ], [Cm(2.8), Cm(5.0), Cm(2.8), Cm(6.4)])

    body(doc, "Selected plan: {SELECTED_PLAN}", bold=True, color=BLACK)
    body(doc, "Recommended setup and onboarding fee: {SETUP_FEE}. Final setup fee depends on CMS complexity, number of stores, language count, and migration needs.", size=9.5, color=GRAY, italic=True)

    heading(doc, 5, "PRICING")
    items = [
        ("#", "SERVICE / DELIVERABLE", "QTY", "UNIT PRICE", "TOTAL"),
        ("1", "TDS GEO Setup and Onboarding", "1", "{SETUP_FEE}", "{SETUP_TOTAL}"),
        ("2", "{SELECTED_PLAN} Subscription", "{BILLING_CYCLE}", "{PLAN_PRICE}", "{PLAN_TOTAL}"),
        ("3", "Brand Profile and SEO/GEO Strategy Setup", "1", "{STRATEGY_PRICE}", "{STRATEGY_TOTAL}"),
        ("4", "Content Production Add-On", "{CONTENT_ADDON_QTY}", "{CONTENT_ADDON_RATE}", "{CONTENT_ADDON_TOTAL}"),
        ("5", "Training / Strategy Session", "{TRAINING_QTY}", "{TRAINING_RATE}", "{TRAINING_TOTAL}"),
    ]
    tbl = doc.add_table(rows=len(items), cols=5)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    for row_idx, row_data in enumerate(items):
        for col_idx, text in enumerate(row_data):
            cell = tbl.cell(row_idx, col_idx)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            if row_idx == 0:
                set_shading(cell, "171414")
                r = p.add_run(text)
                r.bold = True
                r.font.size = Pt(8)
                r.font.color.rgb = WHITE
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT if col_idx == 1 else WD_ALIGN_PARAGRAPH.RIGHT
                r = p.add_run(text)
                r.font.size = Pt(8.5)
                r.font.color.rgb = BLACK if col_idx == 4 else DARK_GRAY

    for label, value in [("Subtotal", "{SUBTOTAL}"), ("Discount", "{DISCOUNT_AMOUNT}"), ("VAT", "{VAT_AMOUNT}"), ("TOTAL", "{GRAND_TOTAL}")]:
        row = tbl.add_row()
        for col_idx in range(5):
            cell = row.cells[col_idx]
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            if col_idx == 3:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                r = p.add_run(label)
                r.bold = True
                r.font.size = Pt(9)
                r.font.color.rgb = NAVY
            if col_idx == 4:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                if label == "TOTAL":
                    set_shading(cell, "FCB900")
                r = p.add_run(value)
                r.bold = label == "TOTAL"
                r.font.size = Pt(10 if label == "TOTAL" else 9)
                r.font.color.rgb = BLACK

    heading(doc, 6, "IMPLEMENTATION TIMELINE")
    styled_table(doc, ["Stage", "Timeline", "Output", "Client Approval"], [
        ("Kickoff", "Day 1", "Access checklist, stakeholders, target markets, content priorities", "Required"),
        ("Brand Profile", "Days 1-3", "Voice, audience, products, offers, differentiators, weak points", "Required"),
        ("CMS Connection", "Days 2-5", "Shopify, WordPress, or supported CMS connected and tested", "Required"),
        ("Strategy Setup", "Days 3-7", "Topics, keywords, content pillars, GEO citation targets", "Required"),
        ("First Content Batch", "Within 7 business days", "Draft content ready for review or publishing workflow", "Required"),
        ("Monthly Optimization", "Ongoing", "Report, weak points, next content actions, performance review", "Monthly"),
    ], [Cm(3.6), Cm(3.2), Cm(7.2), Cm(2.4)])

    heading(doc, 7, "SUCCESS METRICS")
    for metric in [
        "Approved brand profile, technical reference, and SEO content guide completed during onboarding",
        "CMS publishing connection tested successfully before content operations begin",
        "Content calendar approved for the first month",
        "Published or draft content delivered according to selected plan limits",
        "SEO metadata included for every generated article or content item",
        "Monthly report delivered with performance, weak points, and next actions",
        "Citation and AI visibility tracking reviewed where included in the selected plan",
    ]:
        bullet(doc, metric)

    heading(doc, 8, "SUPPORT SLA")
    styled_table(doc, ["Severity", "Definition", "Response", "Target"], [
        ("Critical", "Publishing pipeline unavailable for active client", "4 business hours", "Same or next business day workaround"),
        ("High", "Major CMS/API issue or failed scheduled publish", "1 business day", "2 business days"),
        ("Medium", "Content, metadata, report, or configuration issue", "2 business days", "3-5 business days"),
        ("Low", "Question, minor correction, or enhancement request", "3 business days", "Next planned cycle"),
    ], [Cm(2.6), Cm(7.0), Cm(3.2), Cm(3.8)])
    body(doc, "Business hours: Sunday to Thursday, 9:00 AM to 6:00 PM Cairo time, excluding Egyptian public holidays.", size=8.5, color=GRAY, italic=True)

    heading(doc, 9, "CLIENT RESPONSIBILITIES")
    for responsibility in [
        "Provide CMS admin access, API tokens, or app installation permissions where required",
        "Provide brand guidelines, product information, target markets, preferred topics, and restricted claims",
        "Review and approve content within 3 business days unless another approval window is agreed",
        "Maintain active CMS, hosting, payment gateway, and third-party subscriptions",
        "Confirm whether content requires legal, medical, financial, or regulatory approval before publishing",
        "Notify Traffic Digital Solutions of product, pricing, offer, or policy changes that affect content accuracy",
    ]:
        bullet(doc, responsibility)

    heading(doc, 10, "TERMS AND CONDITIONS")
    terms = [
        ("1. Scope", "The scope is limited to the deliverables listed in this quotation and the selected plan. Any extra websites, languages, integrations, content volume, manual writing, or custom development must be quoted separately."),
        ("2. Subscription", "Monthly plans are prepaid and renew every 30 days unless cancelled according to the agreed notice period. Quarterly or annual billing may be offered by separate agreement."),
        ("3. Payment", "Invoices are due according to the payment terms on page 1. Traffic Digital Solutions may pause platform access, publishing, and support if payment is overdue by more than 15 calendar days."),
        ("4. Content Approval", "Client remains responsible for final review and approval of all content before publication, including factual claims, regulated claims, pricing, product availability, and legal compliance."),
        ("5. No Ranking Guarantee", "Search engines and AI platforms are third-party systems. Traffic Digital Solutions does not guarantee rankings, traffic, sales, AI mentions, citations, or inclusion in any AI-generated answer."),
        ("6. Intellectual Property", "Client owns final approved content created specifically for the Client after full payment. Traffic Digital Solutions retains ownership of the TDS GEO platform, software, workflows, prompts, templates, methods, and reusable components."),
        ("7. Data Protection", "Traffic Digital Solutions will process client data only for platform operation, content production, analytics, and support. Reasonable technical and organizational safeguards will be maintained."),
        ("8. Confidentiality", "Both parties agree to protect non-public business, technical, financial, customer, and strategy information disclosed during the engagement."),
        ("9. Limitation of Liability", "Total liability arising from this quotation shall not exceed the fees paid by the Client during the three months immediately preceding the claim, excluding liability that cannot be limited by law."),
        ("10. Termination", "Either party may terminate for material breach if the breach is not cured within 15 days of written notice. Upon termination, the Client must pay all amounts due for services delivered before termination."),
        ("11. Governing Law", "This quotation is governed by the laws of {GOVERNING_LAW}. Disputes will first be escalated for good-faith negotiation before legal proceedings or arbitration."),
    ]
    for label, desc in terms:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(5)
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(f"  {label}")
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = NAVY
        body(doc, desc, size=9.5, after=3)

    heading(doc, 11, "ACCEPTANCE")
    body(doc, "By signing below, both parties confirm acceptance of this quotation, selected plan, pricing, scope, and terms.", size=9.5, after=10)

    sig = doc.add_table(rows=1, cols=2)
    no_borders(sig)
    for col_idx, (title_text, lines) in enumerate([
        ("CLIENT", ["", "Name: ______________________________", "Title: ______________________________", "Date: ______________________________", "Signature: ______________________________", "Company Stamp:"]),
        ("TRAFFIC DIGITAL SOLUTIONS", ["", "Name: ______________________________", "Title: ______________________________", "Date: ______________________________", "Signature: ______________________________", "Company Stamp:"]),
    ]):
        cell = sig.cell(0, col_idx)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(title_text)
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = GOLD
        for line in lines:
            lp = cell.add_paragraph()
            lp.paragraph_format.space_after = Pt(3)
            r = lp.add_run(line)
            r.font.size = Pt(9.5)
            r.font.color.rgb = DARK_GRAY

    doc.add_paragraph()
    rule(doc, "838081", 6)
    footer = doc.add_paragraph()
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.paragraph_format.space_before = Pt(6)
    r = footer.add_run("Traffic Digital Solutions  -  Villa 125, Axis 80, 5th Settlement, Cairo, Egypt\n")
    r.font.size = Pt(7)
    r.font.color.rgb = GRAY
    r = footer.add_run("webdevelopment@trafficdigitalsolutions.com  -  trafficdigitalsolutions.com  -  +201271112396\n")
    r.font.size = Pt(7)
    r.font.color.rgb = GRAY
    r = footer.add_run("Commercial Registration: XXXXX  -  Tax ID: XXXXX  -  Quotation No: {NUMBER}")
    r.font.size = Pt(7)
    r.font.color.rgb = GRAY
    r.italic = True

    doc.save(OUTPUT_PATH)
    print(f"TDS GEO Empire Quotation saved to: {OUTPUT_PATH}")
    print(f"File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")


if __name__ == "__main__":
    create_document()
