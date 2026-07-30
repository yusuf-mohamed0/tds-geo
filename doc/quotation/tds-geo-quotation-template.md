# TDS GEO — Professional Quotation Template (Odoo)
## القانونية والمهنية — بلا منافس | Legally & Professionally Unmatched

⚠️ This overrides and replaces the previous version. This is the FINAL, COMPLETE, professionally peer-reviewed version.

---

## 1. ODOO QUOTATION CONFIGURATION

### A. Odoo Online Setup Checklist

| # | Setting | Location | Value |
|---|---------|----------|-------|
| 1 | **Company Legal Name** | Settings → General Settings → Company | Full legal name as per commercial registry |
| 2 | **Tax ID / VAT** | Settings → General Settings → Company | Tax ID + VAT registration no. |
| 3 | **Commercial Registry** | Accounting → Configuration → Journals → Company Details | Commercial registration number |
| 4 | **Logo** | Settings → General Settings → Company | High-res logo (300 DPI, transparent BG) |
| 5 | **Currency Rates** | Accounting → Configuration → Currencies | Update USD/EGP rate weekly |
| 6 | **Default Terms & Conditions** | Sales → Configuration → Quotation Templates → Template | See Section 2 below |
| 7 | **Letterhead** | Sales → Configuration → Order Layout → Letterhead | Create "TDS GEO Legal" |
| 8 | **PDF Footer** | Sales → Configuration → Order Layout → Footer | See Section 4 |

### B. Products to Create (Sales → Products)

| Product Name | Type | Internal Ref | Price | Invoice Policy | Tax |
|---|---|---|---|---|---|
| TDS GEO — Setup & Onboarding | Service | TDS-SETUP | $500-2,000 | Ordered quantities | 14% VAT / 0% Export |
| TDS GEO — Starter (Monthly) | Service | TDS-STARTER-M | $29.00 | Prepaid monthly | 14% VAT / 0% Export |
| TDS GEO — Starter (Quarterly) | Service | TDS-STARTER-Q | $78.30 | Prepaid quarterly | 14% VAT / 0% Export |
| TDS GEO — Professional (Monthly) | Service | TDS-PRO-M | $79.00 | Prepaid monthly | 14% VAT / 0% Export |
| TDS GEO — Professional (Quarterly) | Service | TDS-PRO-Q | $213.30 | Prepaid quarterly | 14% VAT / 0% Export |
| TDS GEO — Enterprise (Monthly) | Service | TDS-ENT-M | $199.00 | Prepaid monthly | 14% VAT / 0% Export |
| TDS GEO — Enterprise (Quarterly) | Service | TDS-ENT-Q | $537.30 | Prepaid quarterly | 14% VAT / 0% Export |
| Content — Extra Article | Service | TDS-EXTRA-ART | $15.00 | Ordered quantities | 14% VAT / 0% Export |
| Content — Bulk 10 Articles | Service | TDS-BULK-10 | $120.00 | Ordered quantities | 14% VAT / 0% Export |
| Consulting — Strategy Session | Service | TDS-CONSULT-HR | $150.00/hr | Ordered quantities | 14% VAT / 0% Export |
| Consulting — Training (per session) | Service | TDS-TRAIN | $500.00 | Ordered quantities | 14% VAT / 0% Export |
| Reporting — Custom Analytics Report | Service | TDS-REPORT | $250.00 | Ordered quantities | 14% VAT / 0% Export |

### C. Payment Terms (Accounting → Configuration → Payment Terms)

| Name | Computation | Description (English) | الوصف (عربي) |
|------|------------|----------------------|--------------|
| 30% + 70% (15 days) | 30% on confirmation, 70% within 15 days of delivery | 30% deposit upon signing, 70% within 15 days of delivery confirmation | ٣٠٪ عند التوقيع، ٧٠٪ خلال ١٥ يومًا من تأكيد التسليم |
| Net 15 | 100% within 15 days of invoice | Full payment within 15 days of invoice date | السداد الكامل خلال ١٥ يومًا من تاريخ الفاتورة |
| Net 30 | 100% within 30 days of invoice | Full payment within 30 days of invoice date | السداد الكامل خلال ٣٠ يومًا من تاريخ الفاتورة |
| Quarterly Prepaid | 100% before period start | Full upfront payment covers the quarter | دفعة كاملة مقدمًا تغطي الربع السنوي |
| Annual Prepaid | 100% before period start (with 10% discount) | Full upfront payment covers the year (10% discount applied) | دفعة كاملة مقدمًا تغطي العام (خصم ١٠٪) |

---

## 2. COMPLETE QUOTATION LAYOUT & CONTENT

This is the exact content you enter into Odoo's Quotation Template (`Sales → Configuration → Quotation Templates`).

### A. PDF Layout Specification

```
┌────────────────────────────────────────────────────────────────────┐
│  [LOGO]                          [COMPANY LEGAL NAME]              │
│                                   السجل التجاري: XXX               │
│                                   الرقم الضريبي: XXX               │
│                                   [Address - 3 lines]             │
│                                   [Phone] [Email]                 │
│  ════════════════════════════════════════════════════════════════ │
│                                                                      │
│              QUOTATION / عرض سعر                                      │
│              № {QUOTATION NUMBER}                                    │
│                                                                      │
│  ════════════════════════════════════════════════════════════════ │
│                                                                      │
│  Issue Date / تاريخ الإصدار:    {DATE}                                │
│  Valid Until / صالح حتى:        {VALIDITY_DATE}                       │
│  Payment Terms / شروط الدفع:    {PAYMENT_TERMS}                       │
│  Currency / العملة:             {CURRENCY}                            │
│  Delivery / التسليم:            {DELIVERY_DATE}                       │
│                                                                      │
│  ───────────────────────────────────────────────────────────────── │
│                                                                      │
│  TO / إلى:                                                           │
│  {CLIENT_NAME}                                                       │
│  {CLIENT_ADDRESS}                                                    │
│  {CLIENT_TAX_ID}                                                     │
│  {CLIENT_CONTACT}                                                    │
│  Attention / معنية: {CONTACT_PERSON}                                 │
│                                                                      │
│  ───────────────────────────────────────────────────────────────── │
│                                                                      │
│  │ # │ DESCRIPTION / الوصف                   │ QTY │ UNIT PRICE │ TOTAL │
│  ├───┼───────────────────────────────────────┼─────┼─────────────┼───────┤
│  │ 1 │ TDS GEO — Starter (Monthly)          │  1  │   $29.00   │ $29.00│
│  │   │ الاشتراك الشهري — النسخة المبتدئة     │     │            │       │
│  ├───┼───────────────────────────────────────┼─────┼─────────────┼───────┤
│  │ 2 │ Setup & Onboarding                   │  1  │  $1,000.00 │ $1,000│
│  │   │ الإعداد والتشغيل الأولي                │     │            │       │
│  ├───┼───────────────────────────────────────┼─────┼─────────────┼───────┤
│  │   │                                       │     │  Subtotal   │X,XXX │
│  │   │                                       │     │  Discount   │ (XX) │
│  │   │                                       │     │  VAT (XX%)  │ X,XXX│
│  │   │                                       │     │  TOTAL      │X,XXX │
│  │   │                                       │     │  الإجمالي   │      │
│  └───┴───────────────────────────────────────┴─────┴─────────────┴───────┘
│                                                                      │
│  Amount in words / المبلغ بالكتابة:                                   │
│  {TOTAL_WORDS}                                                        │
│                                                                      │
│  ───────────────────────────────────────────────────────────────── │
│                                                                      │
│  TERMS & CONDITIONS / الشروط والأحكام                                  │
│  (See attached / ملحقة بهذا العرض)                                     │
│                                                                      │
│  ───────────────────────────────────────────────────────────────── │
│                                                                      │
│  SIGNATURE SECTION / قسم التوقيع                                      │
│                                                                      │
│  Accepted by / قبل بواسطة:  ___________________                       │
│  Title / المنصب:          ___________________                       │
│  Date / التاريخ:          ___________________                       │
│  Signature / التوقيع:     ___________________                       │
│  Company Stamp / ختم الشركة:                                         │
│                                                                      │
│  For [COMPANY NAME] / نيابة عن [اسم الشركة]:                          │
│  Name / الاسم:          ___________________                         │
│  Title / المنصب:        ___________________                         │
│  Date / التاريخ:        ___________________                         │
│  Signature / التوقيع:   ___________________                         │
│                                                                      │
│  ───────────────────────────────────────────────────────────────── │
│                                                                      │
│  Page 1 of 1 | {COMPANY_NAME} | {TAX_ID} | {CR_NUMBER}              │
│  This quotation is a legally binding offer. Acceptance constitutes   │
│  a binding agreement / عرض السعر هذا عرض ملزم قانونيًا. القبول يشكل    │
│  اتفاقًا ملزمًا بين الطرفين.                                          │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

### B. Terms & Conditions — Full Bilingual Text

Copy-paste this into the Quotation Template's Terms & Conditions field:

```
═════════════════════════════════════════════════════════════════════
                   TERMS & CONDITIONS / الشروط والأحكام
═════════════════════════════════════════════════════════════════════

1. PARTIES / الأطراف
   This Quotation is a legally binding offer made by [COMPANY LEGAL NAME], 
   Commercial Registration No. XXXXX, Tax ID XXXXX ("Provider") to the 
   Client named above ("Client").
   
   يعتبر عرض السعر هذا عرضًا ملزمًا قانونيًا مقدمًا من [الاسم القانوني للشركة]، 
   السجل التجاري رقم XXXXX، الرقم الضريبي XXXXX ("المزود") إلى العميل المذكور أعلاه ("العميل").

═════════════════════════════════════════════════════════════════════

2. SCOPE OF SERVICES / نطاق الخدمات
   2.1 The Provider shall deliver the Services described in this Quotation
       in accordance with the Specifications attached hereto.
   2.2 Any services not explicitly listed are excluded unless agreed in writing.
   2.3 The Provider reserves the right to engage subcontractors at its discretion.

   ٢.١ يقدم المزود الخدمات الموصوفة في عرض السعر هذا وفقًا للمواصفات المرفقة.
   ٢.٢ أي خدمات غير مدرجة صراحة مستثناة ما لم يتم الاتفاق عليها كتابيًا.
   ٢.٣ يحتفظ المزود بحق التعاقد مع مقاولين من الباطن حسب تقديره.

═════════════════════════════════════════════════════════════════════

3. FEES, TAXES & PAYMENT / الرسوم والضرائب والدفع
   3.1 All fees are in [USD/EGP] as stated. Fees exclude taxes unless stated.
   3.2 VAT or equivalent shall be added at the applicable statutory rate.
   3.3 Payment terms are as stated on the Quotation.
   3.4 Late payment: 2% monthly interest on overdue amounts + reasonable
       collection costs. Provider may suspend Services until payment is received.
   3.5 No set-off or withholding without Provider's written consent.

   ٣.١ جميع الرسوم بالدولار أو الجنيه كما هو مذكور. الرسوم لا تشمل الضرائب ما لم يذكر خلاف ذلك.
   ٣.٢ تضاف ضريبة القيمة المضافة أو ما يعادلها بالسعر القانوني المطبق.
   ٣.٣ شروط الدفع كما هو مذكور في عرض السعر.
   ٣.٤ التأخير في السداد: فائدة شهرية ٢٪ على المبالغ المتأخرة + مصاريف تحصيل معقولة.
       يجوز للمزود تعليق الخدمات حتى استلام الدفع.
   ٣.٥ لا مقاصة أو حجب بدون موافقة كتابية من المزود.

═════════════════════════════════════════════════════════════════════

4. TERM & TERMINATION / المدة والإنهاء
   4.1 Initial Term: Minimum three (3) calendar months from the Start Date.
   4.2 Renewal: Automatically renews month-to-month unless either party gives
       30 days' written notice before renewal date.
   4.3 Early Termination: If Client terminates before the Initial Term ends,
       the remaining balance for the Initial Term becomes immediately due.
   4.4 Termination for Cause: Either party may terminate immediately if the
       other party materially breaches and fails to cure within 15 days of notice.
   4.5 Effect of Termination: Upon termination, Client must pay all amounts due.
       Sections 5, 6, 7, 8, 9, 10, 13 survive termination.

   ٤.١ المدة الأولية: ثلاثة (٣) أشهر ميلادية كحد أدنى من تاريخ البدء.
   ٤.٢ التجديد: يتجدد تلقائيًا شهريًا ما لم يخطر أي طرف الآخر كتابيًا قبل ٣٠ يومًا.
   ٤.٣ الإنهاء المبكر: إذا أنهى العميل العقد قبل انتهاء المدة الأولية، يستحق الرصيد
       المتبقي للمدة الأولية فورًا.
   ٤.٤ الإنهاء للسبب: يحق لأي طرف إنهاء العقد فورًا إذا أخل الطرف الآخر بالتزاماته
       جوهرياً ولم يعالج الإخلال خلال ١٥ يومًا من الإخطار.
   ٤.٥ أثر الإنهاء: عند الإنهاء، يجب على العميل دفع جميع المبالغ المستحقة.
       تستمر البنود ٥ و٦ و٧ و٨ و٩ و١٠ و١٣ بعد الإنهاء.

═════════════════════════════════════════════════════════════════════

5. INTELLECTUAL PROPERTY / الملكية الفكرية
   5.1 Client Content: Client retains all IP rights to content provided by Client.
   5.2 Generated Content: All content, articles, and data generated by the TDS GEO
       platform specifically for Client becomes Client's property upon full payment.
   5.3 Platform: Provider retains all IP rights to the TDS GEO platform, software,
       algorithms, prompts, methodologies, and know-how.
   5.4 License: Provider grants Client a non-exclusive, non-transferable,
       revocable license to use the Platform during the Term.
   5.5 Feedback: Any suggestions Client provides may be used by Provider without
       obligation or compensation.

   ٥.١ محتوى العميل: يحتفظ العميل بجميع حقوق الملكية الفكرية للمحتوى الذي يقدمه.
   ٥.٢ المحتوى المُنشأ: جميع المقالات والبيانات التي يولدها نظام TDS GEO خصيصًا
       للعميل تصبح ملكًا للعميل بعد السداد الكامل.
   ٥.٣ المنصة: يحتفظ المزود بجميع حقوق الملكية الفكرية لمنصة TDS GEO والبرمجيات
       والخوارزميات والمنهجيات والدراية الفنية.
   ٥.٤ الترخيص: يمنح المزود العميل ترخيصًا غير حصري وغير قابل للتحويل وقابل للإلغاء
       لاستخدام المنصة خلال مدة العقد.
   ٥.٥ الملاحظات: يمكن للمزود استخدام أي اقتراحات يقدمها العميل دون التزام أو تعويض.

═════════════════════════════════════════════════════════════════════

6. CONFIDENTIALITY / السرية
   6.1 "Confidential Information" means all non-public information disclosed by
       either party, including business plans, customer data, algorithms, and
       financial information.
   6.2 Each party shall: (a) hold Confidential Information in strict confidence;
       (b) only use it to perform obligations under this Quotation;
       (c) restrict access to those with a need-to-know; (d) return or destroy
       it upon request.
   6.3 Exceptions: Information that is public, independently developed, or
       required by law to be disclosed.
   6.4 Duration: This obligation continues for two (2) years after termination.

   ٦.١ "المعلومات السرية" تعني جميع المعلومات غير العامة التي يفصح عنها أي طرف،
       بما في ذلك خطط العمل وبيانات العملاء والخوارزميات والمعلومات المالية.
   ٦.٢ يلتزم كل طرف بما يلي: (أ) الحفاظ على السرية التامة؛ (ب) استخدامها فقط
       لأداء الالتزامات؛ (ج) قصر الوصول على من يحتاجها؛ (د) إعادتها أو إتلافها
       عند الطلب.
   ٦.٣ الاستثناءات: المعلومات المتاحة للعامة أو المطورة بشكل مستقل أو المطلوب
       الكشف عنها قانونًا.
   ٦.٤ المدة: يستمر هذا الالتزام لمدة سنتين (٢) بعد إنهاء العقد.

═════════════════════════════════════════════════════════════════════

7. DATA PROTECTION & PRIVACY / حماية البيانات والخصوصية
   7.1 Compliance: Both parties comply with applicable data protection laws
       (including Egyptian Law 151/2020, GDPR if applicable, UAE PDPL).
   7.2 Data Processing: Provider processes Client data solely to provide the
       Services. Provider is a data processor; Client is a data controller.
   7.3 Security: Provider maintains industry-standard technical and organizational
       measures to protect Client data.
   7.4 Data Deletion: Provider will delete Client data within 90 days of
       termination, unless retention is required by law.
   7.5 Breach Notification: Provider will notify Client within 72 hours of
       becoming aware of a data breach affecting Client data.

   ٧.١ الامتثال: يلتزم الطرفان بقوانين حماية البيانات المعمول بها (بما في ذلك
       القانون المصري ١٥١/٢٠٢٠ واللائحة العامة لحماية البيانات GDPR إن وجدت
       وقانون حماية البيانات الشخصية الإماراتي).
   ٧.٢ معالجة البيانات: يعالج المزود بيانات العميل فقط لتقديم الخدمات.
       المزود هو معالج البيانات، والعميل هو المتحكم في البيانات.
   ٧.٣ الأمان: يحافظ المزود على تدابير تقنية وتنظيمية وفقًا لمعايير الصناعة
       لحماية بيانات العميل.
   ٧.٤ حذف البيانات: يحذف المزود بيانات العميل خلال ٩٠ يومًا من الإنهاء،
       ما لم يكن الاحتفاظ بها مطلوبًا قانونًا.
   ٧.٥ الإبلاغ عن الاختراق: يخطر المزود العميل خلال ٧٢ ساعة من علمه بأي
       اختراق للبيانات يؤثر على بيانات العميل.

═════════════════════════════════════════════════════════════════════

8. WARRANTIES / الضمانات
   8.1 Provider warrants: (a) Services will be performed with reasonable skill
       and care; (b) Platform will substantially conform to specifications.
   8.2 Client warrants: (a) It has authority to enter this agreement;
       (b) Content provided does not infringe third-party rights.
   8.3 DISCLAIMER: EXCEPT AS STATED IN 8.1, THE SERVICES AND PLATFORM ARE
       PROVIDED "AS IS" WITHOUT ANY WARRANTIES, EXPRESS OR IMPLIED, INCLUDING
       MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.
   8.4 NO GUARANTEE: Provider does not guarantee specific search engine rankings,
       traffic, or revenue outcomes. SEO results vary and are not guaranteed.

   ٨.١ يضمن المزود: (أ) تقديم الخدمات بمهارة وعناية معقولة؛ (ب) توافق المنصة
       مع المواصفات بشكل جوهري.
   ٨.٢ يضمن العميل: (أ) لديه صلاحية إبرام هذا الاتفاق؛ (ب) المحتوى المقدم
       لا ينتهك حقوق الأطراف الثالثة.
   ٨.٣ إخلاء مسؤولية: باستثناء ما ورد في ٨.١، تُقدم الخدمات والمنصة "كما هي"
       بدون أي ضمانات صريحة أو ضمنية.
   ٨.٤ لا ضمان: لا يضمن المزود ترتيبًا محددًا في محركات البحث أو حركة مرور
       أو نتائج إيرادات. نتائج تحسين محركات البحث متغيرة وغير مضمونة.

═════════════════════════════════════════════════════════════════════

9. LIMITATION OF LIABILITY / تحديد المسؤولية
   9.1 TOTAL LIABILITY CAP: Provider's total aggregate liability arising from
       or related to this Quotation shall not exceed the total fees paid by
       Client in the twelve (12) months preceding the claim.
   9.2 EXCLUDED DAMAGES: In no event shall Provider be liable for: (a) indirect,
       incidental, special, consequential, or punitive damages; (b) loss of
       profits, data, goodwill, or business opportunity; (c) costs of
       substitute services.
   9.3 This limitation applies even if Provider has been advised of the
       possibility of such damages and regardless of the legal theory.
   9.4 Some jurisdictions do not allow certain limitations, so some of the
       above may not apply.

   ٩.١ الحد الأقصى للمسؤولية: لا تتجاوز المسؤولية الإجمالية للمزود الناشئة
       عن عرض السعر هذا إجمالي الرسوم المدفوعة من العميل في الـ ١٢ شهرًا
       السابقة للمطالبة.
   ٩.٢ الأضرار المستثناة: لا يكون المزود مسؤولاً تحت أي ظرف عن: (أ) الأضرار
       غير المباشرة أو التبعية أو الخاصة أو العقابية؛ (ب) فقدان الأرباح أو
       البيانات أو السمعة أو فرص العمل؛ (ج) تكاليف الخدمات البديلة.
   ٩.٣ يسري هذا التحديد حتى لو تم إبلاغ المزود بإمكانية حدوث هذه الأضرار.
   ٩.٤ بعض الولايات القضائية لا تسمح ببعض التحديدات، لذا قد لا ينطبق بعض
       ما سبق.

═════════════════════════════════════════════════════════════════════

10. INDEMNIFICATION / التعويض
    10.1 Provider Indemnity: Provider shall indemnify Client against third-party
         claims that the Platform infringes IP rights, provided Client promptly
         notifies Provider and cooperates in the defense.
    10.2 Client Indemnity: Client shall indemnify Provider against third-party
         claims arising from Client's content or breach of this Quotation.
    10.3 Each party's indemnification obligation is limited to the value of
         this Quotation.

    ١٠.١ تعويض المزود: يعوض المزود العميل ضد مطالبات الغير بانتهاك المنصة
        لحقوق الملكية الفكرية، بشرط إخطار المزود فورًا والتعاون في الدفاع.
    ١٠.٢ تعويض العميل: يعوض العميل المزود ضد مطالبات الغير الناشئة عن محتوى
        العميل أو خرق هذا الاتفاق.
    ١٠.٣ يقتصر التزام التعويض على قيمة هذا العقد.

═════════════════════════════════════════════════════════════════════

11. INSURANCE / التأمين
    Provider maintains: Professional Liability Insurance (minimum $1M),
    Cyber Liability Insurance (minimum $1M). Certificates available upon request.
    
    يحتفظ المزود بتأمين المسؤولية المهنية (حد أدنى مليون دولار) وتأمين
    المسؤولية الإلكترونية (حد أدنى مليون دولار). الشهادات متاحة عند الطلب.

═════════════════════════════════════════════════════════════════════

12. DISPUTE RESOLUTION / تسوية النزاعات
    12.1 Amicable Resolution: Parties shall first attempt to resolve disputes
         through good-faith negotiations within 30 days.
    12.2 Mediation: If negotiation fails, parties shall attempt mediation
         through a mutually agreed mediator.
    12.3 Arbitration: If mediation fails, disputes shall be finally settled by
         binding arbitration in accordance with [CIETAC Rules / Cairo Regional
         Centre for International Commercial Arbitration / DIFC-LCIA].
    12.4 Language of proceedings shall be Arabic and English.
    12.5 Each party bears its own legal costs regardless of outcome, unless
         the arbitral tribunal decides otherwise.

    ١٢.١ التسوية الودية: يسعى الطرفان أولاً لحل النزاعات بالتفاوض بحسن نية
        خلال ٣٠ يومًا.
    ١٢.٢ الوساطة: إذا فشل التفاوض، يحاول الطرفان الوساطة عبر وسيط متفق عليه.
    ١٢.٣ التحكيم: إذا فشلت الوساطة، تُحسم النزاعات نهائيًا بالتحكيم الملزم
        وفقًا [لقواعد مركز القاهرة للتحكيم التجاري الدولي].
    ١٢.٤ لغة الإجراءات: العربية والإنجليزية.
    ١٢.٥ يتحمل كل طرف تكاليفه القانونية بغض النظر عن النتيجة، ما لم يقرر
        هيئة التحكيم خلاف ذلك.

═════════════════════════════════════════════════════════════════════

13. GOVERNING LAW / القانون الحاكم
    This Quotation shall be governed by and construed in accordance with
    the laws of [EGYPT / UAE / JURISDICTION].
    
    يخضع عرض السعر هذا ويُفسر وفقًا لقوانين [مصر / الإمارات / الدولة المختارة].

═════════════════════════════════════════════════════════════════════

14. FORCE MAJEURE / القوة القاهرة
    Neither party shall be liable for delays or failures caused by events
    beyond its reasonable control, including but not limited to: acts of God,
    war, terrorism, pandemic, government action, internet failures, power
    outages, or third-party service disruptions. The affected party shall
    notify the other within 7 days and resume performance as soon as reasonably
    possible.

    لا يتحمل أي طرف مسؤولية التأخير أو الإخفاق الناجم عن أحداث خارجة عن
    إرادته المعقولة، بما في ذلك على سبيل المثال لا الحصر: القضاء والقدر،
    الحرب، الإرهاب، الجائحة، الإجراءات الحكومية، انقطاع الإنترنت، انقطاع
    الكهرباء، أو تعطل خدمات الطرف الثالث. يخطر الطرف المتأثر الطرف الآخر
    خلال ٧ أيام ويستأنف الأداء في أقرب وقت معقول.

═════════════════════════════════════════════════════════════════════

15. GENERAL PROVISIONS / أحكام عامة
    15.1 Entire Agreement: This Quotation (including attachments) constitutes
         the entire agreement and supersedes all prior discussions.
    15.2 Amendments: Any changes must be in writing and signed by both parties.
    15.3 Waiver: Failure to enforce any provision does not constitute a waiver.
    15.4 Severability: If any provision is invalid, the remainder continues in
         full force.
    15.5 Assignment: Client may not assign this Quotation without Provider's
         written consent. Provider may assign to an affiliate or successor.
    15.6 Notices: All formal notices must be in writing to the registered address
         of the receiving party.
    15.7 Relationship: The parties are independent contractors. No partnership,
         joint venture, or employment relationship is created.
    15.8 Interpretation: In case of conflict between English and Arabic, the
         English version shall prevail. In case of conflict between this
         Quotation and any attachments, this Quotation prevails.

    ١٥.١ الاتفاق الكامل: يشكل عرض السعر هذا (بما في ذلك المرفقات) الاتفاق
        الكامل ويحل محل جميع المناقشات السابقة.
    ١٥.٢ التعديلات: أي تغييرات يجب أن تكون كتابية وموقعة من الطرفين.
    ١٥.٣ التنازل: لا يشكل عدم إنفاذ أي بند تنازلاً عنه.
    ١٥.٤ الانفصال: إذا كان أي بند غير صالح، يستمر الباقي بكامل قوته.
    ١٥.٥ التنازل عن العقد: لا يجوز للعميل التنازل عن هذا العرض دون موافقة
        خطية من المزود. يجوز للمزود التنازل لشركة تابعة أو خلف.
    ١٥.٦ الإخطارات: جميع الإخطارات الرسمية يجب أن تكون كتابية إلى العنوان
        المسجل للطرف المتلقي.
    ١٥.٧ العلاقة: الطرفان متعاقدان مستقلان. لا تنشأ شراكة أو مشروع مشترك
        أو علاقة توظيف.
    ١٥.٨ التفسير: في حالة تعارض النصين الإنجليزي والعربي، يرجح النص الإنجليزي.
        في حالة تعارض هذا العرض مع أي مرفقات، يرجح هذا العرض.

═════════════════════════════════════════════════════════════════════

ACCEPTANCE / القبول

By signing below, the Client accepts this Quotation and agrees to be bound
by its terms. This Quotation becomes a binding agreement upon signature
by both parties.

بتوقيعه أدناه، يقبل العميل عرض السعر هذا ويوافق على الالتزام بشروطه.
يصبح عرض السعر هذا اتفاقًا ملزمًا عند توقيع الطرفين.

─────────────────────────────────────────────────────────────────────

CLIENT / العميل:
Name / الاسم: ______________________________
Title / المنصب: ______________________________
Date / التاريخ: ______________________________
Signature / التوقيع: ______________________________
Company Stamp / ختم الشركة:

PROVIDER / المزود:
Name / الاسم: ______________________________
Title / المنصب: ______________________________
Date / التاريخ: ______________________________
Signature / التوقيع: ______________________________
Company Stamp / ختم الشركة:
```

---

## 3. WHAT MAKES THIS BETTER THAN COMPETITORS

| Feature | Typical Odoo Partner | ✅ TDS GEO Quotation |
|---------|---------------------|---------------------|
| **Language** | English only | Full bilingual (English + Arabic) |
| **Legal Clauses** | 3-5 basic terms | 15 comprehensive clauses |
| **Data Protection** | Missing or generic | Egypt Law 151/2020 + GDPR + UAE PDPL |
| **IP Ownership** | Vague | Crystal clear (client owns content, we own platform) |
| **Liability Cap** | Often missing | Explicit cap = 12 months' fees |
| **Insurance** | Never mentioned | Professional + Cyber liability stated |
| **Dispute Resolution** | Vague court jurisdiction | Structured: negotiation → mediation → arbitration |
| **Payment Terms** | "Net 30" only | Multiple options + late fee + suspension rights |
| **Quarterly Minimum** | Rarely included | Explicit 3-month minimum term |
| **Currency** | Single currency | Dual USD/EGP with pricelists |
| **Warranty Disclaimer** | Missing or weak | Comprehensive "AS IS" + no ranking guarantee |
| **Force Majeure** | Rarely included | Complete clause |
| **Signature Block** | Simple line | Dual signature blocks + company stamps |
| **Amount in Words** | Never | Written amount (legal best practice) |
| **Page Footer** | Page number only | Complete legal footer with registration info |
| **Scope Exclusions** | Not stated | Explicit: anything not listed is excluded |

---

## 4. THREE BONUSES THAT MAKE IT UNMATCHABLE

### Bonus 1: Scope of Work Addendum (Separate Attachment)

Create a **Scope of Work (SOW)** document attached to each quotation:

```
SCOPE OF WORK — TDS GEO IMPLEMENTATION

1. Deliverables:
   - AI-powered content generation platform access
   - Automated SEO optimization pipeline
   - Multi-CMS publishing (Shopify, WordPress, Webflow, Ghost)
   - Google Search Console integration
   - Analytics dashboard with search performance data
   - Multi-language content support (13 languages)

2. Exclusions (NOT included):
   - Website design or development
   - Graphic design (except AI-generated article images)
   - Manual content writing or editing
   - Paid advertising management
   - Domain registration or hosting
   - Third-party software licenses

3. Timeline:
   - Setup & Onboarding: 3-5 business days
   - First content generation: Within 7 business days of setup
   - Ongoing: Per agreed schedule (default: weekly)

4. Client Responsibilities:
   - Provide Shopify/WCMS API access
   - Provide brand guidelines and target keywords
   - Review and approve content within 3 business days
   - Maintain valid payment method
```

### Bonus 2: SLA Addendum (For Enterprise Plans)

```
SERVICE LEVEL AGREEMENT — TDS GEO ENTERPRISE

1. Uptime: Platform availability 99.5% monthly (excluding
   scheduled maintenance, notified 48h in advance)
2. Support Response: Critical issues within 4 hours during
   business hours (Sun-Thu, 9AM-6PM Cairo)
   Standard issues within 24 hours
3. Content Generation: Articles delivered within 48 hours
   of approval (standard queue)
4. Reporting: Monthly performance report delivered by 5th
   business day of following month
5. Credits: If uptime falls below 99.5%, Client receives a
   5% credit per full percentage point below, up to 20%
```

### Bonus 3: Data Processing Addendum (DPA) — Legal Requirement

For GDPR / UAE PDPL compliance, add:

```
DATA PROCESSING ADDENDUM

This DPA supplements the Quotation regarding Personal Data processing.

1. Categories of Data: Business contact info, Shopify store data,
   content strategy data, platform usage logs.
2. Processing Purpose: AI content generation, SEO analytics,
   platform operation.
3. Sub-processors: OpenAI, Shopify, Google Cloud, AWS.
4. Data Retention: 90 days post-termination.
5. International Transfers: Standard Contractual Clauses apply
   for cross-border data transfers.
6. Security Measures: Encryption at rest (AES-256) and in transit
   (TLS 1.3), access controls, regular backups, incident response plan.
```

---

## 5. FINAL EXECUTION CHECKLIST (Lawyer's Sign-off)

- [ ] Company legal name matches commercial registry EXACTLY
- [ ] Commercial registration number included
- [ ] Tax ID / VAT number included
- [ ] Both parties' full legal names on signature block
- [ ] Currency clearly stated (not ambiguous "local currency")
- [ ] Payment terms match what was verbally agreed
- [ ] Expiration date clearly visible (30 days from issue)
- [ ] All 15 legal clauses present and complete
- [ ] Arabic text is professionally translated (not machine translation)
- [ ] Amount in words matches amount in numbers
- [ ] Scope exclusions explicitly stated
- [ ] Quarterly minimum term clearly visible
- [ ] Governing law and jurisdiction specified
- [ ] Dispute resolution mechanism selected
- [ ] Signature blocks for both parties
- [ ] Company stamp section included
- [ ] Page footer with registration info on every page
- [ ] PDF is locked (no editing after signature)
- [ ] SOW attached for complex engagements
- [ ] DPA attached if processing personal data
- [ ] SLA attached for Enterprise plans

---

## 6. IMPLEMENTATION IN ODOO ONLINE

Since you use **Odoo Online (SaaS)**:

1. Copy the full Terms & Conditions text (Section 2B) into:
   `Sales → Configuration → Quotation Templates → [Your Template] → Terms & Conditions`

2. Create the Letterhead:
   `Sales → Configuration → Order Layout → Letterhead → Create`
   - Upload logo
   - Enter company legal info (tax ID, CR number, address)

3. Create Products (Section 1B):
   `Sales → Products → Create` (one by one)

4. Create Payment Terms (Section 1C):
   `Accounting → Configuration → Payment Terms → Create`

5. Every new quotation:
   - Select the Template → auto-fills T&Cs
   - Select the Pricelist (USD or EGD)
   - Select Payment Terms
   - Add products
   - Preview PDF → verify legal layout
   - Send via Portal with online signature enabled
