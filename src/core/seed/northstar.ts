import type { ClauseType } from "@/core/types";

/**
 * Northstar SaaS Services Agreement — Fictional Demo.
 *
 * Entirely invented for this prototype. Northstar Systems, Inc. is not a real
 * company, this is not a real contract, and none of this wording is legal
 * advice or a model of correct drafting. It is drafted to lean vendor-favorable
 * so the customer-side demo has something substantive to negotiate against.
 */

export const NORTHSTAR_DOCUMENT_ID = "NSA";

export const NORTHSTAR_TITLE = "Northstar SaaS Services Agreement — Fictional Demo";

export const NORTHSTAR_PREAMBLE =
  "This Master Software-as-a-Service Agreement (the “Agreement”) is entered into by and between " +
  "Northstar Systems, Inc., a fictional Delaware corporation (“Northstar”), and the subscribing " +
  "entity identified in the applicable Order Form (“Customer”). This document is a fabricated " +
  "sample created for a product demonstration and has no legal effect.";

export interface SeedClause {
  title: string;
  clauseType: ClauseType;
  text: string;
}

export const NORTHSTAR_CLAUSES: readonly SeedClause[] = [
  {
    title: "Definitions",
    clauseType: "definitions",
    text:
      "“Services” means the hosted Northstar platform, associated APIs, and any documentation made " +
      "available to Customer under an Order Form. “Customer Data” means electronic data submitted to " +
      "the Services by or on behalf of Customer. “Order Form” means an ordering document executed by " +
      "the parties that references this Agreement. “Authorized User” means an individual employee or " +
      "contractor of Customer whom Customer permits to access the Services. Capitalized terms not " +
      "defined in this Section have the meanings given elsewhere in this Agreement.",
  },
  {
    title: "Services and Access",
    clauseType: "services",
    text:
      "Subject to Customer's compliance with this Agreement, Northstar grants Customer a " +
      "non-exclusive, non-transferable, revocable right to access and use the Services during the " +
      "Subscription Term solely for Customer's internal business purposes. Northstar may modify, " +
      "suspend, or discontinue any feature of the Services at any time in its sole discretion without " +
      "prior notice to Customer. Customer is responsible for all activity occurring under its " +
      "Authorized User credentials. Northstar does not commit to any specific uptime, response time, " +
      "or service level unless a separate service level addendum is executed by both parties.",
  },
  {
    title: "Fees and Payment",
    clauseType: "payment",
    text:
      "Customer shall pay all fees specified in each Order Form within fifteen (15) days of the " +
      "invoice date. All fees are non-refundable and non-cancelable, and payment obligations may not " +
      "be offset against any claim Customer may have against Northstar. Overdue amounts accrue " +
      "interest at one and one-half percent (1.5%) per month or the maximum rate permitted by law, " +
      "whichever is greater. Northstar may increase fees for any renewal term upon notice given at " +
      "any time before the renewal date. Northstar may suspend the Services immediately if any " +
      "invoice remains unpaid for more than ten (10) days.",
  },
  {
    title: "Confidentiality",
    clauseType: "confidentiality",
    text:
      "Each party may disclose Confidential Information to the other. The receiving party shall " +
      "protect such information using reasonable care and shall not disclose it to third parties " +
      "except to its employees, affiliates, contractors, and professional advisers who have a need to " +
      "know. The receiving party's obligations under this Section expire two (2) years after the date " +
      "of disclosure. Confidential Information does not include information that is or becomes " +
      "publicly available, was rightfully known without restriction, or is independently developed. " +
      "Northstar may disclose the existence and general nature of this engagement in its customer " +
      "lists and marketing materials.",
  },
  {
    title: "Data Protection and Security",
    clauseType: "security",
    text:
      "Northstar shall maintain administrative, physical, and technical safeguards for the Services " +
      "that are commercially reasonable in Northstar's judgment. Northstar may engage subprocessors " +
      "of its choosing and is not required to provide advance notice of, or obtain consent for, any " +
      "change to its subprocessors. In the event Northstar becomes aware of unauthorized access to " +
      "Customer Data, Northstar shall notify Customer within a reasonable period after Northstar has " +
      "completed its internal investigation. Customer may not conduct penetration testing, " +
      "vulnerability scanning, or on-site security audits of the Services or Northstar's facilities.",
  },
  {
    title: "Data Retention and Deletion",
    clauseType: "data_retention",
    text:
      "Northstar may retain Customer Data for as long as Northstar deems necessary for its business " +
      "purposes, including product improvement, analytics, and the training of Northstar's internal " +
      "models. Upon expiration or termination of the Subscription Term, Northstar will make Customer " +
      "Data available for export for a period of ten (10) days, after which Northstar may delete " +
      "Customer Data at its discretion. Northstar is under no obligation to certify deletion, to " +
      "delete data from backup or archival systems, or to delete aggregated or de-identified data " +
      "derived from Customer Data.",
  },
  {
    title: "Warranties and Disclaimers",
    clauseType: "warranty",
    text:
      "THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTY OF ANY KIND. NORTHSTAR " +
      "EXPRESSLY DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING THE " +
      "IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND " +
      "NON-INFRINGEMENT. Northstar does not warrant that the Services will be uninterrupted, secure, " +
      "or error-free, or that any defect will be corrected. Customer acknowledges that it has not " +
      "relied on any representation not expressly set forth in this Agreement.",
  },
  {
    title: "Limitation of Liability",
    clauseType: "liability",
    text:
      "IN NO EVENT SHALL NORTHSTAR'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THIS " +
      "AGREEMENT EXCEED THE LESSER OF (A) THE FEES PAID BY CUSTOMER IN THE THREE (3) MONTHS " +
      "IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM OR (B) TWENTY-FIVE THOUSAND UNITED " +
      "STATES DOLLARS ($25,000). NORTHSTAR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, " +
      "CONSEQUENTIAL, OR EXEMPLARY DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, GOODWILL, OR DATA, " +
      "REGARDLESS OF THE THEORY OF LIABILITY AND EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. " +
      "THIS LIMITATION APPLIES TO ALL CLAIMS WITHOUT EXCEPTION, INCLUDING CLAIMS ARISING FROM A " +
      "SECURITY INCIDENT, BREACH OF CONFIDENTIALITY, OR INDEMNIFICATION OBLIGATIONS.",
  },
  {
    title: "Term and Termination",
    clauseType: "termination",
    text:
      "This Agreement begins on the Effective Date and continues for the Subscription Term stated in " +
      "the Order Form. The Subscription Term renews automatically for successive twelve (12) month " +
      "periods unless Customer delivers written notice of non-renewal at least ninety (90) days " +
      "before the end of the then-current term. Northstar may terminate this Agreement or any Order " +
      "Form at any time, for convenience, upon thirty (30) days' notice. Customer may terminate only " +
      "for Northstar's uncured material breach following a sixty (60) day cure period. No termination " +
      "entitles Customer to any refund of prepaid fees.",
  },
  {
    title: "Intellectual Property",
    clauseType: "intellectual_property",
    text:
      "Northstar retains all right, title, and interest in and to the Services, including all " +
      "software, models, and documentation, and all improvements thereto. Customer retains ownership " +
      "of Customer Data. Customer grants Northstar a perpetual, irrevocable, worldwide, royalty-free " +
      "license to use, reproduce, modify, and create derivative works from Customer Data and from any " +
      "feedback, suggestions, or configuration Customer provides, for any purpose including the " +
      "development and commercialization of Northstar's products.",
  },
  {
    title: "Governing Law and Dispute Resolution",
    clauseType: "governing_law",
    text:
      "This Agreement is governed by the laws of the State of Delaware, without regard to its " +
      "conflict of laws principles. Any dispute arising out of or relating to this Agreement shall be " +
      "resolved exclusively by binding arbitration administered in Wilmington, Delaware, before a " +
      "single arbitrator selected by Northstar. Each party waives any right to a trial by jury and " +
      "any right to participate in a class or representative action. The prevailing party shall be " +
      "entitled to recover its reasonable attorneys' fees.",
  },
];
