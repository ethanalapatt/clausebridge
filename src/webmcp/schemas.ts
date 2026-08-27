/**
 * The two WebMCP tool contracts, transcribed exactly from the ClauseBridge
 * brief.
 *
 * Names, descriptions, and input schemas are the approved baseline and must not
 * drift. They are frozen so nothing at runtime can quietly widen the surface an
 * external agent sees.
 */

export const GET_NEGOTIATION_CONTEXT_NAME = "get_negotiation_context";
export const STAGE_REDLINE_PACKAGE_NAME = "stage_redline_package";

export const GET_NEGOTIATION_CONTEXT_DESCRIPTION =
  "Retrieve exact text, approved fallback language, and current decision status for selected clause IDs without changing the agreement.";

export const STAGE_REDLINE_PACKAGE_DESCRIPTION =
  "Render a group of clause-specific redlines with rationales for independent human approval; does not finalize the contract.";

export const GET_NEGOTIATION_CONTEXT_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    clauseIds: {
      type: "array",
      items: { type: "string" },
    },
    partyRole: {
      type: "string",
      enum: ["customer", "vendor", "neutral"],
    },
    priorityAreas: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["clauseIds", "partyRole", "priorityAreas"],
  additionalProperties: false,
} as const);

export const STAGE_REDLINE_PACKAGE_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    packageLabel: { type: "string" },
    edits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clauseId: { type: "string" },
          replacementText: { type: "string" },
          rationale: { type: "string" },
          priorityTag: {
            type: "string",
            enum: ["required", "preferred", "optional"],
          },
        },
        required: ["clauseId", "replacementText", "rationale", "priorityTag"],
        additionalProperties: false,
      },
    },
  },
  required: ["packageLabel", "edits"],
  additionalProperties: false,
} as const);
