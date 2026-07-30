#!/usr/bin/env python3
"""Generate a polished TDS GEO Quotation as .docx — Full Version"""

from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml
import os

# ─── TDS Brand Colors ──────────────────────────────────────
BLACK = RGBColor(0x17, 0x14, 0x14)
ORANGE = RGBColor(0xFC, 0xB9, 0x00)
NAVY = RGBColor(0x14, 0x24, 0x44)
CREAM_BG = RGBColor(0xFC, 0xF6, 0xF2)
GRAY = RGBColor(0x83, 0x80, 0x81)
BLUE = RGBColor(0x76, 0x9A, 0xCC)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
DARK_GRAY = RGBColor(0x3D, 0x3B, 0x3B)
LIGHT_GRAY = RGBColor(0xF3, 0xF0, 0xED)

LOGO_PATH = "/root/tds-geo/assets/logos/tds-geo-black.png"
OUTPUT_PATH = "/root/tds-geo/doc/quotation/TDS-GEO-Quotation.docx"


def set_cell_shading(cell, color_hex):
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading)


def remove_table_borders(table):
    tbl = table._tbl
    tblPr = tbl.tblPr if tbl.tblPr is not None else parse_xml(f'<w:tblPr {nsdecls("w")}/>')
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)


def add_rule(doc, color_hex="FCB900", sz=12):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(4)
    pPr = p._p.get_or_add_pPr()
    pBdr = parse_xml(
        f'<w:pBdr {nsdecls("w")}>'
        f'  <w:bottom w:val="single" w:sz="{sz}" w:space="1" w:color="{color_hex}"/>'
        f'</w:pBdr>'
    )
    pPr.append(pBdr)
    return p


def add_section_heading(doc, number, title_ar, title_en):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(f"{number}.  {title_en}")
    run.bold = True
    run.font.size = Pt(13)
    run.font.color.rgb = NAVY
    run.font.name = 'Calibri Light'
    run2 = p.add_run(f"\n{title_ar}")
    run2.font.size = Pt(9)
    run2.font.color.rgb = GRAY
    run2.italic = True
    add_rule(doc, "FCB900", 8)
    return p


def add_body(doc, text, size=10, color=DARK_GRAY, bold=False, italic=False, space_after=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.bold = bold
    run.italic = italic
    return p


def add_bullet(doc, text, sub=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    prefix = "    ◦  " if sub else "  •  "
    p.paragraph_format.left_indent = Cm(0.5) if not sub else Cm(1.0)
    run = p.add_run(f"{prefix}{text}")
    run.font.size = Pt(9.5)
    run.font.color.rgb = DARK_GRAY
    return p


def create_document():
    doc = Document()

    for section in doc.sections:
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(1.5)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(10.5)
    font.color.rgb = DARK_GRAY
    style.paragraph_format.space_after = Pt(6)
    style.paragraph_format.line_spacing = 1.15

    # ═══════════════════════════════════════════════════════
    #  HEADER: Logo + Company
    # ═══════════════════════════════════════════════════════
    hdr = doc.add_table(rows=1, cols=2)
    hdr.alignment = WD_TABLE_ALIGNMENT.LEFT
    remove_table_borders(hdr)

    logo_cell = hdr.cell(0, 0)
    logo_cell.width = Cm(4.5)
    if os.path.exists(LOGO_PATH):
        lp = logo_cell.paragraphs[0]
        lp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = lp.add_run()
        r.add_picture(LOGO_PATH, width=Cm(4.0))

    info_cell = hdr.cell(0, 1)
    info_cell.width = Cm(11.5)
    ip = info_cell.paragraphs[0]
    ip.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = ip.add_run("TDS GEO")
    r.bold = True; r.font.size = Pt(20); r.font.color.rgb = BLACK

    ip2 = info_cell.add_paragraph()
    ip2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = ip2.add_run("AI-Powered Content & SEO Platform\n")
    r.font.size = Pt(9); r.font.color.rgb = GRAY
    r = ip2.add_run("Commercial Reg: XXXXX  |  Tax ID: XXXXX\n")
    r.font.size = Pt(8); r.font.color.rgb = GRAY
    r = ip2.add_run("hello@tdsgeo.com  |  tdsgeo.com")
    r.font.size = Pt(8); r.font.color.rgb = GRAY

    add_rule(doc, "FCB900", 20)

    # ═══════════════════════════════════════════════════════
    #  TITLE
    # ═══════════════════════════════════════════════════════
    ti = doc.add_paragraph()
    ti.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ti.paragraph_format.space_before = Pt(20)
    ti.paragraph_format.space_after = Pt(2)
    r = ti.add_run("PROFESSIONAL SERVICES QUOTATION")
    r.bold = True; r.font.size = Pt(26); r.font.color.rgb = BLACK; r.font.name = 'Calibri Light'

    ti2 = doc.add_paragraph()
    ti2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ti2.paragraph_format.space_after = Pt(4)
    r = ti2.add_run("عرض خدمات احترافي")
    r.font.size = Pt(14); r.font.color.rgb = GRAY

    qinfo = doc.add_paragraph()
    qinfo.alignment = WD_ALIGN_PARAGRAPH.CENTER
    qinfo.paragraph_format.space_after = Pt(8)
    r = qinfo.add_run("Quotation No: QUO-{NUMBER}     |     Issued: {ISSUE_DATE}     |     Valid Until: {VALID_UNTIL}")
    r.font.size = Pt(9); r.font.color.rgb = GRAY

    add_rule(doc, "FCB900", 14)

    # ═══════════════════════════════════════════════════════
    #  CLIENT + PROJECT OVERVIEW (2×2 table)
    # ═══════════════════════════════════════════════════════
    info = doc.add_table(rows=2, cols=2)
    info.alignment = WD_TABLE_ALIGNMENT.LEFT
    remove_table_borders(info)

    pairs = [
        (0, 0, "PREPARED FOR / معدة لـ", ["{CLIENT_NAME}", "{CLIENT_ADDRESS}", "{CLIENT_CONTACT}", "{CLIENT_EMAIL}"]),
        (0, 1, "BILLING DETAILS / تفاصيل الفوترة", ["Currency: {CURRENCY}", "Payment Terms: {PAYMENT_TERMS}", "Tax Treatment: {TAX_TREATMENT}"]),
        (1, 0, "PROJECT / المشروع", ["{PROJECT_NAME}", "{PROJECT_DESCRIPTION}", "Start Date: {START_DATE}", "Duration: {DURATION}"]),
        (1, 1, "DELIVERY / التسليم", ["Format: {DELIVERY_FORMAT}", "Schedule: {DELIVERY_SCHEDULE}", "Handover: {HANDOVER_METHOD}"]),
    ]

    for row_idx, col_idx, label, lines in pairs:
        cell = info.cell(row_idx, col_idx)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(label)
        r.bold = True; r.font.size = Pt(7.5); r.font.color.rgb = ORANGE
        for line in lines:
            lp = cell.add_paragraph()
            lp.paragraph_format.space_after = Pt(1)
            r = lp.add_run(line)
            r.font.size = Pt(10); r.font.color.rgb = BLACK

    add_rule(doc, "FCB900", 10)

    # ═══════════════════════════════════════════════════════
    #  1. PROJECT OVERVIEW
    # ═══════════════════════════════════════════════════════
    add_section_heading(doc, 1, "نظرة عامة على المشروع", "PROJECT OVERVIEW")

    add_body(doc, "{PROJECT_OVERVIEW_TEXT}", size=10)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run("Objectives / الأهداف:")
    r.bold = True; r.font.size = Pt(9.5); r.font.color.rgb = NAVY

    for obj in [
        "{OBJECTIVE_1}",
        "{OBJECTIVE_2}",
        "{OBJECTIVE_3}",
    ]:
        add_bullet(doc, obj)

    # ═══════════════════════════════════════════════════════
    #  2. SCOPE OF SERVICES
    # ═══════════════════════════════════════════════════════
    add_section_heading(doc, 2, "نطاق الخدمات", "SCOPE OF SERVICES")

    add_body(doc, "We will deliver the following services as part of this engagement:", size=10, bold=False)

    services = [
        ("AI-Powered Content Generation",
         "Automated creation of SEO-optimized articles tailored to your brand voice, target keywords, and audience. Each article follows our EEAT Content Framework for quality and topical authority.",
         "توليد محتوى آلي بجودة احترافية محسّن لمحركات البحث ومتوافق مع صوت علامتك التجارية وجمهورك المستهدف."),
        ("SEO Optimization Pipeline",
         "Full on-page SEO including meta tags, headings, keyword placement, internal linking, schema markup, and readability scoring.",
         "تحسين شامل لمحركات البحث يشمل البيانات الوصفية والعناوين والكلمات المفتاحية والربط الداخلي وترميز المخطط."),
        ("Multi-Platform Publishing",
         "Direct publishing to Shopify, WordPress, Webflow, or Ghost via API integration. Scheduled publishing with approval workflow.",
         "نشر مباشر على منصات متعددة عبر واجهة API مع جدولة النشر وسير عمل الموافقة."),
        ("Google Search Console Integration",
         "Performance tracking: impressions, clicks, CTR, and position data. Sync and analyze your search presence in real-time.",
         "تتبع أداء البحث: مرات الظهور والنقرات ونسبة النقر إلى الظهور والترتيب مع مزامنة وتحليل آني."),
        ("Analytics Dashboard",
         "Real-time reporting dashboard with metric cards, charts, top queries table, and exportable reports.",
         "لوحة تحليلات آنية ببطاقات المقاييس والرسوم البيانية وجدول أفضل الاستعلامات وتقارير قابلة للتصدير."),
        ("Multi-Language Support (Up to 13 Languages)",
         "Content generation and SEO optimization in Arabic, English, French, German, Spanish, Portuguese, Italian, Russian, Turkish, Japanese, Chinese, Korean, and Dutch.",
         "توليد المحتوى وتحسين محركات البحث بـ ١٣ لغة تشمل العربية والإنجليزية والفرنسية والألمانية واليابانية والصينية وغيرها."),
    ]

    for title_en, desc_en, desc_ar in services:
        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(8)
        sp.paragraph_format.space_after = Pt(2)
        r = sp.add_run(f"  {title_en}")
        r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY

        add_body(doc, desc_en, size=9.5)
        add_body(doc, desc_ar, size=9, color=GRAY, italic=True, space_after=4)

    # ═══════════════════════════════════════════════════════
    #  3. EXCLUSIONS
    # ═══════════════════════════════════════════════════════
    add_section_heading(doc, 3, "ما لا يشملہ العرض", "EXCLUSIONS")

    add_body(doc, "The following are explicitly NOT included unless separately agreed in writing:", size=10)
    for ex in [
        "Website design, development, or hosting",
        "Graphic design or branding (except AI-generated article images)",
        "Manual content writing, editing, or proofreading",
        "Paid advertising management (Google Ads, Social Ads)",
        "Domain registration or email hosting",
        "Third-party software licenses or subscriptions",
        "Video production or editing",
    ]:
        add_bullet(doc, ex)

    # ═══════════════════════════════════════════════════════
    #  4. TIMELINE & MILESTONES
    # ═══════════════════════════════════════════════════════
    add_section_heading(doc, 4, "الجدول الزمني والمراحل", "TIMELINE & MILESTONES")

    milestones = [
        ("Phase 1: Setup & Onboarding", "Days 1-5", "Account creation, platform configuration, API integrations, brand profile setup, keyword research initialization."),
        ("Phase 2: First Content Batch", "Days 6-12", "Initial content generation (up to 5 articles), review & revision cycle, publishing pipeline test."),
        ("Phase 3: Ongoing Delivery", "Weekly", "Scheduled content generation per agreed cadence, continuous optimization, monthly performance reports."),
    ]

    for phase, dur, desc in milestones:
        mp = doc.add_paragraph()
        mp.paragraph_format.space_before = Pt(6)
        mp.paragraph_format.space_after = Pt(2)
        r = mp.add_run(f"  {phase}")
        r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        r2 = mp.add_run(f"  —  {dur}")
        r2.font.size = Pt(9); r2.font.color.rgb = ORANGE; r2.bold = True
        add_body(doc, desc, size=9.5, space_after=4)

    add_body(doc, "Total estimated duration: {DURATION} from start date. Timeline may be adjusted based on client feedback cycles and scope changes.", size=9.5, italic=True)

    # ═══════════════════════════════════════════════════════
    #  5. CLIENT RESPONSIBILITIES
    # ═══════════════════════════════════════════════════════
    add_section_heading(doc, 5, "مسؤوليات العميل", "CLIENT RESPONSIBILITIES")

    add_body(doc, "To ensure successful delivery, the Client agrees to:", size=10)
    for resp in [
        "Provide API access to CMS platforms (Shopify, WordPress, etc.)",
        "Share brand guidelines, target keywords, and content preferences",
        "Review and approve generated content within 3 business days of delivery",
        "Provide timely feedback on content quality and direction",
        "Maintain a valid payment method and adhere to agreed payment terms",
        "Designate a point of contact for day-to-day coordination",
    ]:
        add_bullet(doc, resp)

    # ═══════════════════════════════════════════════════════
    #  6. INVESTMENT & PRICING
    # ═══════════════════════════════════════════════════════
    add_section_heading(doc, 6, "الاستثمار والأسعار", "INVESTMENT & PRICING")

    items = [
        ("#", "SERVICE / الخدمة", "QTY", "UNIT PRICE", "TOTAL"),
        ("1", "TDS GEO — Setup & Onboarding\nالإعداد والتشغيل الأولي", "1", "{SETUP_PRICE}", "{SETUP_TOTAL}"),
        ("2", "TDS GEO — {PLAN_NAME} ({BILLING_CYCLE})\n{PLAN_NAME_AR} — {BILLING_CYCLE_AR}", "{PLAN_QTY}", "{PLAN_UNIT_PRICE}", "{PLAN_TOTAL}"),
        ("3", "Content — Extra Article Pack (×{EXTRA_QTY})\nحزمة مقالات إضافية", "{EXTRA_QTY}", "{EXTRA_UNIT_PRICE}", "{EXTRA_TOTAL}"),
        ("4", "Consulting — Strategy Sessions ({CONSULT_HRS}h)\nجلسات استشارية استراتيجية", "{CONSULT_HRS}", "{CONSULT_RATE}", "{CONSULT_TOTAL}"),
    ]

    tbl = doc.add_table(rows=len(items), cols=5)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    widths = [Cm(1.0), Cm(8.5), Cm(2.0), Cm(3.0), Cm(3.5)]
    for i, w in enumerate(widths):
        for row in tbl.rows:
            row.cells[i].width = w

    for ri, row_data in enumerate(items):
        for ci, text in enumerate(row_data):
            cell = tbl.cell(ri, ci)
            p = cell.paragraphs[0]
            if ri == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER if ci != 1 else WD_ALIGN_PARAGRAPH.LEFT
                set_cell_shading(cell, "171414")
                r = p.add_run(text)
                r.bold = True; r.font.size = Pt(8); r.font.color.rgb = WHITE
            else:
                if ci == 0: p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                elif ci == 1: p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                else: p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                r = p.add_run(text)
                r.font.size = Pt(8.5)
                r.font.color.rgb = DARK_GRAY if ci != 4 else BLACK

            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)

    # Totals
    for extra_text, extra_price in [
        ("Subtotal / المجموع الفرعي", "{SUBTOTAL}"),
        ("Discount / الخصم ({DISCOUNT_PCT}%)", "({DISCOUNT_AMOUNT})"),
    ]:
        tr = tbl.add_row()
        for ci in range(5):
            cell = tr.cells[ci]
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            if ci < 3:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                if ci == 2:
                    r = p.add_run(extra_text)
                    r.bold = True; r.font.size = Pt(9); r.font.color.rgb = NAVY
            elif ci == 3:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            elif ci == 4:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                r = p.add_run(extra_price)
                r.font.size = Pt(9); r.font.color.rgb = GRAY

    # Total
    total_row = tbl.add_row()
    for ci in range(5):
        cell = total_row.cells[ci]
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(4)
        if ci < 3:
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            if ci == 2:
                r = p.add_run("TOTAL DUE / الإجمالي المستحق")
                r.bold = True; r.font.size = Pt(10); r.font.color.rgb = WHITE
                set_cell_shading(cell, "171414")
        elif ci == 4:
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            set_cell_shading(cell, "FCB900")
            r = p.add_run("{GRAND_TOTAL}")
            r.bold = True; r.font.size = Pt(13); r.font.color.rgb = BLACK
        elif ci == 3:
            r = p.add_run("{GRAND_TOTAL_CURRENCY}")
            r.font.size = Pt(9); r.font.color.rgb = GRAY

    vat = doc.add_paragraph()
    vat.paragraph_format.space_before = Pt(4)
    r = vat.add_run("VAT (14%) will be added where applicable. All prices in {CURRENCY} unless otherwise stated.  ")
    r.font.size = Pt(8); r.font.color.rgb = GRAY; r.italic = True
    r2 = vat.add_run("Quarterly prepaid plans include a 10% discount.")
    r2.font.size = Pt(8); r2.font.color.rgb = ORANGE; r2.bold = True

    # ═══════════════════════════════════════════════════════
    #  7. PAYMENT SCHEDULE
    # ═══════════════════════════════════════════════════════
    add_section_heading(doc, 7, "جدول السداد", "PAYMENT SCHEDULE")

    payment_options = [
        ("Option A — Upfront (Recommended)", "100% upon signing. Best value — includes 10% discount on annual plans."),
        ("Option B — 50/50 Split", "50% upon signing, 50% upon delivery confirmation."),
        ("Option C — 30/70 Split", "30% deposit upon signing, 70% within 15 days of delivery completion."),
        ("Option D — Net 15", "Full payment within 15 days of invoice date."),
        ("Option E — Net 30", "Full payment within 30 days of invoice date."),
    ]

    for label, desc in payment_options:
        pp = doc.add_paragraph()
        pp.paragraph_format.space_after = Pt(2)
        r = pp.add_run(f"  {label}")
        r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        add_body(doc, desc, size=9.5, space_after=4)

    add_body(doc, "Selected Payment Terms: {SELECTED_PAYMENT_TERMS}", size=10, bold=True, color=BLACK)

    # ═══════════════════════════════════════════════════════
    #  8. TERMS & CONDITIONS
    # ═══════════════════════════════════════════════════════
    add_section_heading(doc, 8, "الشروط والأحكام", "TERMS & CONDITIONS")

    terms_data = [
        ("1. Term",
         "The initial term is a minimum of three (3) calendar months from the start date. After the initial term, the agreement auto-renews monthly unless either party provides 30 days' written cancellation notice.",
         "المدة الأولية ثلاثة (3) أشهر ميلادية كحد أدنى. بعدها يتجدد العقد تلقائيًا شهريًا ما لم يخطر أي طرف الآخر كتابيًا قبل 30 يومًا."),
        ("2. Payment",
         "All fees are in the stated currency. Invoices are due per the agreed payment terms. Late payments incur 2% monthly interest on overdue amounts. Services may be suspended if payment is more than 15 days past due.",
         "جميع الرسوم بالعملة المذكورة. الفواتير مستحقة حسب شروط الدفع المتفق عليها. التأخير في السداد يستحق فائدة شهرية 2٪."),
        ("3. Content Ownership",
         "You own all content generated specifically for your brand upon full payment. We retain ownership of our platform, algorithms, and methodologies.",
         "أنت تملك جميع المحتويات المنشأة خصيصًا لعلامتك التجارية بعد السداد الكامل. نحن نحتفظ بملكية منصتنا وخوارزمياتنا."),
        ("4. Confidentiality",
         "All business information shared during this engagement is strictly confidential. We sign NDAs upon request.",
         "جميع معلومات العمل المتبادلة سرية تامة. نوقع اتفاقيات السرية عند الطلب."),
        ("5. Data Protection",
         "We comply with applicable data protection laws (Egypt Law 151/2020, GDPR, UAE PDPL). Your data is encrypted, access-controlled, and deleted within 90 days of contract end.",
         "نلتزم بقوانين حماية البيانات المعمول بها. بياناتك مشفرة ومحمية ويتم حذفها خلال 90 يومًا من انتهاء العقد."),
        ("6. No Guarantee of Rankings",
         "We deliver high-quality content and SEO best practices. However, search engine rankings depend on many factors beyond our control and are never guaranteed.",
         "نقدم محتوى عالي الجودة وأفضل ممارسات تحسين محركات البحث. لكن ترتيب البحث يعتمد على عوامل خارجة عن إرادتنا."),
        ("7. Liability",
         "Our total liability is capped at the total fees paid in the 12 months preceding any claim. We are not liable for indirect or consequential damages.",
         "مسؤوليتنا محدودة بإجمالي الرسوم المدفوعة في الـ 12 شهرًا السابقة. لسنا مسؤولين عن أضرار غير مباشرة."),
        ("8. Termination",
         "Either party may terminate for material breach with 15 days' written notice. Early termination before the minimum term ends requires payment of the remaining balance.",
         "لأي طرف إنهاء العقد للإخلال الجوهري بإخطار كتابي مدته 15 يومًا. الإنهاء المبكر يستدعي سداد الرصيد المتبقي."),
        ("9. Governing Law & Disputes",
         "This agreement is governed by the laws of {GOVERNING_LAW}. Disputes are resolved through amicable negotiation, then mediation, then binding arbitration if needed.",
         "يخضع هذا الاتفاق لقوانين {GOVERNING_LAW_AR}. تُحل النزاعات بالتفاوض ثم الوساطة ثم التحكيم الملزم إذا لزم الأمر."),
    ]

    for label, en, ar in terms_data:
        tp = doc.add_paragraph()
        tp.paragraph_format.space_before = Pt(6)
        tp.paragraph_format.space_after = Pt(2)
        r = tp.add_run(f"  {label}")
        r.bold = True; r.font.size = Pt(10); r.font.color.rgb = NAVY
        add_body(doc, en, size=9.5, space_after=2)
        add_body(doc, ar, size=9, color=GRAY, italic=True, space_after=4)

    # ═══════════════════════════════════════════════════════
    #  9. ACCEPTANCE & SIGNATURE
    # ═══════════════════════════════════════════════════════
    add_section_heading(doc, 9, "القبول والتوقيع", "ACCEPTANCE & SIGNATURE")

    accept_text = doc.add_paragraph()
    accept_text.paragraph_format.space_after = Pt(8)
    r = accept_text.add_run(
        "By signing below, both parties acknowledge and agree to the terms of this quotation. "
        "This quotation becomes a legally binding agreement upon signature by both parties.\n\n"
        "بالتوقيع أدناه، يقر الطرفان ويوافقان على شروط عرض السعر هذا. يصبح عرض السعر هذا اتفاقًا ملزمًا قانونيًا عند توقيع الطرفين."
    )
    r.font.size = Pt(9.5); r.font.color.rgb = DARK_GRAY

    sig = doc.add_table(rows=1, cols=2)
    sig.alignment = WD_TABLE_ALIGNMENT.CENTER
    remove_table_borders(sig)

    client_lines = [
        "CLIENT / العميل",
        "", "Name / الاسم: ______________________________",
        "Title / المنصب: ______________________________",
        "Date / التاريخ: ______________________________",
        "Signature / التوقيع: ______________________________",
        "Company Stamp / ختم الشركة:",
    ]
    provider_lines = [
        "TDS GEO / المزود",
        "", "Name / الاسم: ______________________________",
        "Title / المنصب: ______________________________",
        "Date / التاريخ: ______________________________",
        "Signature / التوقيع: ______________________________",
        "Company Stamp / ختم الشركة:",
    ]

    for col_idx, lines in enumerate([client_lines, provider_lines]):
        cell = sig.cell(0, col_idx)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(lines[0])
        r.bold = True; r.font.size = Pt(10); r.font.color.rgb = ORANGE
        for line in lines[1:]:
            lp = cell.add_paragraph()
            lp.paragraph_format.space_after = Pt(3)
            r = lp.add_run(line)
            r.font.size = Pt(9.5); r.font.color.rgb = DARK_GRAY

    # ═══════════════════════════════════════════════════════
    #  FOOTER
    # ═══════════════════════════════════════════════════════
    doc.add_paragraph()
    add_rule(doc, "838081", 6)

    ft = doc.add_paragraph()
    ft.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ft.paragraph_format.space_before = Pt(6)
    r = ft.add_run("TDS GEO  •  hello@tdsgeo.com  •  tdsgeo.com  •  Commercial Reg: XXXXX  •  Tax ID: XXXXX\n")
    r.font.size = Pt(7); r.font.color.rgb = GRAY
    r2 = ft.add_run("This quotation is a legally binding offer valid for 30 days from the issue date. ")
    r2.font.size = Pt(7); r2.font.color.rgb = GRAY; r2.italic = True
    r3 = ft.add_run("Quotation No: {NUMBER}  |  Page 1 of 1")
    r3.font.size = Pt(7); r3.font.color.rgb = GRAY

    # ─── SAVE ──────────────────────────────────────────
    doc.save(OUTPUT_PATH)
    print(f"Quotation saved to: {OUTPUT_PATH}")
    print(f"File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")


if __name__ == "__main__":
    create_document()
