import type { FallbackEntry } from "@/core/types";

/**
 * ClauseBridge fictional fallback-language library.
 *
 * Every entry was invented for this demonstration. Nothing here was retrieved
 * from a real contract, a legal database, or the web, and no entry is presented
 * as legally correct, safer, or preferable to the seeded language. The library
 * exists so the agent has an *authorized, bounded* set of alternative wording to
 * propose instead of generating legal language on its own.
 */

export const FALLBACK_LIBRARY_SOURCE = "ClauseBridge fictional demo library";

const entry = (
  id: string,
  clauseType: FallbackEntry["clauseType"],
  role: FallbackEntry["role"],
  label: string,
  note: string,
  text: string,
): FallbackEntry => ({
  id,
  clauseType,
  role,
  label,
  note,
  text,
  source: FALLBACK_LIBRARY_SOURCE,
});

export const FALLBACK_LIBRARY: readonly FallbackEntry[] = [
  // ---------------------------------------------------------------- liability
  entry(
    "fb-liability-customer-1",
    "liability",
    "customer",
    "Liability cap at 12 months of fees with carve-outs",
    "Customer-side alternative that raises the cap and removes the blanket application to every claim type.",
    "Except for the Excluded Claims described below, each party's total aggregate liability arising out of " +
      "or relating to this Agreement shall not exceed the total fees paid or payable by Customer in the " +
      "twelve (12) months immediately preceding the event giving rise to the claim. Neither party shall be " +
      "liable for indirect, incidental, special, consequential, or exemplary damages. “Excluded Claims” " +
      "means claims arising from a party's breach of its confidentiality obligations, a party's " +
      "indemnification obligations, Northstar's failure to maintain the security safeguards required by " +
      "this Agreement, or a party's gross negligence or willful misconduct, none of which are subject to " +
      "the foregoing cap.",
  ),
  entry(
    "fb-liability-neutral-1",
    "liability",
    "neutral",
    "Mutual cap, mutual exclusions",
    "Symmetric alternative that applies the same cap and the same exclusions to both parties.",
    "Each party's total aggregate liability arising out of or relating to this Agreement shall not exceed " +
      "the total fees paid or payable under the applicable Order Form in the twelve (12) months preceding " +
      "the claim. Neither party shall be liable for indirect, incidental, special, consequential, or " +
      "exemplary damages, or for loss of profits, revenue, or goodwill. The foregoing limitations do not " +
      "apply to either party's confidentiality breaches, indemnification obligations, or gross negligence " +
      "or willful misconduct.",
  ),
  entry(
    "fb-liability-vendor-1",
    "liability",
    "vendor",
    "Cap at fees paid, narrow carve-out",
    "Vendor-side alternative that concedes a single carve-out while keeping the cap tied to fees actually paid.",
    "Northstar's total aggregate liability arising out of or relating to this Agreement shall not exceed " +
      "the fees actually paid by Customer in the twelve (12) months preceding the event giving rise to the " +
      "claim. Northstar shall not be liable for indirect, incidental, special, consequential, or exemplary " +
      "damages. This limitation does not apply to Northstar's indemnification obligations under this " +
      "Agreement.",
  ),

  // ------------------------------------------------------------- termination
  entry(
    "fb-termination-customer-1",
    "termination",
    "customer",
    "Symmetric termination for convenience with pro-rata refund",
    "Customer-side alternative that mirrors the vendor's convenience right and shortens the non-renewal notice window.",
    "This Agreement begins on the Effective Date and continues for the Subscription Term stated in the " +
      "Order Form. The Subscription Term renews automatically for successive twelve (12) month periods " +
      "unless either party delivers written notice of non-renewal at least thirty (30) days before the end " +
      "of the then-current term. Either party may terminate this Agreement for convenience upon sixty (60) " +
      "days' written notice. Either party may terminate for the other's material breach that remains " +
      "uncured thirty (30) days after written notice. If Northstar terminates for convenience, or if " +
      "Customer terminates for Northstar's uncured material breach, Northstar shall refund any prepaid " +
      "fees covering the remainder of the then-current term on a pro-rata basis.",
  ),
  entry(
    "fb-termination-neutral-1",
    "termination",
    "neutral",
    "Mutual breach termination, no convenience right",
    "Symmetric alternative in which neither party may exit for convenience mid-term.",
    "This Agreement begins on the Effective Date and continues for the Subscription Term stated in the " +
      "Order Form, renewing for successive twelve (12) month periods unless either party gives written " +
      "notice of non-renewal at least thirty (30) days before the end of the then-current term. Either " +
      "party may terminate this Agreement upon the other party's material breach that remains uncured " +
      "thirty (30) days after written notice describing the breach in reasonable detail. Neither party may " +
      "terminate for convenience during a Subscription Term.",
  ),
  entry(
    "fb-termination-vendor-1",
    "termination",
    "vendor",
    "Vendor convenience preserved, notice extended",
    "Vendor-side alternative that keeps the convenience right but lengthens the notice period.",
    "This Agreement begins on the Effective Date and continues for the Subscription Term stated in the " +
      "Order Form, renewing automatically for successive twelve (12) month periods unless Customer " +
      "delivers written notice of non-renewal at least sixty (60) days before the end of the then-current " +
      "term. Northstar may terminate this Agreement for convenience upon ninety (90) days' written notice, " +
      "in which case Northstar shall refund prepaid fees for the unused portion of the term. Customer may " +
      "terminate for Northstar's uncured material breach following a thirty (30) day cure period.",
  ),

  // ---------------------------------------------------------- data retention
  entry(
    "fb-data_retention-customer-1",
    "data_retention",
    "customer",
    "Purpose-limited retention with certified deletion",
    "Customer-side alternative that removes secondary-use retention and adds an export window and deletion certificate.",
    "Northstar shall retain Customer Data only for so long as necessary to provide the Services to " +
      "Customer, and shall not use Customer Data for product improvement, analytics, or model training " +
      "without Customer's prior written consent. Upon expiration or termination of the Subscription Term, " +
      "Northstar shall make Customer Data available for export in a documented machine-readable format " +
      "for sixty (60) days. Northstar shall permanently delete Customer Data from production systems " +
      "within thirty (30) days after the end of that export period and from backup and archival systems " +
      "within ninety (90) days, and shall certify such deletion in writing upon Customer's request.",
  ),
  entry(
    "fb-data_retention-neutral-1",
    "data_retention",
    "neutral",
    "Defined retention window, de-identified data addressed",
    "Balanced alternative that fixes the retention period and states expressly how de-identified data is treated.",
    "Northstar shall retain Customer Data for the duration of the Subscription Term and for thirty (30) " +
      "days thereafter, during which Customer may export Customer Data in a machine-readable format. " +
      "Northstar shall thereafter delete Customer Data from production systems within thirty (30) days and " +
      "from backup systems in the ordinary course of its backup rotation, not to exceed one hundred eighty " +
      "(180) days. Northstar may retain aggregated data that has been de-identified such that it cannot " +
      "reasonably be associated with Customer or any individual, and shall not attempt to re-identify it.",
  ),

  // -------------------------------------------------------------- security
  entry(
    "fb-security-customer-1",
    "security",
    "customer",
    "Named safeguards, subprocessor notice, 72-hour breach notice",
    "Customer-side alternative that replaces the vendor's sole-discretion standard with defined obligations.",
    "Northstar shall maintain administrative, physical, and technical safeguards consistent with " +
      "recognized industry frameworks, including encryption of Customer Data in transit and at rest, " +
      "role-based access control, and annual third-party security assessment. Northstar shall maintain a " +
      "current list of subprocessors and shall give Customer at least thirty (30) days' notice before " +
      "adding a subprocessor, during which Customer may object on reasonable security grounds. Northstar " +
      "shall notify Customer without undue delay and in no event later than seventy-two (72) hours after " +
      "becoming aware of any unauthorized access to Customer Data, and shall cooperate with Customer's " +
      "reasonable investigation. Customer may review Northstar's most recent security assessment report " +
      "once per year under confidentiality.",
  ),

  // ------------------------------------------------------- confidentiality
  entry(
    "fb-confidentiality-customer-1",
    "confidentiality",
    "customer",
    "Survival extended, marketing use removed",
    "Customer-side alternative that lengthens the survival period and removes the publicity permission.",
    "Each party may disclose Confidential Information to the other. The receiving party shall protect such " +
      "information using no less than the degree of care it applies to its own confidential information " +
      "and in no event less than reasonable care, and shall not disclose it except to those of its " +
      "employees, affiliates, contractors, and professional advisers who have a need to know and who are " +
      "bound by confidentiality obligations no less protective than these. These obligations continue for " +
      "five (5) years after the date of disclosure and, with respect to information constituting a trade " +
      "secret, for so long as it remains a trade secret. Neither party may use the other's name, logo, or " +
      "the existence of this Agreement in marketing materials without prior written consent.",
  ),

  // -------------------------------------------------------------- payment
  entry(
    "fb-payment-customer-1",
    "payment",
    "customer",
    "Net 45, disputed amounts protected, capped uplift",
    "Customer-side alternative that lengthens payment terms and bounds renewal increases.",
    "Customer shall pay all undisputed fees specified in each Order Form within forty-five (45) days of " +
      "receipt of a correct invoice. Customer may withhold amounts it disputes in good faith, provided it " +
      "notifies Northstar of the dispute before the due date and pays all undisputed amounts. Overdue " +
      "undisputed amounts accrue interest at one percent (1%) per month. Northstar may increase fees for a " +
      "renewal term by no more than five percent (5%) over the prior term, and only upon at least sixty " +
      "(60) days' notice before the renewal date. Northstar may suspend the Services for non-payment only " +
      "after giving Customer written notice and a ten (10) day opportunity to cure.",
  ),

  // -------------------------------------------------------------- warranty
  entry(
    "fb-warranty-customer-1",
    "warranty",
    "customer",
    "Limited performance warranty with repair-or-refund remedy",
    "Customer-side alternative that adds a bounded affirmative warranty in place of a pure disclaimer.",
    "Northstar warrants that the Services will perform materially in accordance with the then-current " +
      "documentation and that it will not materially decrease the overall functionality of the Services " +
      "during a Subscription Term. Northstar further warrants that it will provide the Services in a " +
      "professional and workmanlike manner. If the Services fail to conform to this warranty, Northstar " +
      "shall use commercially reasonable efforts to correct the non-conformity; if it fails to do so " +
      "within thirty (30) days of Customer's written notice, Customer may terminate the affected Order " +
      "Form and receive a pro-rata refund of prepaid fees. EXCEPT AS EXPRESSLY SET FORTH IN THIS SECTION, " +
      "THE SERVICES ARE PROVIDED WITHOUT WARRANTY OF ANY KIND, AND NORTHSTAR DISCLAIMS THE IMPLIED " +
      "WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.",
  ),

  // --------------------------------------------------------- governing law
  entry(
    "fb-governing_law-neutral-1",
    "governing_law",
    "neutral",
    "Neutral forum, neutral arbitrator selection",
    "Balanced alternative in which neither party unilaterally selects the arbitrator.",
    "This Agreement is governed by the laws of the State of Delaware, without regard to its conflict of " +
      "laws principles. Any dispute arising out of or relating to this Agreement shall be resolved by " +
      "binding arbitration before a single arbitrator selected by mutual agreement of the parties or, " +
      "failing agreement within thirty (30) days, appointed by the administering institution under its " +
      "rules. The arbitration shall be seated in a location mutually agreed by the parties. Each party " +
      "shall bear its own attorneys' fees and an equal share of the arbitrator's fees. Nothing in this " +
      "Section prevents either party from seeking injunctive relief in a court of competent jurisdiction " +
      "to protect its intellectual property or Confidential Information.",
  ),
  entry(
    "fb-governing_law-customer-1",
    "governing_law",
    "customer",
    "Courts retained, class waiver removed",
    "Customer-side alternative that keeps disputes in court rather than compelled arbitration.",
    "This Agreement is governed by the laws of the State of Delaware, without regard to its conflict of " +
      "laws principles. The parties consent to the exclusive jurisdiction of the state and federal courts " +
      "located in Delaware for any dispute arising out of or relating to this Agreement. Each party shall " +
      "bear its own costs and attorneys' fees unless otherwise awarded by the court.",
  ),

  // ----------------------------------------------- intellectual property
  entry(
    "fb-intellectual_property-customer-1",
    "intellectual_property",
    "customer",
    "Feedback license retained, Customer Data license narrowed",
    "Customer-side alternative that limits the data license to what is needed to run the Services.",
    "Northstar retains all right, title, and interest in and to the Services, including all software, " +
      "models, and documentation, and all improvements thereto. Customer retains all right, title, and " +
      "interest in and to Customer Data. Customer grants Northstar a non-exclusive, worldwide, " +
      "royalty-free license to host, copy, transmit, and display Customer Data solely to the extent " +
      "necessary to provide the Services to Customer and as otherwise permitted by the Data Retention " +
      "section. Customer grants Northstar a perpetual, royalty-free license to use feedback and " +
      "suggestions Customer voluntarily provides, provided such use does not identify Customer.",
  ),
];
