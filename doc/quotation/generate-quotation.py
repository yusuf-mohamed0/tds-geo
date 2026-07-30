#!/usr/bin/env python3
"""Generate a polished TDS GEO Quotation as .docx"""

from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
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

LOGO_PATH = "/root/tds-geo/assets/logos/tds-geo-black.png"
OUTPUT_PATH = "/root/tds-geo/doc/quotation/TDS-GEO-Quotation.docx"


def set_cell_shading(cell, color):
    """Set cell background color."""
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color}"/>')
    cell._tc.get_or_add_tcPr().append(shading)


def set_cell_border(cell, **kwargs):
    """Set cell borders."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = parse_xml(f'<w:tcBorders {nsdecls("w")}></w:tcBorders>')
    for edge, val in kwargs.items():
        element = parse_xml(
            f'<w:{edge} {nsdecls("w")} w:val="{val.get("val", "single")}" '
            f'w:sz="{val.get("sz", "4")}" w:space="0" '
            f'w:color="{val.get("color", "171414")}"/>'
        )
        tcBorders.append(element)
    tcPr.append(tcBorders)


def add_horizontal_rule(doc, color=ORANGE, width_pt=2):
    """Add a decorative horizontal line."""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    pPr = p._p.get_or_add_pPr()
    pBdr = parse_xml(
        f'<w:pBdr {nsdecls("w")}>'
        f'  <w:bottom w:val="single" w:sz="{width_pt * 8}" w:space="1" w:color="{color}"/>'
        f'</w:pBdr>'
    )
    pPr.append(pBdr)
    return p


def create_document():
    doc = Document()

    # ─── Page Setup ─────────────────────────────────────
    for section in doc.sections:
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(1.5)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    # ─── Styles ─────────────────────────────────────────
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(10.5)
    font.color.rgb = DARK_GRAY
    style.paragraph_format.space_after = Pt(6)
    style.paragraph_format.line_spacing = 1.15

    # ─── HEADER: Logo + Company Info ────────────────────
    header_table = doc.add_table(rows=1, cols=2)
    header_table.alignment = WD_TABLE_ALIGNMENT.LEFT

    # Left cell: Logo
    logo_cell = header_table.cell(0, 0)
    logo_cell.width = Cm(4.5)
    if os.path.exists(LOGO_PATH):
        logo_par = logo_cell.paragraphs[0]
        logo_par.alignment = WD_ALIGN_PARAGRAPH.LEFT
        run = logo_par.add_run()
        run.add_picture(LOGO_PATH, width=Cm(4.0))

    # Right cell: Company name + details
    info_cell = header_table.cell(0, 1)
    info_cell.width = Cm(11.5)
    info_par = info_cell.paragraphs[0]
    info_par.alignment = WD_ALIGN_PARAGRAPH.RIGHT

    run = info_par.add_run("TDS GEO")
    run.bold = True
    run.font.size = Pt(18)
    run.font.color.rgb = BLACK

    info_par2 = info_cell.add_paragraph()
    info_par2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = info_par2.add_run("AI-Powered Content & SEO Platform\n")
    run.font.size = Pt(9)
    run.font.color.rgb = GRAY
    run = info_par2.add_run("Commercial Registration: XXXXX | Tax ID: XXXXX\n")
    run.font.size = Pt(8)
    run.font.color.rgb = GRAY
    run = info_par2.add_run("hello@tdsgeo.com | tdsgeo.com")
    run.font.size = Pt(8)
    run.font.color.rgb = GRAY

    # Remove table borders
    tbl = header_table._tbl
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

    # Decorative line after header
    add_horizontal_rule(doc, ORANGE, 3)

    # ─── TITLE SECTION ──────────────────────────────────
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(18)
    title.paragraph_format.space_after = Pt(4)
    run = title.add_run("QUOTATION")
    run.bold = True
    run.font.size = Pt(28)
    run.font.color.rgb = BLACK
    run.font.name = 'Calibri Light'

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(6)
    run = subtitle.add_run("عرض سعر")
    run.font.size = Pt(16)
    run.font.color.rgb = GRAY

    # Quote number + date
    quote_info = doc.add_paragraph()
    quote_info.alignment = WD_ALIGN_PARAGRAPH.CENTER
    quote_info.paragraph_format.space_after = Pt(12)
    run = quote_info.add_run("QUO-{NUMBER}  •  Issued: {DATE}  •  Valid: {VALID_UNTIL}")
    run.font.size = Pt(9)
    run.font.color.rgb = GRAY

    add_horizontal_rule(doc, ORANGE, 2)

    # ─── CLIENT + PROJECT INFO ──────────────────────────
    info_table = doc.add_table(rows=2, cols=2)
    info_table.alignment = WD_TABLE_ALIGNMENT.LEFT

    # Remove table borders
    tbl2 = info_table._tbl
    tblPr2 = tbl2.tblPr if tbl2.tblPr is not None else parse_xml(f'<w:tblPr {nsdecls("w")}/>')
    borders2 = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'</w:tblBorders>'
    )
    tblPr2.append(borders2)

    # Row 0: Prepared For | Project
    cell_left = info_table.cell(0, 0)
    p = cell_left.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("PREPARED FOR")
    run.bold = True
    run.font.size = Pt(8)
    run.font.color.rgb = ORANGE
    run2 = cell_left.add_paragraph()
    run2b = run2.add_run("{CLIENT_NAME}\n{CLIENT_CONTACT}\n{CLIENT_EMAIL}")
    run2b.font.size = Pt(10)
    run2b.font.color.rgb = BLACK

    cell_right = info_table.cell(0, 1)
    p = cell_right.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("PROJECT")
    run.bold = True
    run.font.size = Pt(8)
    run.font.color.rgb = ORANGE
    run2 = cell_right.add_paragraph()
    run2b = run2.add_run("{PROJECT_NAME}\n{PROJECT_TYPE}")
    run2b.font.size = Pt(10)
    run2b.font.color.rgb = BLACK

    # Row 1: Payment Terms | Currency
    cell_left2 = info_table.cell(1, 0)
    p = cell_left2.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("PAYMENT TERMS")
    run.bold = True
    run.font.size = Pt(8)
    run.font.color.rgb = ORANGE
    run2 = cell_left2.add_paragraph()
    run2b = run2.add_run("{PAYMENT_TERMS}")
    run2b.font.size = Pt(10)
    run2b.font.color.rgb = BLACK

    cell_right2 = info_table.cell(1, 1)
    p = cell_right2.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("CURRENCY")
    run.bold = True
    run.font.size = Pt(8)
    run.font.color.rgb = ORANGE
    run2 = cell_right2.add_paragraph()
    run2b = run2.add_run("{CURRENCY}")
    run2b.font.size = Pt(10)
    run2b.font.color.rgb = BLACK

    doc.add_paragraph()  # spacer

    # ─── LINE ITEMS TABLE ───────────────────────────────
    add_horizontal_rule(doc, ORANGE, 1)

    table_label = doc.add_paragraph()
    table_label.paragraph_format.space_before = Pt(10)
    table_label.paragraph_format.space_after = Pt(4)
    run = table_label.add_run("SERVICES & PRICING")
    run.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = NAVY
    run.font.name = 'Calibri Light'

    # Create pricing table
    items = [
        ("#", "DESCRIPTION / الوصف", "QTY", "UNIT PRICE", "TOTAL"),
        ("1", "TDS GEO — Starter (Monthly)\nاشتراك شهري — باقة المبتدئين", "1", "$29.00", "$29.00"),
        ("2", "TDS GEO — Professional (Monthly)\nاشتراك شهري — باقة الاحترافية", "1", "$79.00", "$79.00"),
        ("3", "Setup & Onboarding\nالإعداد والتشغيل الأولي", "1", "$1,000.00", "$1,000.00"),
        ("4", "Content — Extra Articles (×5)\nمحتوى إضافي — مقالات", "5", "$15.00", "$75.00"),
    ]

    table = doc.add_table(rows=len(items), cols=5)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    # Set column widths
    widths = [Cm(1.0), Cm(9.0), Cm(2.0), Cm(3.0), Cm(3.0)]
    for i, width in enumerate(widths):
        for row in table.rows:
            row.cells[i].width = width

    for row_idx, item in enumerate(items):
        for col_idx, text in enumerate(item):
            cell = table.cell(row_idx, col_idx)
            p = cell.paragraphs[0]

            if row_idx == 0:  # Header row
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col_idx != 1 else WD_ALIGN_PARAGRAPH.LEFT
                set_cell_shading(cell, "171414")
                run = p.add_run(text)
                run.bold = True
                run.font.size = Pt(8)
                run.font.color.rgb = WHITE
                run.font.name = 'Calibri'
            else:
                if col_idx == 0:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                elif col_idx == 1:
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                else:
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT

                run = p.add_run(text)
                if col_idx == 1:
                    run.font.size = Pt(9)
                elif col_idx == 4:
                    run.bold = True
                    run.font.size = Pt(9)
                    run.font.color.rgb = BLACK
                else:
                    run.font.size = Pt(9)

                run.font.color.rgb = DARK_GRAY if col_idx != 4 else BLACK

            # Cell padding
            p.paragraph_format.space_before = Pt(3)
            p.paragraph_format.space_after = Pt(3)

    # Totals row
    total_row = table.add_row()
    for ci in range(5):
        cell = total_row.cells[ci]
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(3)
        if ci < 3:
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            if ci == 2:
                run = p.add_run("TOTAL")
                run.bold = True
                run.font.size = Pt(10)
                run.font.color.rgb = BLACK
        elif ci == 3:
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            run = p.add_run("$1,183.00")
            run.font.size = Pt(9)
            run.font.color.rgb = GRAY
        elif ci == 4:
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            set_cell_shading(cell, "171414")
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            run = p.add_run("$1,183.00")
            run.bold = True
            run.font.size = Pt(11)
            run.font.color.rgb = WHITE

    # Add VAT note
    vat_note = doc.add_paragraph()
    vat_note.paragraph_format.space_before = Pt(4)
    run = vat_note.add_run("* VAT (14%) will be added where applicable.  \n* All prices in USD unless otherwise agreed.")
    run.font.size = Pt(8)
    run.font.color.rgb = GRAY
    run.italic = True

    # ─── TERMS & CONDITIONS (SIMPLIFIED) ─────────────────
    add_horizontal_rule(doc, ORANGE, 1)

    terms_label = doc.add_paragraph()
    terms_label.paragraph_format.space_before = Pt(12)
    run = terms_label.add_run("TERMS & CONDITIONS")
    run.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = NAVY
    run.font.name = 'Calibri Light'

    terms = [
        ("Term", "Minimum 3-month commitment. Auto-renews monthly unless 30-day cancellation notice is given."),
        ("Payment", "Invoices are due within 15 days. Late payments incur 2% monthly interest."),
        ("Content Ownership", "You own everything we generate for you. We own our platform and technology."),
        ("Confidentiality", "Your data and business information stay strictly confidential — always."),
        ("Results", "We deliver our best work, but search rankings depend on many factors and are never guaranteed."),
        ("Liability", "Our total liability is capped at the fees you paid in the last 12 months."),
        ("Termination", "Either party can terminate for material breach with 15 days' written notice."),
    ]

    for label, description in terms:
        term_p = doc.add_paragraph()
        term_p.paragraph_format.space_after = Pt(4)
        term_p.paragraph_format.space_before = Pt(2)

        run = term_p.add_run(f"{label}:  ")
        run.bold = True
        run.font.size = Pt(9)
        run.font.color.rgb = NAVY

        run2 = term_p.add_run(description)
        run2.font.size = Pt(9)
        run2.font.color.rgb = DARK_GRAY

    # Governing law
    law_p = doc.add_paragraph()
    law_p.paragraph_format.space_before = Pt(4)
    run = law_p.add_run("Governing Law: ")
    run.bold = True
    run.font.size = Pt(9)
    run.font.color.rgb = NAVY
    run2 = law_p.add_run("This quotation is governed by the laws of [Egypt / UAE / Jurisdiction].")
    run2.font.size = Pt(9)
    run2.font.color.rgb = DARK_GRAY

    # ─── SIGNATURE SECTION ──────────────────────────────
    add_horizontal_rule(doc, ORANGE, 1)

    sig_label = doc.add_paragraph()
    sig_label.paragraph_format.space_before = Pt(12)
    sig_label.paragraph_format.space_after = Pt(8)
    run = sig_label.add_run("SIGNATURE & ACCEPTANCE")
    run.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = NAVY
    run.font.name = 'Calibri Light'

    # Two-column signature
    sig_table = doc.add_table(rows=1, cols=2)
    sig_table.alignment = WD_TABLE_ALIGNMENT.CENTER

    # Remove table borders
    tbl3 = sig_table._tbl
    tblPr3 = tbl3.tblPr if tbl3.tblPr is not None else parse_xml(f'<w:tblPr {nsdecls("w")}/>')
    borders3 = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'  <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'</w:tblBorders>'
    )
    tblPr3.append(borders3)

    # Client column
    client_cell = sig_table.cell(0, 0)
    p = client_cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("CLIENT")
    run.bold = True
    run.font.size = Pt(9)
    run.font.color.rgb = ORANGE
    for line in ["Name: _______________________", "Title: _______________________", "Date: _______________________", "Signature: _______________________"]:
        lp = client_cell.add_paragraph()
        lp.paragraph_format.space_after = Pt(4)
        run = lp.add_run(line)
        run.font.size = Pt(9)
        run.font.color.rgb = DARK_GRAY
    stamp = client_cell.add_paragraph()
    run = stamp.add_run("Company Stamp:")
    run.font.size = Pt(9)
    run.font.color.rgb = GRAY
    run.italic = True

    # Provider column
    provider_cell = sig_table.cell(0, 1)
    p = provider_cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("TDS GEO")
    run.bold = True
    run.font.size = Pt(9)
    run.font.color.rgb = ORANGE
    for line in ["Name: _______________________", "Title: _______________________", "Date: _______________________", "Signature: _______________________"]:
        lp = provider_cell.add_paragraph()
        lp.paragraph_format.space_after = Pt(4)
        run = lp.add_run(line)
        run.font.size = Pt(9)
        run.font.color.rgb = DARK_GRAY
    stamp = provider_cell.add_paragraph()
    run = stamp.add_run("Company Stamp:")
    run.font.size = Pt(9)
    run.font.color.rgb = GRAY
    run.italic = True

    # ─── FOOTER ─────────────────────────────────────────
    doc.add_paragraph()  # spacer

    footer_line = add_horizontal_rule(doc, GRAY, 1)

    footer = doc.add_paragraph()
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.paragraph_format.space_before = Pt(6)
    run = footer.add_run("TDS GEO  •  Commercial Reg: XXXXX  •  Tax ID: XXXXX  •  hello@tdsgeo.com  •  tdsgeo.com\n")
    run.font.size = Pt(7)
    run.font.color.rgb = GRAY
    run2 = footer.add_run("This quotation is a legally binding offer. Acceptance creates a binding agreement between the parties.")
    run2.font.size = Pt(7)
    run2.font.color.rgb = GRAY
    run2.italic = True

    # ─── SAVE ────────────────────────────────────────────
    doc.save(OUTPUT_PATH)
    print(f"✅ Quotation saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    create_document()
